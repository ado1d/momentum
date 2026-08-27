// GET /api/habits → Habit[] (non-archived, sortOrder ASC; each with logs from
// the last 60 days plus computed streak / doneToday / completionsThisWeek)
// POST /api/habits { name, emoji?, color?, timeOfDay?, reminderTime? } → Habit

import { db } from "@/lib/db";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { habitCreateSchema } from "@/lib/server/schemas";
import {
  fetchHabitsWithLogs,
  habitContext,
  serializeHabit,
} from "@/lib/server/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [habits, ctx] = await Promise.all([fetchHabitsWithLogs(), habitContext()]);
    return json(habits.map((h) => serializeHabit(h, ctx)));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = parseOrThrow(habitCreateSchema, await readJsonBody(req));

    const last = await db.habit.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const habit = await db.habit.create({
      data: {
        name: input.name,
        emoji: input.emoji ?? "✅",
        color: input.color ?? "emerald",
        timeOfDay: input.timeOfDay ?? "anytime",
        reminderTime: input.reminderTime ?? null,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    const ctx = await habitContext();
    return json(serializeHabit({ ...habit, logs: [] }, ctx), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
