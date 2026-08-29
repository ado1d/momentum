// POST /api/push/subscribe { endpoint, keys: { p256dh, auth }, userAgent? }
// Registers (or refreshes) this device's web-push subscription.

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { pushSubscribeSchema } from "@/lib/server/schemas";
import { isMissingTableError } from "@/lib/server/push";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(pushSubscribeSchema, await readJsonBody(req));

    await db.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: input.userAgent ?? null,
      },
    });

    return json({ ok: true });
  } catch (err) {
    if (isMissingTableError(err)) {
      return json({ error: "Push storage not initialized on the server yet" }, 503);
    }
    return handleApiError(err);
  }
}
