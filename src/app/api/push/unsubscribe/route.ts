// POST /api/push/unsubscribe { endpoint }
// Removes this device's web-push subscription (permission revoked, or
// the user turns push notifications off).

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { pushUnsubscribeSchema } from "@/lib/server/schemas";
import { isMissingTableError } from "@/lib/server/push";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(pushUnsubscribeSchema, await readJsonBody(req));

    // Scoped to the caller: one user can never delete another's subscription.
    await db.pushSubscription.deleteMany({
      where: { userId, endpoint: input.endpoint },
    });

    return json({ ok: true });
  } catch (err) {
    if (isMissingTableError(err)) {
      return json({ error: "Push storage not initialized on the server yet" }, 503);
    }
    return handleApiError(err);
  }
}
