// GET /api/journal?limit=50 → JournalEntry[] (date DESC)
// GET /api/journal?month=YYYY-MM → JournalEntry[] for that calendar month only
//   (date ASC — oldest first; limit is ignored, a month is ≤31 entries)
// POST /api/journal { date, title?, content?, mood?, energy?, gratitude? }
//   → JournalEntry (UPSERT by unique local date key; absent fields keep their
//   current value on update, explicit null clears them)

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { journalUpsertSchema } from "@/lib/server/schemas";
import { serializeJournalEntry } from "@/lib/server/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const monthKeySchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format");

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  month: monthKeySchema.optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    const rawMonth = url.searchParams.get("month");
    const query = parseOrThrow(listQuerySchema, {
      limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
      month: rawMonth === null || rawMonth === "" ? undefined : rawMonth,
    });

    // Month view: entries for that calendar month only, oldest first
    // (calendar grids read better ASC). `limit` is intentionally ignored.
    if (query.month) {
      const [year, month] = query.month.split("-").map(Number);
      // Day 0 of the following month = last day of the requested month
      // (local-safe pure arithmetic, no timezone conversion).
      const lastDay = new Date(year, month, 0).getDate();
      const entries = await db.journalEntry.findMany({
        where: {
          date: {
            gte: `${query.month}-01`,
            lte: `${query.month}-${String(lastDay).padStart(2, "0")}`,
          },
        },
        orderBy: { date: "asc" },
      });
      return json(entries.map(serializeJournalEntry));
    }

    const entries = await db.journalEntry.findMany({
      orderBy: { date: "desc" },
      take: query.limit ?? 50,
    });
    return json(entries.map(serializeJournalEntry));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const input = parseOrThrow(journalUpsertSchema, await readJsonBody(req));

    const update: Prisma.JournalEntryUpdateInput = {};
    if (input.title !== undefined) update.title = input.title;
    if (input.content !== undefined) update.content = input.content;
    if (input.mood !== undefined) update.mood = input.mood;
    if (input.energy !== undefined) update.energy = input.energy;
    if (input.gratitude !== undefined) update.gratitude = input.gratitude;

    const entry = await db.journalEntry.upsert({
      where: { date: input.date },
      create: {
        date: input.date,
        title: input.title ?? null,
        content: input.content ?? "",
        mood: input.mood ?? null,
        energy: input.energy ?? null,
        gratitude: input.gratitude ?? null,
      },
      update,
    });
    return json(serializeJournalEntry(entry));
  } catch (err) {
    return handleApiError(err);
  }
}
