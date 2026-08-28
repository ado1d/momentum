// Server-side data helpers: settings access, log fetches, and serializers
// that add the computed fields (streak / doneToday / completionsThisWeek)
// required by the contract in src/lib/types.ts.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type {
  Goal as GoalRow,
  Habit as HabitBaseRow,
  JournalEntry as JournalEntryRow,
  Note as NoteRow,
  RoutineTask as RoutineTaskBaseRow,
  Subtask as SubtaskRow,
  Todo as TodoRow,
} from "@prisma/client";
import type {
  Goal,
  Habit,
  JournalEntry,
  Note,
  RoutineTask,
  Subtask,
  Todo,
} from "@/lib/types";
import { addDaysToKey, computeStreak, isoWeekdayOfKey, todayKey, weekStartKeyOf } from "./daykeys";
import { HttpError } from "./http";

export type HabitWithLogs = HabitBaseRow & { logs: { id: string; habitId: string; date: string }[] };
export type RoutineTaskWithLogs = RoutineTaskBaseRow & {
  logs: { id: string; taskId: string; date: string }[];
};

/** A todo row with its subtasks (order preserved by query). */
export type TodoWithSubtasks = TodoRow & { subtasks: SubtaskRow[] };

/** Prisma include clause for todos that eagerly loads ordered subtasks. */
export const todoWithSubtasksInclude = {
  subtasks: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.TodoInclude;

export function serializeSubtask(s: SubtaskRow): Subtask {
  return {
    id: s.id,
    todoId: s.todoId,
    title: s.title,
    completed: s.completed,
    sortOrder: s.sortOrder,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Number of days of habit/routine logs returned in list responses. */
export const LOG_WINDOW_DAYS = 60;

/** The user's settings row (one per user), upserted with defaults when missing.
 *  A session whose User row was deleted server-side (stale cookie) resolves
 *  to 401 instead of an FK-violation 500. */
export async function getSettings(userId: string) {
  try {
    return await db.settings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003") {
        throw new HttpError("Sign in to use Momentum", 401);
      }
      // First-load burst: a brand-new user's app fires many parallel requests
      // and several hit this upsert at once. The INSERT losers collide on the
      // Settings.userId unique constraint — the winner's row is already
      // committed, so just read it instead of surfacing a 409.
      if (err.code === "P2002") {
        return db.settings.findUniqueOrThrow({ where: { userId } });
      }
    }
    throw err;
  }
}

/** Non-archived habits of the user (sortOrder ASC) with ALL logs — streaks
 *  stay exact; serializeHabit trims the returned log window to 60 days. */
export async function fetchHabitsWithLogs(userId: string): Promise<HabitWithLogs[]> {
  return db.habit.findMany({
    where: { userId, archived: false },
    orderBy: { sortOrder: "asc" },
    include: { logs: { orderBy: { date: "asc" } } },
  });
}

/** Non-archived routine tasks of the user (sortOrder ASC) with all logs. */
export async function fetchRoutineTasksWithLogs(
  userId: string,
): Promise<RoutineTaskWithLogs[]> {
  return db.routineTask.findMany({
    where: { userId, archived: false },
    orderBy: { sortOrder: "asc" },
    include: { logs: { orderBy: { date: "asc" } } },
  });
}

/** Whether a routine task's `days` string ("1,2,…,7", ISO weekdays) includes the weekday of `key`. */
export function isRoutineDay(days: string, key: string): boolean {
  const weekday = String(isoWeekdayOfKey(key));
  return days
    .split(",")
    .map((d) => d.trim())
    .includes(weekday);
}

/** Serialization context for "now" (habit needs weekStart for completionsThisWeek). */
export function routineContext(): { today: string } {
  return { today: todayKey() };
}

export async function habitContext(
  userId: string,
): Promise<{ today: string; weekStart: string }> {
  const today = todayKey();
  const settings = await getSettings(userId);
  return { today, weekStart: weekStartKeyOf(today, settings.weekStartsOn) };
}

// ── Serializers (Prisma row → contract shape) ────────────────

/** Serializes a todo; rows without an eager `subtasks` include get []. */
export function serializeTodo(t: TodoRow & { subtasks?: SubtaskRow[] }): Todo {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    priority: t.priority as Todo["priority"],
    category: t.category,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    reminderAt: t.reminderAt ? t.reminderAt.toISOString() : null,
    repeat: t.repeat as Todo["repeat"],
    completed: t.completed,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    subtasks: (t.subtasks ?? []).map(serializeSubtask),
  };
}

export function serializeHabit(
  habit: HabitWithLogs,
  ctx: { today: string; weekStart: string },
): Habit {
  const logDates = new Set(habit.logs.map((l) => l.date));
  const windowStart = addDaysToKey(ctx.today, -(LOG_WINDOW_DAYS - 1));
  const logs = habit.logs
    .filter((l) => l.date >= windowStart)
    .map((l) => ({ id: l.id, habitId: l.habitId, date: l.date }));
  return {
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji,
    color: habit.color as Habit["color"],
    timeOfDay: habit.timeOfDay as Habit["timeOfDay"],
    reminderTime: habit.reminderTime,
    targetPerDay: habit.targetPerDay,
    archived: habit.archived,
    sortOrder: habit.sortOrder,
    createdAt: habit.createdAt.toISOString(),
    logs,
    streak: computeStreak(logDates, ctx.today),
    doneToday: logDates.has(ctx.today),
    completionsThisWeek: habit.logs.filter(
      (l) => l.date >= ctx.weekStart && l.date <= ctx.today,
    ).length,
  };
}

export function serializeRoutineTask(
  task: RoutineTaskWithLogs,
  ctx: { today: string },
): RoutineTask {
  const logDates = new Set(task.logs.map((l) => l.date));
  return {
    id: task.id,
    name: task.name,
    emoji: task.emoji,
    section: task.section as RoutineTask["section"],
    time: task.time,
    days: task.days,
    archived: task.archived,
    sortOrder: task.sortOrder,
    createdAt: task.createdAt.toISOString(),
    doneToday: logDates.has(ctx.today),
    streak: computeStreak(logDates, ctx.today),
  };
}

export function serializeNote(n: NoteRow): Note {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    tag: n.tag,
    color: n.color as Note["color"],
    pinned: n.pinned,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

export function serializeJournalEntry(e: JournalEntryRow): JournalEntry {
  return {
    id: e.id,
    date: e.date,
    title: e.title,
    content: e.content,
    mood: e.mood as JournalEntry["mood"],
    energy: e.energy,
    gratitude: e.gratitude,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function serializeGoal(g: GoalRow): Goal {
  return {
    id: g.id,
    title: g.title,
    description: g.description,
    category: g.category,
    period: g.period as Goal["period"],
    target: g.target,
    progress: g.progress,
    unit: g.unit,
    status: g.status as Goal["status"],
    startDate: g.startDate,
    endDate: g.endDate,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}
