// POST /api/mobile/sync — offline-first sync endpoint for the mobile app.
//
// The phone POSTs its entire local dataset (including tombstones) and the
// server merges it with last-write-wins semantics, then returns the full
// merged dataset + tombstone list so the phone can converge to the same
// state. Datasets are personal-app sized (hundreds of rows), so full-state
// exchange keeps the protocol simple and bulletproof.

import { db } from "@/lib/db";
import { bearerUid } from "@/lib/server/mobile-jwt";
import {
  recordTombstone,
  TOMBSTONE_TTL_DAYS,
  type SyncTable,
} from "@/lib/server/tombstones";
import { json } from "@/lib/server/http";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// Zod schemas (mobile row shapes)
// ─────────────────────────────────────────────────────────────

const id64 = z.string().min(1).max(64);
const iso = z.string().min(4).max(40);
const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).max(10);
const stamp = z.object({ createdAt: iso, updatedAt: iso, deletedAt: iso.nullable().optional() });
const limit = (n: number) => z.array(z.unknown()).max(n);

const todoSchema = stamp.extend({
  id: id64,
  title: z.string().min(1).max(500),
  notes: z.string().max(50000).nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1).max(40),
  dueDate: iso.nullable(),
  reminderAt: iso.nullable(),
  repeat: z.enum(["none", "daily", "weekdays", "weekly", "monthly"]),
  completed: z.boolean(),
  completedAt: iso.nullable(),
});

const subtaskSchema = stamp.extend({
  id: id64,
  todoId: id64,
  title: z.string().min(1).max(500),
  completed: z.boolean(),
  sortOrder: z.number().int().min(-100000).max(100000),
});

const habitSchema = stamp.extend({
  id: id64,
  name: z.string().min(1).max(200),
  emoji: z.string().max(20),
  color: z.string().max(20),
  timeOfDay: z.string().max(20),
  reminderTime: z.string().max(10).nullable(),
  targetPerDay: z.number().int().min(1).max(100),
  archived: z.boolean(),
  sortOrder: z.number().int().min(-100000).max(100000),
});

const habitLogSchema = stamp.extend({
  id: id64,
  habitId: id64,
  date: dayKey,
});

const routineTaskSchema = stamp.extend({
  id: id64,
  name: z.string().min(1).max(200),
  emoji: z.string().max(20),
  section: z.enum(["morning", "afternoon", "evening"]),
  time: z.string().max(10).nullable(),
  days: z.string().max(20),
  archived: z.boolean(),
  sortOrder: z.number().int().min(-100000).max(100000),
});

const routineLogSchema = stamp.extend({
  id: id64,
  taskId: id64,
  date: dayKey,
});

const noteSchema = stamp.extend({
  id: id64,
  title: z.string().max(300),
  content: z.string().max(100000),
  tag: z.string().max(60).nullable(),
  color: z.string().max(20),
  pinned: z.boolean(),
});

const journalSchema = stamp.extend({
  id: id64,
  date: dayKey,
  title: z.string().max(300).nullable(),
  content: z.string().max(100000),
  mood: z.string().max(20).nullable(),
  energy: z.number().int().min(1).max(5).nullable(),
  gratitude: z.string().max(5000).nullable(),
});

const goalSchema = stamp.extend({
  id: id64,
  title: z.string().min(1).max(300),
  description: z.string().max(5000).nullable(),
  category: z.string().min(1).max(40),
  period: z.enum(["daily", "weekly", "monthly"]),
  target: z.number().int().min(1).max(100000),
  progress: z.number().int().min(0).max(1000000),
  unit: z.string().max(40).nullable(),
  status: z.enum(["active", "completed", "archived"]),
  startDate: dayKey,
  endDate: dayKey.nullable(),
});

const focusSchema = stamp.extend({
  id: id64,
  taskId: id64.nullable(),
  label: z.string().max(300).nullable(),
  minutes: z.number().int().min(0).max(1440),
  startedAt: iso,
  endedAt: iso,
});

const bodySchema = z.object({
  lastSyncAt: iso.nullable().optional(),
  push: z
    .object({
      todos: limit(20000),
      subtasks: limit(50000),
      habits: limit(2000),
      habitLogs: limit(100000),
      routineTasks: limit(2000),
      routineLogs: limit(100000),
      notes: limit(10000),
      journal: limit(20000),
      goals: limit(2000),
      focusSessions: limit(50000),
    })
    .partial(),
});

type TodoRow = z.infer<typeof todoSchema>;
type SubtaskRow = z.infer<typeof subtaskSchema>;
type HabitRow = z.infer<typeof habitSchema>;
type HabitLogRow = z.infer<typeof habitLogSchema>;
type RoutineTaskRow = z.infer<typeof routineTaskSchema>;
type RoutineLogRow = z.infer<typeof routineLogSchema>;
type NoteRow = z.infer<typeof noteSchema>;
type JournalRow = z.infer<typeof journalSchema>;
type GoalRow = z.infer<typeof goalSchema>;
type FocusRow = z.infer<typeof focusSchema>;

const D = (v: string | null | undefined) => (v ? new Date(v) : null);
const newer = (a: string, b: Date) => new Date(a).getTime() > b.getTime();

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const userId = bearerUid(req);
  if (!userId) {
    return json({ error: "Invalid or expired session — sign in again" }, 401);
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return json({ error: "Account no longer exists" }, 401);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }
  const parsedBody = bodySchema.safeParse(raw);
  if (!parsedBody.success) {
    return json({ error: "Malformed sync payload" }, 400);
  }
  const push = parsedBody.data.push ?? {};

  // Parse (leniently) + merge table by table. A bad row is skipped, never
  // fails the whole sync.
  const todos = z.array(todoSchema).safeParse(push.todos ?? []).success
    ? z.array(todoSchema).parse(push.todos ?? [])
    : [];
  const subtasks = z.array(subtaskSchema).safeParse(push.subtasks ?? []).success
    ? z.array(subtaskSchema).parse(push.subtasks ?? [])
    : [];
  const habits = z.array(habitSchema).safeParse(push.habits ?? []).success
    ? z.array(habitSchema).parse(push.habits ?? [])
    : [];
  const habitLogs = z.array(habitLogSchema).safeParse(push.habitLogs ?? []).success
    ? z.array(habitLogSchema).parse(push.habitLogs ?? [])
    : [];
  const routineTasks = z.array(routineTaskSchema).safeParse(push.routineTasks ?? []).success
    ? z.array(routineTaskSchema).parse(push.routineTasks ?? [])
    : [];
  const routineLogs = z.array(routineLogSchema).safeParse(push.routineLogs ?? []).success
    ? z.array(routineLogSchema).parse(push.routineLogs ?? [])
    : [];
  const notes = z.array(noteSchema).safeParse(push.notes ?? []).success
    ? z.array(noteSchema).parse(push.notes ?? [])
    : [];
  const journal = z.array(journalSchema).safeParse(push.journal ?? []).success
    ? z.array(journalSchema).parse(push.journal ?? [])
    : [];
  const goals = z.array(goalSchema).safeParse(push.goals ?? []).success
    ? z.array(goalSchema).parse(push.goals ?? [])
    : [];
  const focus = z.array(focusSchema).safeParse(push.focusSessions ?? []).success
    ? z.array(focusSchema).parse(push.focusSessions ?? [])
    : [];

  // ── todos ──────────────────────────────────────────────────
  for (const row of todos) {
    if (row.deletedAt) {
      const existing = await db.todo.findFirst({ where: { id: row.id, userId }, select: { id: true } });
      if (existing) {
        const kids = await db.subtask.findMany({ where: { todoId: row.id }, select: { id: true } });
        await db.todo.delete({ where: { id: row.id } });
        for (const k of kids) await recordTombstone(userId, "subtasks", k.id);
        await recordTombstone(userId, "todos", row.id);
      }
      continue;
    }
    const existing = await db.todo.findFirst({ where: { id: row.id, userId } });
    const data = {
      title: row.title,
      notes: row.notes,
      priority: row.priority,
      category: row.category,
      dueDate: D(row.dueDate),
      reminderAt: D(row.reminderAt),
      repeat: row.repeat,
      completed: row.completed,
      completedAt: D(row.completedAt),
      updatedAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.todo.create({ data: { ...data, userId, id: row.id, createdAt: new Date(row.createdAt) } });
    } else if (newer(row.updatedAt, existing.updatedAt)) {
      await db.todo.update({ where: { id: row.id }, data });
    }
  }

  // ── subtasks ───────────────────────────────────────────────
  for (const row of subtasks) {
    const parent = await db.todo.findFirst({ where: { id: row.todoId, userId }, select: { id: true } });
    if (!parent) continue;
    if (row.deletedAt) {
      const existing = await db.subtask.findFirst({ where: { id: row.id, todo: { userId } } });
      if (existing) {
        await db.subtask.delete({ where: { id: row.id } });
        await recordTombstone(userId, "subtasks", row.id);
      }
      continue;
    }
    const existing = await db.subtask.findFirst({ where: { id: row.id, todo: { userId } } });
    const data = {
      todoId: row.todoId,
      title: row.title,
      completed: row.completed,
      sortOrder: row.sortOrder,
      updatedAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.subtask.create({ data: { ...data, id: row.id, createdAt: new Date(row.createdAt) } });
    } else if (newer(row.updatedAt, existing.updatedAt)) {
      await db.subtask.update({ where: { id: row.id }, data });
    }
  }

  // ── habits ─────────────────────────────────────────────────
  for (const row of habits) {
    if (row.deletedAt) {
      const existing = await db.habit.findFirst({ where: { id: row.id, userId }, select: { id: true } });
      if (existing) {
        const logs = await db.habitLog.findMany({ where: { habitId: row.id }, select: { id: true } });
        await db.habit.delete({ where: { id: row.id } });
        for (const l of logs) await recordTombstone(userId, "habitLogs", l.id);
        await recordTombstone(userId, "habits", row.id);
      }
      continue;
    }
    const existing = await db.habit.findFirst({ where: { id: row.id, userId } });
    const data = {
      name: row.name,
      emoji: row.emoji,
      color: row.color,
      timeOfDay: row.timeOfDay,
      reminderTime: row.reminderTime,
      targetPerDay: row.targetPerDay,
      archived: row.archived,
      sortOrder: row.sortOrder,
      // Habit has no updatedAt column — createdAt doubles as the LWW stamp.
      createdAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.habit.create({ data: { ...data, userId, id: row.id } });
    } else if (newer(row.updatedAt, existing.createdAt)) {
      await db.habit.update({ where: { id: row.id }, data });
    }
  }

  // ── habitLogs (identity: habitId + date) ───────────────────
  for (const row of habitLogs) {
    const habit = await db.habit.findFirst({ where: { id: row.habitId, userId }, select: { id: true } });
    if (!habit) continue;
    if (row.deletedAt) {
      const existing = await db.habitLog.findFirst({ where: { habitId: row.habitId, date: row.date } });
      if (existing) {
        await db.habitLog.delete({ where: { id: existing.id } });
        await recordTombstone(userId, "habitLogs", existing.id);
      }
      continue;
    }
    const byId = await db.habitLog.findFirst({ where: { id: row.id } });
    const byKey = await db.habitLog.findFirst({ where: { habitId: row.habitId, date: row.date } });
    if (byKey && byKey.id !== row.id) {
      // Same logical log under a different id — latest wins, loser deleted.
      if (newer(row.updatedAt, byKey.createdAt)) {
        await db.habitLog.delete({ where: { id: byKey.id } });
        await recordTombstone(userId, "habitLogs", byKey.id);
        await db.habitLog.create({
          data: { id: row.id, habitId: row.habitId, date: row.date, createdAt: new Date(row.updatedAt) },
        });
      }
      continue;
    }
    if (!byKey) {
      if (!byId) {
        await db.habitLog.create({
          data: { id: row.id, habitId: row.habitId, date: row.date, createdAt: new Date(row.updatedAt) },
        });
      }
      // byId without byKey: orphaned id under a different date — ignore.
    } else if (newer(row.updatedAt, byKey.createdAt)) {
      await db.habitLog.update({
        where: { id: byKey.id },
        data: { createdAt: new Date(row.updatedAt) },
      });
    }
  }

  // ── routineTasks ───────────────────────────────────────────
  for (const row of routineTasks) {
    if (row.deletedAt) {
      const existing = await db.routineTask.findFirst({ where: { id: row.id, userId }, select: { id: true } });
      if (existing) {
        const logs = await db.routineLog.findMany({ where: { taskId: row.id }, select: { id: true } });
        await db.routineTask.delete({ where: { id: row.id } });
        for (const l of logs) await recordTombstone(userId, "routineLogs", l.id);
        await recordTombstone(userId, "routineTasks", row.id);
      }
      continue;
    }
    const existing = await db.routineTask.findFirst({ where: { id: row.id, userId } });
    const data = {
      name: row.name,
      emoji: row.emoji,
      section: row.section,
      time: row.time,
      days: row.days,
      archived: row.archived,
      sortOrder: row.sortOrder,
      createdAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.routineTask.create({ data: { ...data, userId, id: row.id } });
    } else if (newer(row.updatedAt, existing.createdAt)) {
      await db.routineTask.update({ where: { id: row.id }, data });
    }
  }

  // ── routineLogs (identity: taskId + date) ──────────────────
  for (const row of routineLogs) {
    const task = await db.routineTask.findFirst({ where: { id: row.taskId, userId }, select: { id: true } });
    if (!task) continue;
    if (row.deletedAt) {
      const existing = await db.routineLog.findFirst({ where: { taskId: row.taskId, date: row.date } });
      if (existing) {
        await db.routineLog.delete({ where: { id: existing.id } });
        await recordTombstone(userId, "routineLogs", existing.id);
      }
      continue;
    }
    const byId = await db.routineLog.findFirst({ where: { id: row.id } });
    const byKey = await db.routineLog.findFirst({ where: { taskId: row.taskId, date: row.date } });
    if (byKey && byKey.id !== row.id) {
      if (newer(row.updatedAt, byKey.createdAt)) {
        await db.routineLog.delete({ where: { id: byKey.id } });
        await recordTombstone(userId, "routineLogs", byKey.id);
        await db.routineLog.create({
          data: { id: row.id, taskId: row.taskId, date: row.date, createdAt: new Date(row.updatedAt) },
        });
      }
      continue;
    }
    if (!byKey) {
      if (!byId) {
        await db.routineLog.create({
          data: { id: row.id, taskId: row.taskId, date: row.date, createdAt: new Date(row.updatedAt) },
        });
      }
    } else if (newer(row.updatedAt, byKey.createdAt)) {
      await db.routineLog.update({
        where: { id: byKey.id },
        data: { createdAt: new Date(row.updatedAt) },
      });
    }
  }

  // ── notes ──────────────────────────────────────────────────
  for (const row of notes) {
    if (row.deletedAt) {
      const existing = await db.note.findFirst({ where: { id: row.id, userId }, select: { id: true } });
      if (existing) {
        await db.note.delete({ where: { id: row.id } });
        await recordTombstone(userId, "notes", row.id);
      }
      continue;
    }
    const existing = await db.note.findFirst({ where: { id: row.id, userId } });
    const data = {
      title: row.title,
      content: row.content,
      tag: row.tag,
      color: row.color,
      pinned: row.pinned,
      updatedAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.note.create({ data: { ...data, userId, id: row.id, createdAt: new Date(row.createdAt) } });
    } else if (newer(row.updatedAt, existing.updatedAt)) {
      await db.note.update({ where: { id: row.id }, data });
    }
  }

  // ── journal (identity: userId + date) ──────────────────────
  for (const row of journal) {
    const byDate = await db.journalEntry.findFirst({ where: { userId, date: row.date } });
    if (row.deletedAt) {
      if (byDate) {
        await db.journalEntry.delete({ where: { id: byDate.id } });
        await recordTombstone(userId, "journal", byDate.id);
      }
      continue;
    }
    const data = {
      date: row.date,
      title: row.title,
      content: row.content,
      mood: row.mood,
      energy: row.energy,
      gratitude: row.gratitude,
      updatedAt: new Date(row.updatedAt),
    };
    if (!byDate) {
      await db.journalEntry.create({
        data: { ...data, userId, id: row.id, createdAt: new Date(row.createdAt) },
      });
    } else if (byDate.id === row.id) {
      if (newer(row.updatedAt, byDate.updatedAt)) {
        await db.journalEntry.update({ where: { id: byDate.id }, data });
      }
    } else if (newer(row.updatedAt, byDate.updatedAt)) {
      // Same day under a different id: merge into the server row (the phone
      // adopts the server id when it applies the response).
      await db.journalEntry.update({ where: { id: byDate.id }, data });
      await recordTombstone(userId, "journal", row.id);
    }
  }

  // ── goals ──────────────────────────────────────────────────
  for (const row of goals) {
    if (row.deletedAt) {
      const existing = await db.goal.findFirst({ where: { id: row.id, userId }, select: { id: true } });
      if (existing) {
        await db.goal.delete({ where: { id: row.id } });
        await recordTombstone(userId, "goals", row.id);
      }
      continue;
    }
    const existing = await db.goal.findFirst({ where: { id: row.id, userId } });
    const data = {
      title: row.title,
      description: row.description,
      category: row.category,
      period: row.period,
      target: row.target,
      progress: row.progress,
      unit: row.unit,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      updatedAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.goal.create({ data: { ...data, userId, id: row.id, createdAt: new Date(row.createdAt) } });
    } else if (newer(row.updatedAt, existing.updatedAt)) {
      await db.goal.update({ where: { id: row.id }, data });
    }
  }

  // ── focusSessions ──────────────────────────────────────────
  for (const row of focus) {
    if (row.deletedAt) {
      const existing = await db.focusSession.findFirst({ where: { id: row.id, userId }, select: { id: true } });
      if (existing) {
        await db.focusSession.delete({ where: { id: row.id } });
        await recordTombstone(userId, "focusSessions", row.id);
      }
      continue;
    }
    const existing = await db.focusSession.findFirst({ where: { id: row.id, userId } });
    const data = {
      taskId: row.taskId,
      label: row.label,
      minutes: row.minutes,
      startedAt: new Date(row.startedAt),
      endedAt: new Date(row.endedAt),
      createdAt: new Date(row.updatedAt),
    };
    if (!existing) {
      await db.focusSession.create({ data: { ...data, userId, id: row.id } });
    } else if (newer(row.updatedAt, existing.createdAt)) {
      await db.focusSession.update({ where: { id: row.id }, data });
    }
  }

  // ── Respond with the merged full dataset ───────────────────
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [todoRows, subtaskRows, habitRows, habitLogRows, routineTaskRows, routineLogRows, noteRows, journalRows, goalRows, focusRows, tombstoneRows] =
    await Promise.all([
      db.todo.findMany({ where: { userId } }),
      db.subtask.findMany({ where: { todo: { userId } } }),
      db.habit.findMany({ where: { userId } }),
      db.habitLog.findMany({ where: { habit: { userId } } }),
      db.routineTask.findMany({ where: { userId } }),
      db.routineLog.findMany({ where: { task: { userId } } }),
      db.note.findMany({ where: { userId } }),
      db.journalEntry.findMany({ where: { userId } }),
      db.goal.findMany({ where: { userId } }),
      db.focusSession.findMany({ where: { userId } }),
      db.syncTombstone.findMany({
        where: { userId, deletedAt: { gte: cutoff } },
        orderBy: { deletedAt: "desc" },
        take: 2000,
      }),
    ]);

  return json({
    serverTime: new Date().toISOString(),
    data: {
      todos: todoRows.map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        priority: t.priority,
        category: t.category,
        dueDate: t.dueDate?.toISOString() ?? null,
        reminderAt: t.reminderAt?.toISOString() ?? null,
        repeat: t.repeat,
        completed: t.completed,
        completedAt: t.completedAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        deletedAt: null,
      })),
      subtasks: subtaskRows.map((s) => ({
        id: s.id,
        todoId: s.todoId,
        title: s.title,
        completed: s.completed,
        sortOrder: s.sortOrder,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        deletedAt: null,
      })),
      habits: habitRows.map((h) => ({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        timeOfDay: h.timeOfDay,
        reminderTime: h.reminderTime,
        targetPerDay: h.targetPerDay,
        archived: h.archived,
        sortOrder: h.sortOrder,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.createdAt.toISOString(),
        deletedAt: null,
      })),
      habitLogs: habitLogRows.map((l) => ({
        id: l.id,
        habitId: l.habitId,
        date: l.date,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.createdAt.toISOString(),
        deletedAt: null,
      })),
      routineTasks: routineTaskRows.map((t) => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        section: t.section,
        time: t.time,
        days: t.days,
        archived: t.archived,
        sortOrder: t.sortOrder,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.createdAt.toISOString(),
        deletedAt: null,
      })),
      routineLogs: routineLogRows.map((l) => ({
        id: l.id,
        taskId: l.taskId,
        date: l.date,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.createdAt.toISOString(),
        deletedAt: null,
      })),
      notes: noteRows.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        tag: n.tag,
        color: n.color,
        pinned: n.pinned,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        deletedAt: null,
      })),
      journal: journalRows.map((j) => ({
        id: j.id,
        date: j.date,
        title: j.title,
        content: j.content,
        mood: j.mood,
        energy: j.energy,
        gratitude: j.gratitude,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
        deletedAt: null,
      })),
      goals: goalRows.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        category: g.category,
        period: g.period,
        target: g.target,
        progress: g.progress,
        unit: g.unit,
        status: g.status,
        startDate: g.startDate,
        endDate: g.endDate,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
        deletedAt: null,
      })),
      focusSessions: focusRows.map((f) => ({
        id: f.id,
        taskId: f.taskId,
        label: f.label,
        minutes: f.minutes,
        startedAt: f.startedAt.toISOString(),
        endedAt: f.endedAt.toISOString(),
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.createdAt.toISOString(),
        deletedAt: null,
      })),
    },
    tombstones: tombstoneRows.map((t) => ({
      table: t.table as SyncTable,
      id: t.recordId,
      deletedAt: t.deletedAt.toISOString(),
    })),
  });
}
