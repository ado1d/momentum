// GET /api/settings → AppSettings (single row id="app", upserted on read)
// PATCH /api/settings (partial) → AppSettings

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AppSettings } from "@/lib/types";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { settingsUpdateSchema } from "@/lib/server/schemas";
import { getSettings } from "@/lib/server/service";
import type { Settings } from "@prisma/client";

export const dynamic = "force-dynamic";

function toAppSettings(row: Settings): AppSettings {
  return {
    notificationsEnabled: row.notificationsEnabled,
    soundEnabled: row.soundEnabled,
    weekStartsOn: row.weekStartsOn,
    defaultView: row.defaultView,
    onboarded: row.onboarded,
  };
}

export async function GET() {
  try {
    const row = await getSettings();
    return json(toAppSettings(row));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const input = parseOrThrow(settingsUpdateSchema, await readJsonBody(req));
    await getSettings(); // ensure the single settings row exists

    const data: Prisma.SettingsUpdateInput = {};
    if (input.notificationsEnabled !== undefined) {
      data.notificationsEnabled = input.notificationsEnabled;
    }
    if (input.soundEnabled !== undefined) data.soundEnabled = input.soundEnabled;
    if (input.weekStartsOn !== undefined) data.weekStartsOn = input.weekStartsOn;
    if (input.defaultView !== undefined) data.defaultView = input.defaultView;
    if (input.onboarded !== undefined) data.onboarded = input.onboarded;

    const updated = await db.settings.update({ where: { id: "app" }, data });
    return json(toAppSettings(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
