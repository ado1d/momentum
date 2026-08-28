// POST /api/routine/:id/toggle { date: "YYYY-MM-DD" } → { done, streak? }

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

    const task = await db.routineTask.findFirst({ where: { id, userId }, select: { id: true } });
    if (!task) throw new HttpError("Routine task not found", 404);

    const existing = await db.routineLog.findUnique({
      where: { taskId_date: { taskId: id, date } },
    });

    let done: boolean;
    if (existing) {
      await db.routineLog.delete({ where: { id: existing.id } });
      done = false;
    } else {
      await db.routineLog.create({ data: { taskId: id, date } });
      done = true;
    }

    const logs = await db.routineLog.findMany({
      where: { taskId: id },
      select: { date: true },
    });
    const streak = computeStreak(new Set(logs.map((l) => l.date)), todayKey());
    return json({ done, streak });
  } catch (err) {
    return handleApiError(err);
  }
}
