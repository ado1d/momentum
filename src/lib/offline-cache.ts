"use client";

// Optimistic cache patches for offline mutations.
//
// When a mutation is diverted into the offline queue (see api.ts), the UI
// would otherwise show nothing happened. This module patches the TanStack
// Query caches directly so offline changes are immediately visible:
// created items appear (with a temporary client id), edits merge, deletes
// disappear. After the queue replays and queries are invalidated, server
// truth replaces the optimistic state.

import type { QueryClient } from "@tanstack/react-query";
import type { Goal, Habit, JournalEntry, Note, RoutineTask, Todo } from "./types";

export interface OfflineMutationDetail {
  url: string;
  method: string;
  body: string | null;
  tempId?: string | null;
}

const nowIso = () => new Date().toISOString();

/** Patch every cached list query whose key starts with `prefix`. */
function patchLists<T>(
  queryClient: QueryClient,
  prefix: unknown[],
  updater: (data: T) => T,
): void {
  try {
    queryClient.setQueriesData<T>({ queryKey: prefix }, (old) => (old === undefined ? old : updater(old)));
  } catch {
    /* cache shape surprise — skip, sync will reconcile */
  }
}

/**
 * Create-patch: appends the offline item to every cached list under
 * `prefix`; when NO list is cached yet (view never opened while online),
 * seeds `canonicalKey` with the offline items so they're still visible.
 */
function patchListCreate<T extends { id: string }>(
  queryClient: QueryClient,
  prefix: unknown[],
  canonicalKey: unknown[],
  item: T,
): void {
  try {
    const existing = queryClient.getQueriesData<T[]>({ queryKey: prefix });
    if (existing.length === 0) {
      queryClient.setQueryData<T[]>(canonicalKey, [item]);
      return;
    }
    for (const [key, data] of existing) {
      if (Array.isArray(data)) queryClient.setQueryData<T[]>(key, [...data, item]);
    }
  } catch {
    /* cache shape surprise — skip, sync will reconcile */
  }
}

function removeFrom<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id);
}

function mergeInto<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

function parseJson<T>(body: string | null): T {
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    return {} as T;
  }
}

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
    date: typeof input.date === "string" ? input.date : nowIso().slice(0, 10),
    title: (input.title as string | null) ?? null,
    content: typeof input.content === "string" ? input.content : "",
    mood: (input.mood as JournalEntry["mood"]) ?? null,
    energy: typeof input.energy === "number" ? input.energy : null,
    gratitude: (input.gratitude as string | null) ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

/**
 * Applies an optimistic patch for a queued offline mutation. Matches the
 * request URL against known endpoints and updates all affected list caches.
 */
export function applyOfflineOptimistic(
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
    if (segments.length === 1 && detail.method === "POST") {
      const todo = syntheticTodo(body, tempId);
      patchListCreate<Todo>(queryClient, ["todos"], ["todos", "full"], todo);
    } else if (segments.length === 2) {
      const id = segments[1];
      if (detail.method === "DELETE") {
        patchLists<Todo[]>(queryClient, ["todos"], (list) => removeFrom(list, id));
      } else if (detail.method === "PATCH") {
        patchLists<Todo[]>(queryClient, ["todos"], (list) =>
          mergeInto(list, id, body as Partial<Todo>),
        );
      }
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
        patchLists<Habit[]>(queryClient, ["habits"], (list) =>
          mergeInto(list, id, body as Partial<Habit>),
        );
      }
    }
    return; // toggles are optimistically handled by the views themselves
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
    return;
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
        patchLists<Note[]>(queryClient, ["notes"], (list) =>
          mergeInto(list, id, body as Partial<Note>),
        );
      }
    }
    return;
  }

  // ── Journal (upsert by date) ─────────────────────────────────────
  if (segments[0] === "journal" && segments.length === 1 && detail.method === "POST") {
    const entry = syntheticJournal(body, tempId);
    const existing = queryClient.getQueriesData<JournalEntry[]>({ queryKey: ["journal"] });
    if (existing.length === 0) {
      queryClient.setQueryData<JournalEntry[]>(["journal"], [entry]);
    } else {
      for (const [key, data] of existing) {
        if (!Array.isArray(data)) continue;
        const index = data.findIndex((e) => e.date === entry.date);
        const next =
          index === -1
            ? [...data, entry]
            : data.map((e, i) => (i === index ? { ...e, ...entry, id: e.id } : e));
        queryClient.setQueryData<JournalEntry[]>(key, next);
      }
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
        patchLists<Goal[]>(queryClient, ["goals"], (list) =>
          mergeInto(list, id, body as Partial<Goal>),
        );
      }
    }
    // progress increments are optimistically handled by the goals view
  }
}
