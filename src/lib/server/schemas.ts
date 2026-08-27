// Shared zod schemas for API request bodies and query strings.
// Mirrors src/lib/types.ts — response shapes are the contract.

import { z } from "zod";
import { isValidDayKey } from "./daykeys";

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const timeOfDaySchema = z.enum([
  "morning",
  "afternoon",
  "evening",
  "anytime",
]);
export const habitColorSchema = z.enum([
  "emerald",
  "amber",
  "rose",
  "violet",
  "teal",
  "orange",
]);
export const noteColorSchema = z.enum([
  "default",
  "yellow",
  "green",
  "rose",
  "violet",
  "teal",
]);
export const goalPeriodSchema = z.enum(["daily", "weekly", "monthly"]);
export const goalStatusSchema = z.enum(["active", "completed", "archived"]);
export const moodSchema = z.enum(["great", "good", "okay", "low", "rough"]);
export const viewIdSchema = z.enum([
  "dashboard",
  "tasks",
  "routine",
  "goals",
  "notes",
  "diary",
  "settings",
]);

/** Local day key "YYYY-MM-DD" — stays a string, never timezone-converted. */
export const dayKeySchema = z
  .string()
  .refine((v) => isValidDayKey(v), "Must be a valid YYYY-MM-DD date");

/**
 * ISO datetime input field: string | null | undefined ("" treated as null).
 * Validated here; converted to a Date afterwards via toNullableDate().
 */
export const isoDateTimeField = z
  .union([z.string(), z.null()])
  .optional()
  .refine(
    (v) =>
      v === null ||
      v === undefined ||
      v === "" ||
      !Number.isNaN(new Date(v).getTime()),
    "Invalid datetime value",
  );

/** Converts a validated ISO field to a Prisma Date (undefined = not provided). */
export function toNullableDate(
  v: string | null | undefined,
): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Date(v);
}

// ── Todos ────────────────────────────────────────────────────
export const todoCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(300),
  notes: z.string().max(20_000).nullish(),
  priority: prioritySchema.optional(),
  category: z.string().trim().min(1).max(40).optional(),
  dueDate: isoDateTimeField,
  reminderAt: isoDateTimeField,
});

export const todoUpdateSchema = todoCreateSchema.partial().extend({
  completed: z.boolean().optional(),
});

// ── Habits ───────────────────────────────────────────────────
export const habitCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  emoji: z.string().trim().min(1).max(16).optional(),
  color: habitColorSchema.optional(),
  timeOfDay: timeOfDaySchema.optional(),
  reminderTime: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, "Expected HH:MM")
    .nullish(),
});

export const habitUpdateSchema = habitCreateSchema.partial().extend({
  archived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

// ── Routine ──────────────────────────────────────────────────
export const routineCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  emoji: z.string().trim().min(1).max(16).optional(),
  section: timeOfDaySchema.optional(),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Expected HH:MM").nullish(),
  days: z
    .string()
    .regex(/^[1-7](?:,[1-7])*$/, "Expected comma-separated weekdays 1-7")
    .optional(),
});

export const routineUpdateSchema = routineCreateSchema.partial().extend({
  archived: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
});

// ── Notes ────────────────────────────────────────────────────
export const noteCreateSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().max(100_000).optional(),
  tag: z.string().trim().max(60).nullish(),
  color: noteColorSchema.optional(),
  pinned: z.boolean().optional(),
});

export const noteUpdateSchema = noteCreateSchema.partial();

// ── Journal ──────────────────────────────────────────────────
export const journalUpsertSchema = z.object({
  date: dayKeySchema,
  title: z.string().max(200).nullish(),
  content: z.string().max(100_000).optional(),
  mood: moodSchema.nullish(),
  energy: z.number().int().min(1).max(5).nullish(),
  gratitude: z.string().max(5000).nullish(),
});

// ── Goals ────────────────────────────────────────────────────
export const goalCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(10_000).nullish(),
  category: z.string().trim().min(1).max(40).optional(),
  period: goalPeriodSchema.optional(),
  target: z.number().int().min(1).max(1_000_000).optional(),
  unit: z.string().trim().max(40).nullish(),
  startDate: dayKeySchema.optional(),
  endDate: dayKeySchema.nullish(),
});

export const goalUpdateSchema = goalCreateSchema.partial().extend({
  progress: z.number().int().min(0).max(1_000_000).optional(),
  status: goalStatusSchema.optional(),
});

// ── Settings ─────────────────────────────────────────────────
export const settingsUpdateSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  defaultView: viewIdSchema.optional(),
  onboarded: z.boolean().optional(),
});

// ── Misc bodies ──────────────────────────────────────────────
export const toggleSchema = z.object({ date: dayKeySchema });

export const goalProgressSchema = z.object({
  delta: z.number().int().min(-1_000_000).max(1_000_000),
});

export const goalResetSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "all"]).optional(),
});
