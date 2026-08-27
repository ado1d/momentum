// POST /api/habits/reorder { ids: string[] } → { ok: true }
// Sets each habit's sortOrder to its index in the given (ordered) id array.
// All ids must reference existing habits, otherwise 400.

import { z } from "zod";

import { db } from "@/lib/db";
import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({
  ids: z
    .array(z.string().min(1, "ids must be non-empty strings"))
    .min(1, "ids must contain at least one habit id")
    .max(200, "ids supports at most 200 habits")
    .refine((ids) => new Set(ids).size === ids.length, "ids must not contain duplicates"),
});

export async function POST(req: Request) {
  try {
    const input = parseOrThrow(reorderSchema, await readJsonBody(req));

    const found = await db.habit.findMany({
      where: { id: { in: input.ids } },
      select: { id: true },
    });
    const known = new Set(found.map((h) => h.id));
    const unknown = input.ids.find((id) => !known.has(id));
    if (unknown !== undefined) {
      throw new HttpError(`Unknown habit id: ${unknown}`, 400);
    }

    await db.$transaction(
      input.ids.map((id, index) =>
        db.habit.update({ where: { id }, data: { sortOrder: index } })
      )
    );

    return json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
