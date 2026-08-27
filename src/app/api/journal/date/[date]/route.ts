// GET /api/journal/date/:date → JournalEntry | null
//   Single entry lookup by local "YYYY-MM-DD" date key (day keys are plain
//   strings — never converted through timezone-shifting Date objects).

import { db } from "@/lib/db";
import { isValidDayKey } from "@/lib/server/daykeys";
import { handleApiError, HttpError, json } from "@/lib/server/http";
import { serializeJournalEntry } from "@/lib/server/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ date: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { date } = await ctx.params;
    if (!isValidDayKey(date)) {
      throw new HttpError("Invalid date — expected a YYYY-MM-DD day key", 400);
    }
    const entry = await db.journalEntry.findUnique({ where: { date } });
    return json(entry ? serializeJournalEntry(entry) : null);
  } catch (err) {
    return handleApiError(err);
  }
}
