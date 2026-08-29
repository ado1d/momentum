// POST /api/push/test → { sent, failed, removed }
// Sends a test push notification to every subscription of the current user
// (used by the Settings → Notifications "Send test notification" button).

import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json } from "@/lib/server/http";
import { isMissingTableError, sendPushToUser } from "@/lib/server/push";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = await requireUserId();
    const result = await sendPushToUser(userId, {
      title: "Momentum ✓",
      body: "Push notifications are working — reminders will look like this.",
      tag: "momentum-test",
      url: "/",
    });
    return json(result);
  } catch (err) {
    if (isMissingTableError(err)) {
      return json({ error: "Push storage not initialized on the server yet" }, 503);
    }
    return handleApiError(err);
  }
}
