// POST /api/goals/reset-period { period?: "daily"|"weekly"|"monthly"|"all" }
//   → { ok: true }
//   Resets progress to 0 and status to "active" for goals of that period
//   (archived goals stay untouched). With no period given, all non-archived
//   goals are reset — the frontend client sends an empty body.

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { goalResetSchema } from "@/lib/server/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const input = parseOrThrow(goalResetSchema, await readJsonBody(req));
    const period = input.period && input.period !== "all" ? input.period : undefined;

    const where: Prisma.GoalWhereInput = { status: { not: "archived" } };
    if (period) where.period = period;

    await db.goal.updateMany({
      where,
      data: { progress: 0, status: "active" },
    });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
