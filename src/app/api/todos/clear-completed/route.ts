// POST /api/todos/clear-completed → { ok: true } (deletes completed todos)

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await requireUserId();
    await db.todo.deleteMany({ where: { userId, completed: true } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
