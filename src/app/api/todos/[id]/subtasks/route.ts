// POST /api/todos/:id/subtasks { title } → Subtask (appended at the end)
// GET  /api/todos/:id/subtasks → Subtask[] (sortOrder ASC)

import { db } from "@/lib/db";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { subtaskCreateSchema } from "@/lib/server/schemas";
import { serializeSubtask } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const input = parseOrThrow(subtaskCreateSchema, await readJsonBody(req));

    const todo = await db.todo.findUnique({ where: { id }, select: { id: true } });
    if (!todo) throw new HttpError("Todo not found", 404);

    const last = await db.subtask.findFirst({
      where: { todoId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await db.subtask.create({
      data: { todoId: id, title: input.title, sortOrder: (last?.sortOrder ?? -1) + 1 },
    });
    return json(serializeSubtask(created), 201);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const todo = await db.todo.findUnique({ where: { id }, select: { id: true } });
    if (!todo) throw new HttpError("Todo not found", 404);

    const subtasks = await db.subtask.findMany({
      where: { todoId: id },
      orderBy: { sortOrder: "asc" },
    });
    return json(subtasks.map(serializeSubtask));
  } catch (err) {
    return handleApiError(err);
  }
}
