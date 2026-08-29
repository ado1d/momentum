"use client";

// Optimistic cache patches for offline mutations.
//
// When a mutation is diverted into the offline queue (see api.ts), the UI
// would otherwise show nothing happened. This module patches the TanStack
// Query caches directly so offline changes are immediately visible:
// created items appear (with a temporary client id), edits merge, deletes
// disappear. After the queue replays and queries are invalidated, server
// truth replaces the optimistic state.
//
// ── Why "reapply" exists ────────────────────────────────────────────
// While offline, background refetches (window focus, remounts, polls)
// resolve against the service worker's LAST-CACHED API responses — data
// from *before* the offline change. That fresh-stale data lands in the
// query cache and wipes the optimistic patch, making offline changes
// vanish from the screen (the #1 real-world offline bug reported by
// users). `reapplyOfflinePatches()` is therefore invoked after every
// successful query fetch (see providers.tsx → QueryCache.onSuccess):
// it reads the queue and re-applies every pending patch on top of the
// new data. All patches are idempotent (dedupe / absolute-merge /
// remove) or expressed as NET effects (toggle counts, progress deltas),
// so applying them any number of times is safe.

import type { QueryClient } from "@tanstack/react-query";
import type { Goal, Habit, JournalEntry, Note, RoutineTask, Subtask, Todo } from "./types";
import { getQueueEntries } from "./offline-queue";

export interface OfflineMutationDetail {
  url: string;
  method: string;
  body: string | null;
  tempId?: string | null;
}

const nowIso = () => new Date().toISOString();
const todayKey = () => nowIso().slice(0, 10);

function parseJson<T>(body: string | null): T {
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

// ── List helpers ─────────────────────────────────────────────────

/** Patch every cached list query whose key starts with `prefix`. */
function patchLists<T>(
  queryClient: QueryClient,
  prefix: unknown[],
  updater: (data: T) => T,
): void {
  try {
    queryClient.setQueriesData<T>({ queryKey: prefix }, (old) =>
      old === undefined ? old : updater(old),
    );
  } catch {
    /* cache shape surprise — skip, sync will reconcile */
  }
}

/** Append unless an item with the same id is already present (idempotent). */
function appendDeduped<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list : [...list, item];
}

/**
 * Create-patch: appends the offline item (deduped by id) to every cached
 * list under `prefix` AND ensures the `canonicalKey` list always contains
 * it — seeding that key even when the view was NEVER opened online. When
 * seeding, a sibling list under the same prefix (e.g. the always-mounted
 * ["todos","all"] vs the view's ["todos","full"]) provides the base data
 * so the offline item doesn't render alone.
 */
function patchListCreate<T extends { id: string }>(
  queryClient: QueryClient,
  prefix: unknown[],
  canonicalKey: unknown[],
  item: T,
): void {
  try {
    // 1) Always upsert the canonical list — seed from a sibling when absent.
    queryClient.setQueryData<T[]>(canonicalKey, (old) => {
      if (Array.isArray(old)) return appendDeduped(old, item);
      // No cached list for this key yet: borrow the richest sibling list.
      const siblings = queryClient.getQueriesData<T[]>({ queryKey: prefix });
      for (const [, data] of siblings) {
        if (Array.isArray(data) && data.length > 0) return appendDeduped(data, item);
      }
      return [item];
    });
    // 2) Append to every OTHER cached list under the prefix.
    for (const [key, data] of queryClient.getQueriesData<T[]>({ queryKey: prefix })) {
      if (Array.isArray(data)) queryClient.setQueryData<T[]>(key, appendDeduped(data, item));
    }
  } catch {
    /* cache shape surprise — skip, sync will reconcile */
  }
}

function removeFrom<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

function mergeInto<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  let touched = false;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    touched = true;
    return { ...item, ...patch };
  });
  return touched ? next : list;
}

// ── Synthetic items (placeholders until the server syncs) ────────

function syntheticTodo(input: Record<string, unknown>, tempId: string): Todo {
  return {
    id: tempId,
    title: String(input.title ?? "Task"),
    notes: (input.notes as string | null) ?? null,
    priority: (input.priority as Todo["priority"]) ?? "medium",
    category: typeof input.category === "string" ? input.category : "personal",
    dueDate: (input.dueDate as string | null) ?? null,
    reminderAt: (input.reminderAt as string | null) ?? null,
    repeat: (input.repeat as Todo["repeat"]) ?? "none",
    completed: false,
    completedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    subtasks: [],
  };
}

function syntheticHabit(input: Record<string, unknown>, tempId: string): Habit {
  return {
    id: tempId,
    name: String(input.name ?? "Habit"),
    emoji: String(input.emoji ?? "✅"),
    color: (input.color as Habit["color"]) ?? "emerald",
    timeOfDay: (input.timeOfDay as Habit["timeOfDay"]) ?? "anytime",
    reminderTime: (input.reminderTime as string | null) ?? null,
    targetPerDay: typeof input.targetPerDay === "number" ? input.targetPerDay : 1,
    archived: false,
    sortOrder: typeof input.sortOrder === "number" ? input.sortOrder : 0,
    createdAt: nowIso(),
    logs: [],
    streak: 0,
    doneToday: false,
    completionsThisWeek: 0,
  };
}

function syntheticRoutine(input: Record<string, unknown>, tempId: string): RoutineTask {
  return {
    id: tempId,
    name: String(input.name ?? "Routine task"),
    emoji: String(input.emoji ?? "🌅"),
    section: (input.section as RoutineTask["section"]) ?? "morning",
    time: (input.time as string | null) ?? null,
    days: typeof input.days === "string" ? input.days : "1,2,3,4,5,6,7",
    archived: false,
    sortOrder: typeof input.sortOrder === "number" ? input.sortOrder : 0,
    createdAt: nowIso(),
    doneToday: false,
    streak: 0,
  };
}

function syntheticNote(input: Record<string, unknown>, tempId: string): Note {
  return {
    id: tempId,
    title: typeof input.title === "string" ? input.title : "Untitled note",
    content: typeof input.content === "string" ? input.content : "",
    tag: (input.tag as string | null) ?? null,
    color: (input.color as Note["color"]) ?? "default",
    pinned: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function syntheticGoal(input: Record<string, unknown>, tempId: string): Goal {
  return {
    id: tempId,
    title: String(input.title ?? "Goal"),
    description: (input.description as string | null) ?? null,
    category: typeof input.category === "string" ? input.category : "learning",
    period: (input.period as Goal["period"]) ?? "daily",
    target: typeof input.target === "number" ? input.target : 1,
    progress: 0,
    unit: (input.unit as string | null) ?? null,
    status: "active",
    startDate:
      typeof input.startDate === "string" ? input.startDate : nowIso().slice(0, 10),
    endDate: (input.endDate as string | null) ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function syntheticJournal(input: Record<string, unknown>, tempId: string): JournalEntry {
  return {
    id: tempId,
    date: typeof input.date === "string" ? input.date : todayKey(),
    title: (input.title as string | null) ?? null,
    content: typeof input.content === "string" ? input.content : "",
    mood: (input.mood as JournalEntry["mood"]) ?? null,
    energy: typeof input.energy === "number" ? input.energy : null,
    gratitude: (input.gratitude as string | null) ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function syntheticSubtask(
  input: Record<string, unknown>,
  tempId: string,
  todoId: string,
): Subtask {
  return {
    id: tempId,
    todoId,
    title: String(input.title ?? "Step"),
    completed: false,
    sortOrder: Date.now() % 100000,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

// ── Subtask helpers (subtasks ride inside their parent todo) ─────

/** Map every cached todo list, transforming the subtasks of one parent todo. */
function patchParentSubtasks(
  queryClient: QueryClient,
  todoId: string,
  transform: (subtasks: Subtask[]) => Subtask[],
): void {
  patchLists<Todo[]>(queryClient, ["todos"], (list) =>
    list.map((todo) => (todo.id === todoId ? { ...todo, subtasks: transform(todo.subtasks ?? []) } : todo)),
  );
}

function mergeSubtask(
  queryClient: QueryClient,
  subtaskId: string,
  patch: Partial<Subtask>,
): void {
  patchLists<Todo[]>(queryClient, ["todos"], (list) => {
    let touched = false;
    const next = list.map((todo) => {
      if (touched || !todo.subtasks?.some((s) => s.id === subtaskId)) return todo;
      touched = true;
      return {
        ...todo,
        subtasks: todo.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s)),
      };
    });
    return touched ? next : list;
  });
}

function removeSubtask(queryClient: QueryClient, subtaskId: string): void {
  patchLists<Todo[]>(queryClient, ["todos"], (list) =>
    list.map((todo) =>
      todo.subtasks?.some((s) => s.id === subtaskId)
        ? { ...todo, subtasks: todo.subtasks.filter((s) => s.id !== subtaskId) }
        : todo,
    ),
  );
}

// ── Flip helpers (toggle semantics — only used by the NET pass) ──

function flipHabitToday(list: Habit[], id: string): Habit[] {
  return list.map((h) => {
    if (h.id !== id) return h;
    const nowDone = !h.doneToday;
    const today = todayKey();
    return {
      ...h,
      doneToday: nowDone,
      streak: Math.max(0, h.streak + (nowDone ? 1 : -1)),
      completionsThisWeek: Math.max(0, h.completionsThisWeek + (nowDone ? 1 : -1)),
      logs: nowDone
        ? [...h.logs.filter((l) => l.date !== today), { id: `offline-log-${today}`, habitId: h.id, date: today }]
        : h.logs.filter((l) => l.date !== today),
    };
  });
}

function flipRoutineToday(list: RoutineTask[], id: string): RoutineTask[] {
  return list.map((t) => {
    if (t.id !== id) return t;
    const nowDone = !t.doneToday;
    return {
      ...t,
      doneToday: nowDone,
      streak: Math.max(0, t.streak + (nowDone ? 1 : -1)),
    };
  });
}

function addGoalProgress(list: Goal[], id: string, netDelta: number): Goal[] {
  if (netDelta === 0) return list;
  return list.map((g) => {
    if (g.id !== id) return g;
    return { ...g, progress: Math.min(Math.max(g.progress + netDelta, 0), g.target) };
  });
}

// ── Single-entry patch application ───────────────────────────────

/**
 * Applies an optimistic patch for ONE queued offline mutation.
 *
 * `includeDeferred: false` (event-time — the mutation just happened):
 * applies idempotent patches only. Flip-semantics entries (habit/routine
 * toggles, goal progress) are SKIPPED because the originating view has
 * already applied its own optimistic update at mutation time — patching
 * again would double-flip.
 *
 * `includeDeferred: true` is never used per-entry; the deferred entries
 * are handled as NET effects by reapplyOfflinePatches().
 */
function applyEntry(
  queryClient: QueryClient,
  detail: OfflineMutationDetail,
): void {
  if (typeof window === "undefined") return;
  const tempId = detail.tempId || `offline-${Math.random().toString(36).slice(2, 10)}`;
  const path = detail.url.split("?")[0];
  const segments = path.replace(/^\/api\//, "").split("/");
  const body = parseJson<Record<string, unknown>>(detail.body);

  // ── Todos ────────────────────────────────────────────────────────
  if (segments[0] === "todos") {
    if (
      segments.length === 2 &&
      segments[1] === "clear-completed" &&
      detail.method === "POST"
    ) {
      // POST /api/todos/clear-completed — mass delete of completed todos.
      patchLists<Todo[]>(queryClient, ["todos"], (list) => list.filter((t) => !t.completed));
    } else if (segments.length === 1 && detail.method === "POST") {
      const todo = syntheticTodo(body, tempId);
      patchListCreate<Todo>(queryClient, ["todos"], ["todos", "full"], todo);
    } else if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") {
        patchLists<Todo[]>(queryClient, ["todos"], (list) => removeFrom(list, id));
      } else if (detail.method === "PATCH") {
        // Bodies carry absolute values (e.g. { completed: true }) → idempotent.
        const patch = { ...body } as Partial<Todo>;
        if (patch.completed === true && !("completedAt" in patch)) {
          (patch as Record<string, unknown>).completedAt = nowIso();
        }
        patchLists<Todo[]>(queryClient, ["todos"], (list) => mergeInto(list, id, patch));
      }
    }
    // POST /api/todos/{id}/subtasks is handled by applySubtaskCreate.
    return;
  }

  // ── Subtasks (nested in todos) ──────────────────────────────────
  if (segments[0] === "subtasks") {
    if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") removeSubtask(queryClient, id);
      else if (detail.method === "PATCH")
        mergeSubtask(queryClient, id, body as Partial<Subtask>);
    }
    return;
  }

  // ── Habits ───────────────────────────────────────────────────────
  if (segments[0] === "habits") {
    if (segments.length === 1 && detail.method === "POST") {
      const habit = syntheticHabit(body, tempId);
      patchListCreate<Habit>(queryClient, ["habits"], ["habits"], habit);
    } else if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") {
        patchLists<Habit[]>(queryClient, ["habits"], (list) => removeFrom(list, id));
      } else if (detail.method === "PATCH") {
        patchLists<Habit[]>(queryClient, ["habits"], (list) => mergeInto(list, id, body as Partial<Habit>));
      }
    }
    return; // toggles are flip-semantics → NET pass only
  }

  // ── Routine ──────────────────────────────────────────────────────
  if (segments[0] === "routine") {
    if (segments.length === 1 && detail.method === "POST") {
      const task = syntheticRoutine(body, tempId);
      patchListCreate<RoutineTask>(queryClient, ["routine"], ["routine"], task);
    } else if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") {
        patchLists<RoutineTask[]>(queryClient, ["routine"], (list) => removeFrom(list, id));
      } else if (detail.method === "PATCH") {
        patchLists<RoutineTask[]>(queryClient, ["routine"], (list) =>
          mergeInto(list, id, body as Partial<RoutineTask>),
        );
      }
    }
    return; // toggles are flip-semantics → NET pass only
  }

  // ── Notes ────────────────────────────────────────────────────────
  if (segments[0] === "notes") {
    if (segments.length === 1 && detail.method === "POST") {
      const note = syntheticNote(body, tempId);
      patchListCreate<Note>(queryClient, ["notes"], ["notes"], note);
    } else if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") {
        patchLists<Note[]>(queryClient, ["notes"], (list) => removeFrom(list, id));
      } else if (detail.method === "PATCH") {
        patchLists<Note[]>(queryClient, ["notes"], (list) => mergeInto(list, id, body as Partial<Note>));
      }
    }
    return;
  }

  // ── Journal ──────────────────────────────────────────────────────
  if (segments[0] === "journal") {
    if (segments.length === 1 && detail.method === "POST") {
      // Upsert by date — idempotent. The canonical ["journal"] list is
      // always upserted (seeding it if the diary was never opened), then
      // every other journal-prefixed list (e.g. month views) is patched.
      const entry = syntheticJournal(body, tempId);
      const upsertByDate = (data: JournalEntry[]) => {
        const index = data.findIndex((e) => e.date === entry.date);
        return index === -1
          ? appendDeduped(data, entry)
          : data.map((e, i) => (i === index ? { ...e, ...entry, id: e.id } : e));
      };
      try {
        queryClient.setQueryData<JournalEntry[]>(["journal"], (old) => {
          if (Array.isArray(old)) return upsertByDate(old);
          // Diary list never cached: borrow a month list as the base.
          const siblings = queryClient.getQueriesData<JournalEntry[]>({
            queryKey: ["journal"],
          });
          for (const [, data] of siblings) {
            if (Array.isArray(data) && data.length > 0) return upsertByDate(data);
          }
          return [entry];
        });
        for (const [key, data] of queryClient.getQueriesData<JournalEntry[]>({
          queryKey: ["journal"],
        })) {
          if (Array.isArray(data)) queryClient.setQueryData<JournalEntry[]>(key, upsertByDate(data));
        }
      } catch {
        /* cache shape surprise — skip */
      }
    } else if (segments.length === 2 && detail.method === "DELETE") {
      const id = segments[1];
      patchLists<JournalEntry[]>(queryClient, ["journal"], (list) => removeFrom(list, id));
    }
    return;
  }

  // ── Goals ────────────────────────────────────────────────────────
  if (segments[0] === "goals") {
    if (segments.length === 1 && detail.method === "POST") {
      const goal = syntheticGoal(body, tempId);
      patchListCreate<Goal>(queryClient, ["goals"], ["goals"], goal);
    } else if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") {
        patchLists<Goal[]>(queryClient, ["goals"], (list) => removeFrom(list, id));
      } else if (detail.method === "PATCH") {
        patchLists<Goal[]>(queryClient, ["goals"], (list) => mergeInto(list, id, body as Partial<Goal>));
      }
    }
    // progress increments are flip-semantics → NET pass only
  }
}

// Subtask create needs the todo id from the URL — handle here because
// applyEntry's todos branch returns early for 3-segment paths.
function applySubtaskCreate(
  queryClient: QueryClient,
  detail: OfflineMutationDetail,
  tempId: string,
): boolean {
  const path = detail.url.split("?")[0];
  const m = path.match(/^\/api\/todos\/([^/]+)\/subtasks$/);
  if (!m || detail.method !== "POST") return false;
  const body = parseJson<Record<string, unknown>>(detail.body);
  const subtask = syntheticSubtask(body, tempId, m[1]);
  patchParentSubtasks(queryClient, m[1], (subs) => appendDeduped(subs, subtask));
  return true;
}

/**
 * Event-time entry point: a mutation was just diverted into the offline
 * queue — apply its optimistic patch so the change is instantly visible.
 * (Flip-semantics entries are skipped; their views self-optimise.)
 */
export function applyOfflineOptimistic(
  queryClient: QueryClient,
  detail: OfflineMutationDetail,
): void {
  if (typeof window === "undefined") return;
  const tempId = detail.tempId || `offline-${Math.random().toString(36).slice(2, 10)}`;
  if (applySubtaskCreate(queryClient, detail, tempId)) return;
  applyEntry(queryClient, detail);
}

// ── NET re-application pass ──────────────────────────────────────

let reapplyRunning = false;
let reapplyQueued = false;

/**
 * Reads the whole offline queue and re-applies every pending optimistic
 * patch on top of whatever data the caches currently hold. Invoked after
 * every successful query FETCH (providers.tsx → QueryCache.onSuccess) so
 * offline changes survive the stale-data refetches that happen while
 * offline — the fix for "things I add offline disappear".
 *
 * Also folds in NET deferred effects:
 *   • habit/routine toggles — odd count of queued toggles for an item
 *     flips its done-today state (even count = no-op);
 *   • goal progress increments — queued deltas are summed and applied.
 */
export async function reapplyOfflinePatches(queryClient: QueryClient): Promise<void> {
  if (typeof window === "undefined") return;
  const entries = await getQueueEntries();
  if (entries.length === 0) return;

  // 1) Idempotent patches, in queue order.
  for (const entry of entries) {
    if (!entry.id) continue;
    const detail: OfflineMutationDetail = {
      url: entry.url,
      method: entry.method,
      body: entry.body,
      tempId: entry.tempId,
    };
    const tempId =
      entry.tempId || `offline-${(entry.id ?? Math.random()).toString(36).slice(2, 12)}`;
    if (applySubtaskCreate(queryClient, detail, tempId)) continue;
    applyEntry(queryClient, detail);
  }

  // 2) Net flip/delta effects.
  const habitFlips = new Map<string, number>();
  const routineFlips = new Map<string, number>();
  const goalDeltas = new Map<string, number>();
  const today = todayKey();

  for (const entry of entries) {
    const path = entry.url.split("?")[0];
    const body = parseJson<Record<string, unknown>>(entry.body);
    let m: RegExpMatchArray | null;

    if (
      entry.method === "POST" &&
      (m = path.match(/^\/api\/habits\/([^/]+)\/toggle$/)) &&
      (typeof body.date !== "string" || body.date === today)
    ) {
      const id = m[1];
      habitFlips.set(id, (habitFlips.get(id) ?? 0) + 1);
    } else if (
      entry.method === "POST" &&
      (m = path.match(/^\/api\/routine\/([^/]+)\/toggle$/)) &&
      (typeof body.date !== "string" || body.date === today)
    ) {
      const id = m[1];
      routineFlips.set(id, (routineFlips.get(id) ?? 0) + 1);
    } else if (
      entry.method === "POST" &&
      (m = path.match(/^\/api\/goals\/([^/]+)\/progress$/)) &&
      typeof body.delta === "number"
    ) {
      const id = m[1];
      goalDeltas.set(id, (goalDeltas.get(id) ?? 0) + body.delta);
    }
  }

  for (const [id, count] of habitFlips) {
    if (count % 2 === 1) patchLists<Habit[]>(queryClient, ["habits"], (list) => flipHabitToday(list, id));
  }
  for (const [id, count] of routineFlips) {
    if (count % 2 === 1)
      patchLists<RoutineTask[]>(queryClient, ["routine"], (list) => flipRoutineToday(list, id));
  }
  for (const [id, delta] of goalDeltas) {
    patchLists<Goal[]>(queryClient, ["goals"], (list) => addGoalProgress(list, id, delta));
  }
}

/**
 * Fire-and-forget wrapper with coalescing: concurrent fetch successes
 * while the queue is non-empty collapse into one re-apply pass, with a
 * trailing pass if anything lands mid-run.
 */
export function scheduleOfflineReapply(queryClient: QueryClient): void {
  if (reapplyRunning) {
    reapplyQueued = true;
    return;
  }
  reapplyRunning = true;
  void reapplyOfflinePatches(queryClient).finally(() => {
    reapplyRunning = false;
    if (reapplyQueued) {
      reapplyQueued = false;
      scheduleOfflineReapply(queryClient);
    }
  });
}
