// POST /api/subtasks/reorder { ids: string[] } → { ok: true }
// Sets each subtask's sortOrder to its index in the given (ordered) id array.
// All ids must reference existing subtasks AND belong to the same todo,
// otherwise 400.

import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({
  ids: z
    .array(z.string().min(1, "ids must be non-empty strings"))
    .min(1, "ids must contain at least one subtask id")
    .max(200, "ids supports at most 200 subtasks")
    .refine((ids) => new Set(ids).size === ids.length, "ids must not contain duplicates"),
});

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(reorderSchema, await readJsonBody(req));

    // Only the user's own subtasks (ownership via the parent todo) are
    // visible; foreign ids behave like unknown ids.
    const found = await db.subtask.findMany({
      where: { id: { in: input.ids }, todo: { userId } },
      select: { id: true, todoId: true },
    });
    const byId = new Map(found.map((s) => [s.id, s]));
    const unknown = input.ids.find((id) => !byId.has(id));
    if (unknown !== undefined) {
      throw new HttpError(`Unknown subtask id: ${unknown}`, 400);
    }

    const todoIds = new Set(input.ids.map((id) => byId.get(id)!.todoId));
    if (todoIds.size > 1) {
      throw new HttpError("All subtasks must belong to the same task", 400);
    }

    await db.$transaction(
      input.ids.map((id, index) =>
        db.subtask.update({ where: { id }, data: { sortOrder: index } })
      )
    );

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
