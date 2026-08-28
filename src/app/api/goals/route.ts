// GET /api/goals?status=&period= → Goal[]
//   No status / status=all → everything, ordered active first, createdAt DESC.
// POST /api/goals { title, description?, category?, period?, target?, unit?,
//                   startDate?, endDate? } → Goal

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import type { Prisma } from "@prisma/client";
import { todayKey } from "@/lib/server/daykeys";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { goalCreateSchema } from "@/lib/server/schemas";
import { serializeGoal } from "@/lib/server/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const GOAL_STATUS_WEIGHT: Record<string, number> = { active: 0, completed: 1, archived: 2 };

const listQuerySchema = z.object({
  status: z.enum(["active", "completed", "archived", "all"]).optional(),
  period: z.enum(["daily", "weekly", "monthly", "all"]).optional(),
});

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const query = parseOrThrow(listQuerySchema, {
      status: url.searchParams.get("status") ?? undefined,
      period: url.searchParams.get("period") ?? undefined,
    });

    const where: Prisma.GoalWhereInput = { userId };
    if (query.status && query.status !== "all") where.status = query.status;
    if (query.period && query.period !== "all") where.period = query.period;

    const goals = await db.goal.findMany({ where });
    goals.sort((a, b) => {
      const sw = (GOAL_STATUS_WEIGHT[a.status] ?? 3) - (GOAL_STATUS_WEIGHT[b.status] ?? 3);
      if (sw !== 0) return sw;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return json(goals.map(serializeGoal));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(goalCreateSchema, await readJsonBody(req));
    const goal = await db.goal.create({
      data: {
        userId,
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "learning",
        period: input.period ?? "weekly",
        target: input.target ?? 1,
        progress: 0,
        unit: input.unit ?? null,
        status: "active",
        startDate: input.startDate ?? todayKey(),
        endDate: input.endDate ?? null,
      },
    });
    return json(serializeGoal(goal), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
