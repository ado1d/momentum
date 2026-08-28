// Backup import — validates and restores a JSON backup produced by
// GET /api/export?format=json (round-trip disaster recovery).
//
// Two modes (both scoped to the importing user's rows — other users' data is
// never touched):
//  - "replace": wipe every one of the user's rows, then insert the backup rows
//    verbatim (ids + timestamps preserved). The user's settings row is
//    overwritten too.
//  - "merge":   insert only rows whose id (or journal date) doesn't exist yet
//    in the user's data; existing data is never modified. Skipped rows are
//    counted.
//
// Validation is zod-based with tolerant defaults so older backups (e.g.
// without Todo.repeat or subtasks) still import cleanly. All writes run in
// a single interactive transaction — a failure rolls everything back.

import { db } from "@/lib/db";
import { z } from "zod";

// ── helpers ──────────────────────────────────────────────────

const isoField = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid datetime");

const nullableIso = isoField.nullable();

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

function toDate(v: string | null): Date | null {
  return v === null ? null : new Date(v);
}

// ── row schemas (tolerant: missing optional fields get defaults) ──

const subtaskRow = z.object({
  id: z.string().min(1),
  todoId: z.string().min(1),
  title: z.string().min(1),
  completed: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  createdAt: isoField,
  updatedAt: isoField,
});

const todoRow = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  notes: z.string().nullish().default(null),
  priority: z.string().default("medium"),
  category: z.string().default("personal"),
  dueDate: nullableIso.default(null),
  reminderAt: nullableIso.default(null),
  repeat: z.string().nullish().default("none"),
  completed: z.boolean().default(false),
  completedAt: nullableIso.default(null),
  createdAt: isoField,
  updatedAt: isoField,
  subtasks: z.array(subtaskRow).default([]), // nested (v2 backups may also use the top-level list)
});

const habitLogRow = z.object({
  id: z.string().min(1).optional(),
  habitId: z.string().min(1).optional(),
  date: dayKey,
});

const habitRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().default("✅"),
  color: z.string().default("emerald"),
  timeOfDay: z.string().default("anytime"),
  reminderTime: z.string().nullish().default(null),
  targetPerDay: z.number().int().min(1).default(1),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  createdAt: isoField,
  logs: z.array(habitLogRow).default([]),
});

const routineLogRow = z.object({
  id: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  date: dayKey,
});

const routineTaskRow = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  emoji: z.string().default("🌅"),
  section: z.string().default("morning"),
  time: z.string().nullish().default(null),
  days: z.string().default("1,2,3,4,5,6,7"),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  createdAt: isoField,
  logs: z.array(routineLogRow).default([]),
});

const noteRow = z.object({
  id: z.string().min(1),
  title: z.string().default("Untitled note"),
  content: z.string().default(""),
  tag: z.string().nullish().default(null),
  color: z.string().default("default"),
  pinned: z.boolean().default(false),
  createdAt: isoField,
  updatedAt: isoField,
});

const journalRow = z.object({
  id: z.string().min(1),
  date: dayKey,
  title: z.string().nullish().default(null),
  content: z.string().default(""),
  mood: z.string().nullish().default(null),
  energy: z.number().int().min(1).max(5).nullish().default(null),
  gratitude: z.string().nullish().default(null),
  createdAt: isoField,
  updatedAt: isoField,
});

const goalRow = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullish().default(null),
  category: z.string().default("learning"),
  period: z.string().default("weekly"),
  target: z.number().int().min(1).default(1),
  progress: z.number().int().min(0).default(0),
  unit: z.string().nullish().default(null),
  status: z.string().default("active"),
  startDate: dayKey,
  endDate: dayKey.nullish().default(null),
  createdAt: isoField,
  updatedAt: isoField,
});

const settingsRow = z
  .object({
    notificationsEnabled: z.boolean().optional(),
    soundEnabled: z.boolean().optional(),
    weekStartsOn: z.number().int().min(0).max(6).optional(),
    defaultView: z.string().optional(),
    onboarded: z.boolean().optional(),
  })
  .partial();

export const backupSchema = z.object({
  app: z.string().optional(),
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  todos: z.array(todoRow).max(50_000).default([]),
  subtasks: z.array(subtaskRow).max(200_000).default([]), // v2 top-level list
  habits: z.array(habitRow).max(5_000).default([]),
  routineTasks: z.array(routineTaskRow).max(5_000).default([]),
  notes: z.array(noteRow).max(50_000).default([]),
  journal: z.array(journalRow).max(50_000).default([]),
  goals: z.array(goalRow).max(10_000).default([]),
  settings: settingsRow.optional(),
});

export type BackupPayload = z.infer<typeof backupSchema>;

export interface ImportCounts {
  todos: number;
  habits: number;
  routineTasks: number;
  notes: number;
  journal: number;
  goals: number;
  skipped: number;
}

export interface ImportOutcome {
  counts: ImportCounts;
  message: string;
}

// ── import execution ─────────────────────────────────────────

export async function runImport(
  payload: BackupPayload,
  mode: "merge" | "replace",
  userId: string,
): Promise<ImportOutcome> {
  const counts: ImportCounts = {
    todos: 0,
    habits: 0,
    routineTasks: 0,
    notes: 0,
    journal: 0,
    goals: 0,
    skipped: 0,
  };

  // Merge nested subtasks (per-todo) with the v2 top-level list; per-todo
  // nesting wins on conflict, todoId must reference a todo in the backup.
  const todoIds = new Set(payload.todos.map((t) => t.id));
  const subtaskMap = new Map<string, typeof payload.subtasks>();
  for (const s of payload.subtasks) {
    if (!todoIds.has(s.todoId)) continue;
    const list = subtaskMap.get(s.todoId) ?? [];
    list.push(s);
    subtaskMap.set(s.todoId, list);
  }
  for (const t of payload.todos) {
    if (t.subtasks.length > 0) subtaskMap.set(t.id, t.subtasks);
  }

  // ── REPLACE: wipe the user's rows + insert verbatim ─────────
  if (mode === "replace") {
    await db.$transaction(async (tx) => {
      // Child tables first (FK order; cascades would also handle it). Every
      // wipe is scoped to the importing user — other users' rows are never
      // touched (child tables via their parent relation filter).
      await tx.subtask.deleteMany({ where: { todo: { userId } } });
      await tx.todo.deleteMany({ where: { userId } });
      await tx.habitLog.deleteMany({ where: { habit: { userId } } });
      await tx.habit.deleteMany({ where: { userId } });
      await tx.routineLog.deleteMany({ where: { task: { userId } } });
      await tx.routineTask.deleteMany({ where: { userId } });
      await tx.note.deleteMany({ where: { userId } });
      await tx.journalEntry.deleteMany({ where: { userId } });
      await tx.goal.deleteMany({ where: { userId } });

      for (const t of payload.todos) {
        await tx.todo.create({
          data: {
            id: t.id,
            userId,
            title: t.title,
            notes: t.notes ?? null,
            priority: t.priority,
            category: t.category,
            dueDate: toDate(t.dueDate),
            reminderAt: toDate(t.reminderAt),
            repeat: t.repeat ?? "none",
            completed: t.completed,
            completedAt: toDate(t.completedAt),
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
          },
        });
        const subs = subtaskMap.get(t.id) ?? [];
        for (const [i, s] of subs.entries()) {
          await tx.subtask.create({
            data: {
              id: s.id,
              todoId: t.id,
              title: s.title,
              completed: s.completed,
              sortOrder: s.sortOrder ?? i,
              createdAt: new Date(s.createdAt),
              updatedAt: new Date(s.updatedAt),
            },
          });
        }
      }
      counts.todos = payload.todos.length;

      for (const h of payload.habits) {
        await tx.habit.create({
          data: {
            id: h.id,
            userId,
            name: h.name,
            emoji: h.emoji,
            color: h.color,
            timeOfDay: h.timeOfDay,
            reminderTime: h.reminderTime ?? null,
            targetPerDay: h.targetPerDay,
            archived: h.archived,
            sortOrder: h.sortOrder,
            createdAt: new Date(h.createdAt),
          },
        });
        // Dedupe logs by date within the backup (unique constraint).
        const seen = new Set<string>();
        for (const l of h.logs) {
          if (seen.has(l.date)) continue;
          seen.add(l.date);
          await tx.habitLog.create({ data: { habitId: h.id, date: l.date } });
        }
      }
      counts.habits = payload.habits.length;

      for (const t of payload.routineTasks) {
        await tx.routineTask.create({
          data: {
            id: t.id,
            userId,
            name: t.name,
            emoji: t.emoji,
            section: t.section,
            time: t.time ?? null,
            days: t.days,
            archived: t.archived,
            sortOrder: t.sortOrder,
            createdAt: new Date(t.createdAt),
          },
        });
        const seen = new Set<string>();
        for (const l of t.logs) {
          if (seen.has(l.date)) continue;
          seen.add(l.date);
          await tx.routineLog.create({ data: { taskId: t.id, date: l.date } });
        }
      }
      counts.routineTasks = payload.routineTasks.length;

      for (const n of payload.notes) {
        await tx.note.create({
          data: {
            id: n.id,
            userId,
            title: n.title,
            content: n.content,
            tag: n.tag ?? null,
            color: n.color,
            pinned: n.pinned,
            createdAt: new Date(n.createdAt),
            updatedAt: new Date(n.updatedAt),
          },
        });
      }
      counts.notes = payload.notes.length;

      for (const e of payload.journal) {
        await tx.journalEntry.create({
          data: {
            id: e.id,
            userId,
            date: e.date,
            title: e.title ?? null,
            content: e.content,
            mood: e.mood ?? null,
            energy: e.energy ?? null,
            gratitude: e.gratitude ?? null,
            createdAt: new Date(e.createdAt),
            updatedAt: new Date(e.updatedAt),
          },
        });
      }
      counts.journal = payload.journal.length;

      for (const g of payload.goals) {
        await tx.goal.create({
          data: {
            id: g.id,
            userId,
            title: g.title,
            description: g.description ?? null,
            category: g.category,
            period: g.period,
            target: g.target,
            progress: g.progress,
            unit: g.unit ?? null,
            status: g.status,
            startDate: g.startDate,
            endDate: g.endDate ?? null,
            createdAt: new Date(g.createdAt),
            updatedAt: new Date(g.updatedAt),
          },
        });
      }
      counts.goals = payload.goals.length;

      if (payload.settings) {
        const s = payload.settings;
        await tx.settings.upsert({
          where: { userId },
          create: {
            userId,
            ...(s.notificationsEnabled !== undefined
              ? { notificationsEnabled: s.notificationsEnabled }
              : {}),
            ...(s.soundEnabled !== undefined ? { soundEnabled: s.soundEnabled } : {}),
            ...(s.weekStartsOn !== undefined ? { weekStartsOn: s.weekStartsOn } : {}),
            ...(s.defaultView !== undefined ? { defaultView: s.defaultView } : {}),
            ...(s.onboarded !== undefined ? { onboarded: s.onboarded } : {}),
          },
          update: {
            ...(s.notificationsEnabled !== undefined
              ? { notificationsEnabled: s.notificationsEnabled }
              : {}),
            ...(s.soundEnabled !== undefined ? { soundEnabled: s.soundEnabled } : {}),
            ...(s.weekStartsOn !== undefined ? { weekStartsOn: s.weekStartsOn } : {}),
            ...(s.defaultView !== undefined ? { defaultView: s.defaultView } : {}),
            ...(s.onboarded !== undefined ? { onboarded: s.onboarded } : {}),
          },
        });
      }
    });

    return {
      counts,
      message: `Restored backup (replace): ${counts.todos} tasks, ${counts.habits} habits, ${counts.notes} notes, ${counts.journal} journal entries, ${counts.goals} goals.`,
    };
  }

  // ── MERGE: add only rows whose id/date doesn't exist yet ────
  await db.$transaction(async (tx) => {
    // Dupe checks are scoped to the importing user's own rows.
    const existingTodoIds = new Set(
      (await tx.todo.findMany({ where: { userId }, select: { id: true } })).map(
        (t) => t.id,
      ),
    );
    const existingHabitIds = new Set(
      (await tx.habit.findMany({ where: { userId }, select: { id: true } })).map(
        (h) => h.id,
      ),
    );
    const existingRoutineIds = new Set(
      (await tx.routineTask.findMany({ where: { userId }, select: { id: true } })).map(
        (t) => t.id,
      ),
    );
    const existingNoteIds = new Set(
      (await tx.note.findMany({ where: { userId }, select: { id: true } })).map(
        (n) => n.id,
      ),
    );
    const existingJournalDates = new Set(
      (await tx.journalEntry.findMany({ where: { userId }, select: { date: true } })).map(
        (j) => j.date,
      ),
    );
    const existingGoalIds = new Set(
      (await tx.goal.findMany({ where: { userId }, select: { id: true } })).map(
        (g) => g.id,
      ),
    );

    for (const t of payload.todos) {
      if (existingTodoIds.has(t.id)) {
        counts.skipped += 1;
        continue;
      }
      await tx.todo.create({
        data: {
          id: t.id,
          userId,
          title: t.title,
          notes: t.notes ?? null,
          priority: t.priority,
          category: t.category,
          dueDate: toDate(t.dueDate),
          reminderAt: toDate(t.reminderAt),
          repeat: t.repeat ?? "none",
          completed: t.completed,
          completedAt: toDate(t.completedAt),
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        },
      });
      for (const [i, s] of (subtaskMap.get(t.id) ?? []).entries()) {
        await tx.subtask.create({
          data: {
            todoId: t.id,
            title: s.title,
            completed: s.completed,
            sortOrder: s.sortOrder ?? i,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
          },
        });
      }
      counts.todos += 1;
    }

    for (const h of payload.habits) {
      if (existingHabitIds.has(h.id)) {
        counts.skipped += 1;
        continue;
      }
      await tx.habit.create({
        data: {
          id: h.id,
          userId,
          name: h.name,
          emoji: h.emoji,
          color: h.color,
          timeOfDay: h.timeOfDay,
          reminderTime: h.reminderTime ?? null,
          targetPerDay: h.targetPerDay,
          archived: h.archived,
          sortOrder: h.sortOrder,
          createdAt: new Date(h.createdAt),
        },
      });
      const existingDates = new Set(
        (
          await tx.habitLog.findMany({
            where: { habitId: h.id },
            select: { date: true },
          })
        ).map((l) => l.date),
      );
      const seen = new Set<string>();
      for (const l of h.logs) {
        if (seen.has(l.date) || existingDates.has(l.date)) continue;
        seen.add(l.date);
        await tx.habitLog.create({ data: { habitId: h.id, date: l.date } });
      }
      counts.habits += 1;
    }

    for (const t of payload.routineTasks) {
      if (existingRoutineIds.has(t.id)) {
        counts.skipped += 1;
        continue;
      }
      await tx.routineTask.create({
        data: {
          id: t.id,
          userId,
          name: t.name,
          emoji: t.emoji,
          section: t.section,
          time: t.time ?? null,
          days: t.days,
          archived: t.archived,
          sortOrder: t.sortOrder,
          createdAt: new Date(t.createdAt),
        },
      });
      const seen = new Set<string>();
      for (const l of t.logs) {
        if (seen.has(l.date)) continue;
        seen.add(l.date);
        await tx.routineLog.create({ data: { taskId: t.id, date: l.date } });
      }
      counts.routineTasks += 1;
    }

    for (const n of payload.notes) {
      if (existingNoteIds.has(n.id)) {
        counts.skipped += 1;
        continue;
      }
      await tx.note.create({
        data: {
          id: n.id,
          userId,
          title: n.title,
          content: n.content,
          tag: n.tag ?? null,
          color: n.color,
          pinned: n.pinned,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        },
      });
      counts.notes += 1;
    }

    for (const e of payload.journal) {
      if (existingJournalDates.has(e.date)) {
        counts.skipped += 1;
        continue;
      }
      await tx.journalEntry.create({
        data: {
          id: e.id,
          userId,
          date: e.date,
          title: e.title ?? null,
          content: e.content,
          mood: e.mood ?? null,
          energy: e.energy ?? null,
          gratitude: e.gratitude ?? null,
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        },
      });
      counts.journal += 1;
    }

    for (const g of payload.goals) {
      if (existingGoalIds.has(g.id)) {
        counts.skipped += 1;
        continue;
      }
      await tx.goal.create({
        data: {
          id: g.id,
          userId,
          title: g.title,
          description: g.description ?? null,
          category: g.category,
          period: g.period,
          target: g.target,
          progress: g.progress,
          unit: g.unit ?? null,
          status: g.status,
          startDate: g.startDate,
          endDate: g.endDate ?? null,
          createdAt: new Date(g.createdAt),
          updatedAt: new Date(g.updatedAt),
        },
      });
      counts.goals += 1;
    }
  });

  const imported =
    counts.todos +
    counts.habits +
    counts.routineTasks +
    counts.notes +
    counts.journal +
    counts.goals;
  return {
    counts,
    message:
      imported === 0 && counts.skipped > 0
        ? `Everything in the backup already exists — nothing imported (${counts.skipped} skipped).`
        : `Merged ${imported} item${imported === 1 ? "" : "s"} from backup (${counts.skipped} skipped — already present).`,
  };
}
