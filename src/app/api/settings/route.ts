// GET /api/settings → AppSettings (one row per user, upserted on read)
// PATCH /api/settings (partial) → AppSettings

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
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
    timezone: row.timezone,
  };
}

export async function GET() {
  try {
    const userId = await requireUserId();
    const row = await getSettings(userId);
    return json(toAppSettings(row));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(settingsUpdateSchema, await readJsonBody(req));
    await getSettings(userId); // ensure the user's settings row exists

    const data: Prisma.SettingsUpdateInput = {};
    if (input.notificationsEnabled !== undefined) {
      data.notificationsEnabled = input.notificationsEnabled;
    }
    if (input.soundEnabled !== undefined) data.soundEnabled = input.soundEnabled;
    if (input.weekStartsOn !== undefined) data.weekStartsOn = input.weekStartsOn;
    if (input.defaultView !== undefined) data.defaultView = input.defaultView;
    if (input.onboarded !== undefined) data.onboarded = input.onboarded;
    if (input.timezone !== undefined) data.timezone = input.timezone;

    const updated = await db.settings.update({ where: { userId }, data });
    return json(toAppSettings(updated));
  } catch (err) {
    return handleApiError(err);
  }
}
