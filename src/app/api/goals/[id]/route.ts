// PATCH /api/goals/:id (partial + { progress?, status? }) → Goal
//   Progress is clamped to 0..target; status auto-"completed" once
//   progress >= target (and a previously completed goal drops back to
//   "active" when its progress falls below target).
// DELETE /api/goals/:id → { ok: true }

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import type { Prisma } from "@prisma/client";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { goalUpdateSchema } from "@/lib/server/schemas";
import { serializeGoal } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const input = parseOrThrow(goalUpdateSchema, await readJsonBody(req));

    const existing = await db.goal.findFirst({ where: { id, userId } });
    if (!existing) throw new HttpError("Goal not found", 404);

    const data: Prisma.GoalUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.period !== undefined) data.period = input.period;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;

    const effectiveTarget = input.target ?? existing.target;
    if (input.target !== undefined) data.target = effectiveTarget;

    // Clamp progress into 0..target (also when the target is lowered).
    let progress = input.progress !== undefined ? input.progress : existing.progress;
    progress = Math.min(Math.max(progress, 0), effectiveTarget);
    data.progress = progress;

    if (progress >= effectiveTarget) {
      data.status = "completed";
    } else if (input.status !== undefined) {
      data.status = input.status;
    } else if (existing.status === "completed") {
      data.status = "active";
    }

    const updated = await db.goal.update({ where: { id }, data });
    return json(serializeGoal(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const existing = await db.goal.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new HttpError("Goal not found", 404);
    await db.goal.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
