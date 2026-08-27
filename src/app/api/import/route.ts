// POST /api/import { mode: "merge" | "replace", data: <backup JSON> }
//   → ImportResult
//
// Restores a JSON backup produced by GET /api/export?format=json.
// - merge:   adds only rows that don't exist yet (never overwrites)
// - replace: wipes all data, then inserts the backup verbatim

import { handleApiError, HttpError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { backupSchema, runImport } from "@/lib/server/import-backup";
import type { ImportResult } from "@/lib/types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const importBodySchema = z.object({
  mode: z.enum(["merge", "replace"]),
  data: z.record(z.string(), z.unknown()),
});

export async function POST(req: Request) {
  try {
    const body = parseOrThrow(importBodySchema, await readJsonBody(req));

    // Validate the backup payload with a dedicated schema — surface a
    // friendlier error than a raw zod tree.
    const parsed = backupSchema.safeParse(body.data);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new HttpError(
        first
          ? `Not a valid Momentum backup — ${first.path.join(".") || "file"}: ${first.message}`
          : "Not a valid Momentum backup file",
        400,
      );
    }

    const hasData =
      parsed.data.todos.length > 0 ||
      parsed.data.habits.length > 0 ||
      parsed.data.routineTasks.length > 0 ||
      parsed.data.notes.length > 0 ||
      parsed.data.journal.length > 0 ||
      parsed.data.goals.length > 0;
    if (!hasData) {
      throw new HttpError(
        "The backup file contains no importable data (no tasks, habits, notes, journal entries or goals).",
        400,
      );
    }

    const outcome = await runImport(parsed.data, body.mode);

    const result: ImportResult = {
      ok: true,
      mode: body.mode,
      counts: outcome.counts,
      message: outcome.message,
    };
    return json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
