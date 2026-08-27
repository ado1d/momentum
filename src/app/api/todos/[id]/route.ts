// PATCH /api/todos/:id (partial + { completed } toggling completedAt) → Todo
// DELETE /api/todos/:id → { ok: true }

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { toNullableDate, todoUpdateSchema } from "@/lib/server/schemas";
import { serializeTodo } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const input = parseOrThrow(todoUpdateSchema, await readJsonBody(req));

    const existing = await db.todo.findUnique({ where: { id } });
    if (!existing) throw new HttpError("Todo not found", 404);

    const data: Prisma.TodoUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.category !== undefined) data.category = input.category;
    const dueDate = toNullableDate(input.dueDate);
    if (dueDate !== undefined) data.dueDate = dueDate;
    const reminderAt = toNullableDate(input.reminderAt);
    if (reminderAt !== undefined) data.reminderAt = reminderAt;
    if (input.completed !== undefined) {
      data.completed = input.completed;
      // Keep the original completion timestamp when re-completing.
      data.completedAt = input.completed ? (existing.completedAt ?? new Date()) : null;
    }

    const updated = await db.todo.update({ where: { id }, data });
    return json(serializeTodo(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await db.todo.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new HttpError("Todo not found", 404);
    await db.todo.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
