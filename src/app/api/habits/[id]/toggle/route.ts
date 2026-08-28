// POST /api/habits/:id/toggle { date: "YYYY-MM-DD" } → { done, streak }

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { computeStreak, todayKey } from "@/lib/server/daykeys";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { toggleSchema } from "@/lib/server/schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const { date } = parseOrThrow(toggleSchema, await readJsonBody(req));

    const habit = await db.habit.findFirst({ where: { id, userId }, select: { id: true } });
    if (!habit) throw new HttpError("Habit not found", 404);

    // Day keys are compared/unique as plain local "YYYY-MM-DD" strings.
    const existing = await db.habitLog.findUnique({
      where: { habitId_date: { habitId: id, date } },
    });

    let done: boolean;
    if (existing) {
      await db.habitLog.delete({ where: { id: existing.id } });
      done = false;
    } else {
      await db.habitLog.create({ data: { habitId: id, date } });
      done = true;
    }

    const logs = await db.habitLog.findMany({
      where: { habitId: id },
      select: { date: true },
    });
    const streak = computeStreak(new Set(logs.map((l) => l.date)), todayKey());
    return json({ done, streak });
  } catch (err) {
    return handleApiError(err);
  }
}
