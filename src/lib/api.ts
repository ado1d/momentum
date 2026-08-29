// Typed API client — thin fetch wrapper with consistent error handling.
// All endpoints live under /api/* and speak JSON.
//
// Offline behaviour: while the browser reports no connection (or a write
// request physically fails on the network), queueable mutations are diverted
// into the IndexedDB offline queue instead of throwing — the UI keeps
// working from optimistic cache patches and everything syncs when the
// connection returns (see lib/offline-queue.ts + offline-cache.ts).

import type {
  AppSettings,
  DashboardStats,
  FocusSession,
  FocusSessionInput,
  FocusStats,
  Goal,
  GoalInput,
  Habit,
  HabitInput,
  ImportResult,
  InsightsData,
  JournalEntry,
  JournalEntryInput,
  Note,
  NoteInput,
  RoutineTask,
  RoutineTaskInput,
  SearchResults,
  Subtask,
  SubtaskInput,
  Todo,
  TodoInput,
  ToggleResult,
  WeeklyReview,
} from "./types";
import { enqueueRequest, isQueueablePath } from "./offline-queue";

/** Marker returned in place of the server response for queued writes. */
export interface QueuedOfflineResponse {
  id?: string;
  __queuedOffline: true;
}

function randomTempId(): string {
  try {
    return `offline-${crypto.randomUUID().slice(0, 12)}`;
  } catch {
    return `offline-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Divert a mutation into the offline queue; returns a synthetic response. */
async function divertToOfflineQueue<T>(
  path: string,
  method: string,
  body: string | undefined,
): Promise<T> {
  const tempId = randomTempId();
  await enqueueRequest(path, method, body ?? null, tempId);
  window.dispatchEvent(
    new CustomEvent("momentum:offline-queued", {
      detail: { url: path, method, body: body ?? null, tempId },
    }),
  );
  return { id: tempId, __queuedOffline: true } as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const requestBody = typeof options.body === "string" ? options.body : undefined;

  // Proactive offline check — the browser already knows there's no network.
  if (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !navigator.onLine &&
    method !== "GET" &&
    isQueueablePath(path)
  ) {
    return divertToOfflineQueue<T>(path, method, requestBody);
  }

  let res: Response;
  try {
    res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    // Reactive offline path — navigator.onLine lied (flaky connection):
    // a physical network failure on a queueable write also queues it.
    if (method !== "GET" && isQueueablePath(path) && typeof window !== "undefined") {
      return divertToOfflineQueue<T>(path, method, requestBody);
    }
    throw new ApiError("You're offline and this request can't be queued", 0);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `Request failed (${res.status})`;
    // 401 → notify the app (providers.tsx listens for "momentum:unauthorized"
    // and cancels/clears the TanStack cache, stopping retry storms). We do NOT
    // force signOut here — the session may still be valid while one route
    // hiccuped; useSession polling + page.tsx gating decide the final state.
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("momentum:unauthorized"));
    }
    throw new ApiError(message, res.status);
  }
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });
const patch = <T>(path: string, data: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(data) });
const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

// ── Todos ────────────────────────────────────────────────────
export const todosApi = {
  list: (params?: { status?: "all" | "active" | "completed"; category?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.category) q.set("category", params.category);
    const qs = q.toString();
    return get<Todo[]>(`/api/todos${qs ? `?${qs}` : ""}`);
  },
  create: (input: TodoInput) => post<Todo>("/api/todos", input),
  update: (id: string, patchBody: Partial<TodoInput> & { completed?: boolean }) =>
    patch<Todo>(`/api/todos/${id}`, patchBody),
  remove: (id: string) => del<{ ok: boolean }>(`/api/todos/${id}`),
  clearCompleted: () => post<{ ok: boolean }>("/api/todos/clear-completed"),
};

// ── Subtasks (checklists inside a task) ─────────────────────
export const subtasksApi = {
  list: (todoId: string) => get<Subtask[]>(`/api/todos/${todoId}/subtasks`),
  create: (todoId: string, input: SubtaskInput) =>
    post<Subtask>(`/api/todos/${todoId}/subtasks`, input),
  update: (id: string, patchBody: { title?: string; completed?: boolean }) =>
    patch<Subtask>(`/api/subtasks/${id}`, patchBody),
  remove: (id: string) => del<{ ok: boolean }>(`/api/subtasks/${id}`),
  reorder: (ids: string[]) =>
    post<{ ok: boolean }>("/api/subtasks/reorder", { ids }),
};

// ── Habits ───────────────────────────────────────────────────
export const habitsApi = {
  list: () => get<Habit[]>("/api/habits"),
  create: (input: HabitInput) => post<Habit>("/api/habits", input),
  update: (id: string, patchBody: Partial<HabitInput> & { archived?: boolean }) =>
    patch<Habit>(`/api/habits/${id}`, patchBody),
  remove: (id: string) => del<{ ok: boolean }>(`/api/habits/${id}`),
  toggle: (id: string, date: string) =>
    post<ToggleResult>(`/api/habits/${id}/toggle`, { date }),
  reorder: (ids: string[]) =>
    post<{ ok: boolean }>("/api/habits/reorder", { ids }),
};

// ── Routine ──────────────────────────────────────────────────
export const routineApi = {
  list: () => get<RoutineTask[]>("/api/routine"),
  create: (input: RoutineTaskInput) => post<RoutineTask>("/api/routine", input),
  update: (id: string, patchBody: Partial<RoutineTaskInput> & { archived?: boolean }) =>
    patch<RoutineTask>(`/api/routine/${id}`, patchBody),
  remove: (id: string) => del<{ ok: boolean }>(`/api/routine/${id}`),
  toggle: (id: string, date: string) =>
    post<ToggleResult>(`/api/routine/${id}/toggle`, { date }),
};

// ── Notes ────────────────────────────────────────────────────
export const notesApi = {
  list: () => get<Note[]>("/api/notes"),
  create: (input: NoteInput) => post<Note>("/api/notes", input),
  update: (id: string, patchBody: Partial<NoteInput>) =>
    patch<Note>(`/api/notes/${id}`, patchBody),
  remove: (id: string) => del<{ ok: boolean }>(`/api/notes/${id}`),
};

// ── Journal ──────────────────────────────────────────────────
export const journalApi = {
  list: (params?: { limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return get<JournalEntry[]>(`/api/journal${qs ? `?${qs}` : ""}`);
  },
  /** Entries for a calendar month ("YYYY-MM"), oldest first. */
  month: (monthKey: string) =>
    get<JournalEntry[]>(`/api/journal?month=${encodeURIComponent(monthKey)}`),
  get: (date: string) => get<JournalEntry | null>(`/api/journal/${date}`),
  upsert: (input: JournalEntryInput) => post<JournalEntry>("/api/journal", input),
  remove: (id: string) => del<{ ok: boolean }>(`/api/journal/${id}`),
};

// ── Goals ────────────────────────────────────────────────────
export const goalsApi = {
  list: (params?: { status?: string; period?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.period) q.set("period", params.period);
    const qs = q.toString();
    return get<Goal[]>(`/api/goals${qs ? `?${qs}` : ""}`);
  },
  create: (input: GoalInput) => post<Goal>("/api/goals", input),
  update: (
    id: string,
    patchBody: Partial<GoalInput> & { progress?: number; status?: string }
  ) => patch<Goal>(`/api/goals/${id}`, patchBody),
  increment: (id: string, delta: number) =>
    post<Goal>(`/api/goals/${id}/progress`, { delta }),
  remove: (id: string) => del<{ ok: boolean }>(`/api/goals/${id}`),
  resetPeriodProgress: () => post<{ ok: boolean }>("/api/goals/reset-period"),
};

// ── Stats / Dashboard ────────────────────────────────────────
export const statsApi = {
  dashboard: () => get<DashboardStats>("/api/stats"),
  insights: () => get<InsightsData>("/api/insights"),
};

// ── Weekly review (generated summary) ──────────────────────
export const reviewApi = {
  get: (week?: string) => {
    const qs = week ? `?week=${encodeURIComponent(week)}` : "";
    return get<WeeklyReview>(`/api/review${qs}`);
  },
};

// ── Backup import ───────────────────────────────────────────
export const importApi = {
  restore: (data: unknown, mode: "merge" | "replace") =>
    post<ImportResult>("/api/import", { mode, data }),
};

// ── Global search (command palette) ──────────────────────────
export const searchApi = {
  query: (q: string) => {
    const qs = new URLSearchParams({ q });
    return get<SearchResults>(`/api/search?${qs.toString()}`);
  },
};

// ── Focus sessions (Pomodoro) ────────────────────────────────
export const focusApi = {
  stats: () => get<FocusStats>("/api/focus"),
  log: (input: FocusSessionInput) => post<FocusSession>("/api/focus", input),
};

// ── Settings ─────────────────────────────────────────────────
export const settingsApi = {
  get: () => get<AppSettings>("/api/settings"),
  update: (patchBody: Partial<AppSettings>) =>
    patch<AppSettings>("/api/settings", patchBody),
};

// ── Export ───────────────────────────────────────────────────
export const exportApi = {
  markdown: (scope: string) =>
    fetch(`/api/export?format=markdown&scope=${encodeURIComponent(scope)}`).then(
      async (r) => {
        if (!r.ok) throw new ApiError("Export failed", r.status);
        return r.text();
      }
    ),
  json: () =>
    fetch("/api/export?format=json&scope=all").then(async (r) => {
      if (!r.ok) throw new ApiError("Export failed", r.status);
      return r.text();
    }),
};
