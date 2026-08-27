// POST /api/todos/clear-completed → { ok: true } (deletes completed todos)

import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await db.todo.deleteMany({ where: { completed: true } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
