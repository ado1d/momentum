// PATCH /api/habits/:id (partial + { archived }) → Habit
// DELETE /api/habits/:id → { ok: true }

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { habitUpdateSchema } from "@/lib/server/schemas";
import { habitContext, serializeHabit } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const input = parseOrThrow(habitUpdateSchema, await readJsonBody(req));

    const existing = await db.habit.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new HttpError("Habit not found", 404);

    const data: Prisma.HabitUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.emoji !== undefined) data.emoji = input.emoji;
    if (input.color !== undefined) data.color = input.color;
    if (input.timeOfDay !== undefined) data.timeOfDay = input.timeOfDay;
    if (input.reminderTime !== undefined) data.reminderTime = input.reminderTime;
    if (input.archived !== undefined) data.archived = input.archived;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const updated = await db.habit.update({
      where: { id },
      data,
      include: { logs: { orderBy: { date: "asc" } } },
    });
    const serCtx = await habitContext();
    return json(serializeHabit(updated, serCtx));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await db.habit.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new HttpError("Habit not found", 404);
    await db.habit.delete({ where: { id } }); // logs cascade
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
