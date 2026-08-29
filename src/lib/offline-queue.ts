"use client";

// Offline write queue — IndexedDB-backed FIFO of intercepted mutations.
//
// When the app goes offline, every write (POST/PATCH/DELETE) is stored here
// instead of failing. While offline the UI keeps working from optimistic
// cache patches (see offline-cache.ts); when connectivity returns the queue
// replays sequentially and the affected queries are invalidated with fresh
// server data.
//
// Temp-id remapping: offline creates get a client-generated id
// ("offline-xxxxx"). When the queued create finally replays, the response
// carries the real server id and every LATER queued entry that references
// the temp id (edits, deletes, subtask creates…) is rewritten — so a task
// created and then edited offline syncs correctly.

export interface QueuedRequest {
  id?: number; // IndexedDB key (auto-increment)
  url: string;
  method: string;
  body: string | null; // JSON-encoded request body
  tempId?: string | null; // client id assigned to offline creates
  createdAt: number;
}

export interface ReplayResult {
  synced: number; // successfully replayed
  dropped: number; // permanently rejected by the server (4xx)
  remaining: number; // still queued (network/server unavailable)
}

const DB_NAME = "momentum-offline";
const DB_VERSION = 1;
const STORE = "queue";
const SYNC_LOCK = "momentum-sync-lock";

/** Statuses that mean "this request will never succeed — drop it". */
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 405, 409, 410, 422]);

// In-memory fallback when IndexedDB is unavailable (private mode).
const memoryQueue: QueuedRequest[] = [];
let memoryId = 1;
let idbBroken = false;

export const QUEUE_CHANGED_EVENT = "momentum:queue-changed";
export const QUEUE_SYNCED_EVENT = "momentum:queue-synced";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined" || idbBroken) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          idbBroken = true;
          resolve(null);
        };
        req.onblocked = () => resolve(null);
      } catch {
        idbBroken = true;
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const transaction = db.transaction(STORE, mode);
          const request = run(transaction.objectStore(STORE));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => resolve(null);
          transaction.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

/** Paths whose mutations are safe to queue while offline. */
export function isQueueablePath(path: string): boolean {
  if (!path.startsWith("/api/")) return false;
  // Auth flows, push subscription management and exports must never queue.
  if (path.startsWith("/api/auth/") || path.startsWith("/api/push/")) return false;
  if (path.startsWith("/api/export")) return false;
  return true;
}

export async function enqueueRequest(
  url: string,
  method: string,
  body: string | null,
  tempId?: string | null,
): Promise<void> {
  const entry: QueuedRequest = { url, method, body, tempId: tempId ?? null, createdAt: Date.now() };
  const db = await openDb();
  if (db) {
    const ok = await tx("readwrite", (store) => store.add(entry) as IDBRequest<IDBValidKey>);
    if (ok === null) memoryQueue.push({ ...entry, id: memoryId++ });
  } else {
    memoryQueue.push({ ...entry, id: memoryId++ });
  }
  void notifyQueueChanged();
}

export async function getQueueEntries(): Promise<QueuedRequest[]> {
  const db = await openDb();
  if (db) {
    const all = await tx<QueuedRequest[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedRequest[]>);
    if (all) return all.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }
  return [...memoryQueue];
}

export async function getQueueCount(): Promise<number> {
  const db = await openDb();
  if (db) {
    const count = await tx<number>("readonly", (store) => store.count() as IDBRequest<number>);
    if (count !== null) return count;
  }
  return memoryQueue.length;
}

async function deleteEntry(id: number): Promise<void> {
  const db = await openDb();
  if (db) {
    await tx("readwrite", (store) => store.delete(id) as unknown as IDBRequest<undefined>);
  } else {
    const index = memoryQueue.findIndex((e) => e.id === id);
    if (index >= 0) memoryQueue.splice(index, 1);
  }
}

export async function clearQueue(): Promise<void> {
  const db = await openDb();
  if (db) {
    await tx("readwrite", (store) => store.clear() as unknown as IDBRequest<undefined>);
  }
  memoryQueue.length = 0;
  void notifyQueueChanged();
}

async function notifyQueueChanged(): Promise<void> {
  if (typeof window === "undefined") return;
  const count = await getQueueCount();
  window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT, { detail: { count } }));
}

function applyIdMap(text: string, idMap: Map<string, string>): string {
  let result = text;
  for (const [temp, real] of idMap) {
    if (temp && real) result = result.split(temp).join(real);
  }
  return result;
}

/**
 * Replays the queue sequentially (FIFO). Stops early when the network or
 * server is unavailable so order is preserved for the next attempt.
 * Permanently-rejected requests (4xx) are dropped and counted.
 */
export async function replayQueue(): Promise<ReplayResult> {
  if (typeof window === "undefined") return { synced: 0, dropped: 0, remaining: 0 };

  // Cross-tab guard: only one tab replays at a time (30s freshness).
  try {
    const lock = window.localStorage.getItem(SYNC_LOCK);
    if (lock && Date.now() - Number(lock) < 30_000) {
      return { synced: 0, dropped: 0, remaining: await getQueueCount() };
    }
    window.localStorage.setItem(SYNC_LOCK, String(Date.now()));
  } catch {
    /* localStorage unavailable — proceed unlocked */
  }

  const idMap = new Map<string, string>(); // tempId → real server id
  let synced = 0;
  let dropped = 0;

  try {
    const entries = await getQueueEntries();
    for (const entry of entries) {
      if (!entry.id) continue;
      const url = applyIdMap(entry.url, idMap);
      const body = entry.body ? applyIdMap(entry.body, idMap) : null;

      let res: Response;
      try {
        res = await fetch(url, {
          method: entry.method,
          headers: body !== null ? { "Content-Type": "application/json" } : undefined,
          body: body ?? undefined,
          cache: "no-store",
        });
      } catch {
        // Network still down — keep the rest of the queue for later.
        break;
      }

      if (res.ok) {
        if (entry.tempId) {
          try {
            const json = (await res.json()) as { id?: unknown } | null;
            if (json && typeof json.id === "string") idMap.set(entry.tempId, json.id);
          } catch {
            /* response without JSON body — nothing to map */
          }
        }
        await deleteEntry(entry.id);
        synced += 1;
        void notifyQueueChanged();
      } else if (PERMANENT_STATUSES.has(res.status)) {
        // Will never succeed — drop it (e.g. validation failure, item
        // deleted on another device). The post-sync invalidation will
        // reconcile the UI with server truth.
        await deleteEntry(entry.id);
        dropped += 1;
        void notifyQueueChanged();
      } else {
        // 5xx / 429 — retry later, keep order.
        break;
      }
    }
  } finally {
    try {
      window.localStorage.removeItem(SYNC_LOCK);
    } catch {
      /* ignore */
    }
  }

  const result: ReplayResult = { synced, dropped, remaining: await getQueueCount() };
  window.dispatchEvent(new CustomEvent(QUEUE_SYNCED_EVENT, { detail: result }));
  return result;
}
