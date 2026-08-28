// GET /api/notes → Note[] (pinned first, then updatedAt DESC)
// POST /api/notes { title?, content?, tag?, color?, pinned? } → Note

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { noteCreateSchema } from "@/lib/server/schemas";
import { serializeNote } from "@/lib/server/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const notes = await db.note.findMany({
      where: { userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });
    return json(notes.map(serializeNote));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(noteCreateSchema, await readJsonBody(req));
    const note = await db.note.create({
      data: {
        userId,
        title: input.title && input.title.length > 0 ? input.title : "Untitled note",
        content: input.content ?? "",
        tag: input.tag ?? null,
        color: input.color ?? "default",
        pinned: input.pinned ?? false,
      },
    });
    return json(serializeNote(note), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
