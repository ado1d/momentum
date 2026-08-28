// PATCH /api/notes/:id → Note
// DELETE /api/notes/:id → { ok: true }

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import type { Prisma } from "@prisma/client";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { noteUpdateSchema } from "@/lib/server/schemas";
import { serializeNote } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const input = parseOrThrow(noteUpdateSchema, await readJsonBody(req));

    const existing = await db.note.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new HttpError("Note not found", 404);

    const data: Prisma.NoteUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.tag !== undefined) data.tag = input.tag;
    if (input.color !== undefined) data.color = input.color;
    if (input.pinned !== undefined) data.pinned = input.pinned;

    const updated = await db.note.update({ where: { id }, data });
    return json(serializeNote(updated));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await ctx.params;
    const existing = await db.note.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new HttpError("Note not found", 404);
    await db.note.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
