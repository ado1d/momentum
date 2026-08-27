// GET /api/journal/:param → JournalEntry | null
//   The frontend calls GET /api/journal/{YYYY-MM-DD} — when the param is a
//   valid local date key the entry is looked up by date; otherwise it is
//   treated as an entry id. Missing entries return null (not 404).
// DELETE /api/journal/:id → { ok: true }

import { db } from "@/lib/db";
import { isValidDayKey } from "@/lib/server/daykeys";
import { handleApiError, HttpError, json } from "@/lib/server/http";
import { serializeJournalEntry } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const entry = isValidDayKey(id)
      ? await db.journalEntry.findUnique({ where: { date: id } })
      : await db.journalEntry.findUnique({ where: { id } });
    return json(entry ? serializeJournalEntry(entry) : null);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const existing = await db.journalEntry.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new HttpError("Journal entry not found", 404);
    await db.journalEntry.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
