// POST /api/goals/:id/progress { delta: number } → Goal
//   progress is clamped to 0..target; the goal auto-completes at the target
//   and reverts to "active" when it drops back below.

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { goalProgressSchema } from "@/lib/server/schemas";
import { serializeGoal } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const input = parseOrThrow(goalProgressSchema, await readJsonBody(req));

    const existing = await db.goal.findFirst({ where: { id, userId } });
    if (!existing) throw new HttpError("Goal not found", 404);

    const progress = Math.min(
      Math.max(existing.progress + input.delta, 0),
      existing.target,
    );
    let status = existing.status;
    if (progress >= existing.target) status = "completed";
    else if (existing.status === "completed") status = "active";

    const updated = await db.goal.update({
      where: { id },
      data: { progress, status },
    });
    return json(serializeGoal(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
