// POST /api/todos/clear-completed → { ok: true } (deletes completed todos)

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { recordCascadeTombstones } from "@/lib/server/tombstones";
import { handleApiError, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await requireUserId();
    const completed = await db.todo.findMany({
      where: { userId, completed: true },
      select: { id: true },
    });
    for (const t of completed) {
      await recordCascadeTombstones(userId, "todos", t.id);
    }
    await db.todo.deleteMany({ where: { userId, completed: true } });
    return json({ ok: true, removed: completed.length });
  } catch (err) {
    return handleApiError(err);
  }
}
