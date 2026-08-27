// PATCH  /api/subtasks/:id { title?, completed? } → Subtask
// DELETE /api/subtasks/:id → { ok: true }

import { db } from "@/lib/db";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { subtaskUpdateSchema } from "@/lib/server/schemas";
import { serializeSubtask } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const input = parseOrThrow(subtaskUpdateSchema, await readJsonBody(req));

    const existing = await db.subtask.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new HttpError("Subtask not found", 404);

    const updated = await db.subtask.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.completed !== undefined ? { completed: input.completed } : {}),
      },
    });
    return json(serializeSubtask(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await db.subtask.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new HttpError("Subtask not found", 404);

    await db.subtask.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
