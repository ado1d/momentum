// GET /api/push/vapid-public → { publicKey }
// Returns the VAPID public key the browser needs to subscribe to push.
// Generated once and stored in AppConfig (or taken from env overrides).

import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json } from "@/lib/server/http";
import { getVapidKeys, isMissingTableError } from "@/lib/server/push";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUserId();
    const keys = await getVapidKeys();
    return json({ publicKey: keys.publicKey });
  } catch (err) {
    if (isMissingTableError(err)) {
      return json({ error: "Push storage not initialized on the server yet" }, 503);
    }
    return handleApiError(err);
  }
}
