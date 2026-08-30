// Sync engine — last-write-wins merge between local SQLite and the Momentum
// backend. Runs opportunistically (app start, connectivity regain, after
// mutations, manual) and only when signed in + online.

import { applyServerData, collectAll, pendingSince } from "./db";
import type { Tombstone } from "./db";
import { useApp } from "./store";
import { serverBase, type SyncResult } from "./api";

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

export async function syncNow(manual = false): Promise<SyncResult> {
  const app = useApp.getState();
  if (!app.auth) {
    return { ok: false, message: "Sign in to sync with the web app" };
  }
  if (!app.online) {
    return { ok: false, message: "You're offline — changes are saved on this device" };
  }
  if (inFlight) {
    return { ok: false, message: "Sync already running" };
  }

  inFlight = true;
  useApp.getState().setSyncing(true);
  try {
    const push = collectAll();
    const res = await fetch(`${serverBase()}/api/mobile/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${useApp.getState().auth?.token ?? ""}`,
      },
      body: JSON.stringify({
        lastSyncAt: useApp.getState().lastSyncAt,
        push,
      }),
    });

    if (res.status === 401) {
      useApp.getState().setSyncing(false);
      return { ok: false, message: "Session expired — sign in again" };
    }
    if (!res.ok) {
      useApp.getState().setSyncing(false);
      return { ok: false, message: `Sync failed (${res.status}) — will retry` };
    }

    const body = (await res.json()) as {
      data: Record<string, Record<string, unknown>[]>;
      tombstones: Tombstone[];
      serverTime: string;
    };

    const changed = applyServerData(body.data as Record<string, never[]>, body.tombstones ?? []);
    useApp.getState().setSyncDone(body.serverTime, null);
    useApp.getState().bump();

    const pending = pendingSince(body.serverTime);
    const detail = changed > 0 ? ` — ${changed} update${changed === 1 ? "" : "s"} pulled` : "";
    const left = pending > 0 ? ` (${pending} still pending)` : "";
    return {
      ok: true,
      message: manual ? `Synced${detail}${left}` : `Synced${detail}`,
    };
  } catch {
    useApp.getState().setSyncing(false);
    return { ok: false, message: "Couldn't reach the server — will retry" };
  } finally {
    inFlight = false;
    useApp.getState().setSyncing(false);
  }
}

/** Debounced auto-sync after local mutations. */
export function scheduleSync(): void {
  const app = useApp.getState();
  if (!app.auth || !app.autoSync || !app.online) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void syncNow(false);
  }, 4000);
}
