// GET /api/routine → RoutineTask[] (non-archived; sections morning →
// afternoon → evening → anytime, then sortOrder; doneToday + streak computed)
// POST /api/routine { name, emoji?, section?, time?, days? } → RoutineTask

import { db } from "@/lib/db";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { routineCreateSchema } from "@/lib/server/schemas";
import {
  fetchRoutineTasksWithLogs,
  routineContext,
  serializeRoutineTask,
} from "@/lib/server/service";

export const dynamic = "force-dynamic";

const SECTION_WEIGHT: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  anytime: 3,
};

export async function GET() {
  try {
    const [tasks, ctx] = await Promise.all([
      fetchRoutineTasksWithLogs(),
      Promise.resolve(routineContext()),
    ]);
    const sorted = tasks.slice().sort((a, b) => {
      const sw = (SECTION_WEIGHT[a.section] ?? 9) - (SECTION_WEIGHT[b.section] ?? 9);
      if (sw !== 0) return sw;
      return a.sortOrder - b.sortOrder;
    });
    return json(sorted.map((t) => serializeRoutineTask(t, ctx)));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = parseOrThrow(routineCreateSchema, await readJsonBody(req));

    const section = input.section ?? "morning";
    const last = await db.routineTask.findFirst({
      where: { section },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const task = await db.routineTask.create({
      data: {
        name: input.name,
        emoji: input.emoji ?? "🌅",
        section,
        time: input.time ?? null,
        days: input.days ?? "1,2,3,4,5,6,7",
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
    });
    return json(serializeRoutineTask({ ...task, logs: [] }, routineContext()), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
