// GET /api/journal?limit=50 → JournalEntry[] (date DESC)
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

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    const query = parseOrThrow(listQuerySchema, {
      limit: rawLimit === null || rawLimit === "" ? undefined : rawLimit,
    });
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
