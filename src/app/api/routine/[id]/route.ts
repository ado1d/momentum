// PATCH /api/routine/:id → RoutineTask
// DELETE /api/routine/:id → { ok: true }

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { recordCascadeTombstones } from "@/lib/server/tombstones";
import type { Prisma } from "@prisma/client";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { routineUpdateSchema } from "@/lib/server/schemas";
import { routineContext, serializeRoutineTask } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const input = parseOrThrow(routineUpdateSchema, await readJsonBody(req));

    const existing = await db.routineTask.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new HttpError("Routine task not found", 404);

    const data: Prisma.RoutineTaskUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.emoji !== undefined) data.emoji = input.emoji;
    if (input.section !== undefined) data.section = input.section;
    if (input.time !== undefined) data.time = input.time;
    if (input.days !== undefined) data.days = input.days;
    if (input.archived !== undefined) data.archived = input.archived;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const updated = await db.routineTask.update({
      where: { id },
      data,
      include: { logs: { orderBy: { date: "asc" } } },
    });
    return json(serializeRoutineTask(updated, routineContext()));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const existing = await db.routineTask.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new HttpError("Routine task not found", 404);
    await recordCascadeTombstones(userId, "routineTasks", id);
    await db.routineTask.delete({ where: { id } }); // logs cascade
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
