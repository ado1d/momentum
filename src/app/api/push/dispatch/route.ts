// GET  /api/push/dispatch   → cron entry point (Vercel cron, Bearer CRON_SECRET)
// POST /api/push/dispatch   → self-dispatch (signed-in user, morning app-open)
//
// Sends the daily "Good morning" digest push: tasks due today, overdue
// count, habits left, goals wrapping up. Deduplicated per user via
// Settings.lastDigestAt (≥20h between digests) and restricted to the
// user's local morning window (05:00–11:00) so notifications arrive at a
// sensible hour regardless of timezone.
//
// Vercel Hobby allows two daily cron slots — 01:00 UTC covers Asia/Oceania
// mornings, 13:00 UTC covers the Americas. The self-dispatch path (client
// fires this on morning app-open) covers any timezone the cron slots miss.
//
// Fail-closed auth: cron mode requires CRON_SECRET to be configured AND the
// request to carry `Authorization: Bearer <CRON_SECRET>`.

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { handleApiError, json } from "@/lib/server/http";
import {
  buildMorningDigest,
  isMissingTableError,
  localHour,
  sendPushToUser,
} from "@/lib/server/push";

export const dynamic = "force-dynamic";

const DIGEST_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // ≥20h between digests
const MORNING_WINDOW_START = 5; // 05:00 local
const MORNING_WINDOW_END = 11; // before 11:00 local

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed when unconfigured
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

interface DigestOutcome {
  userId: string;
  sent: number;
  skipped?: "window" | "dedupe" | "disabled" | "no-subscriptions";
}

/** Digest for one user, honoring tz window + dedupe + the toggle. */
async function digestForUser(userId: string): Promise<DigestOutcome> {
  const [settings, subscriptionCount] = await Promise.all([
    db.settings.findUnique({ where: { userId } }),
    db.pushSubscription.count({ where: { userId } }),
  ]);

  if (subscriptionCount === 0) return { userId, sent: 0, skipped: "no-subscriptions" };
  if (settings && settings.notificationsEnabled === false) {
    return { userId, sent: 0, skipped: "disabled" };
  }

  const timeZone = settings?.timezone ?? "UTC";
  const hour = localHour(timeZone);
  if (hour < MORNING_WINDOW_START || hour >= MORNING_WINDOW_END) {
    return { userId, sent: 0, skipped: "window" };
  }

  const last = settings?.lastDigestAt?.getTime() ?? 0;
  if (Date.now() - last < DIGEST_MIN_INTERVAL_MS) {
    return { userId, sent: 0, skipped: "dedupe" };
  }

  const digest = await buildMorningDigest(userId, timeZone);
  const result = await sendPushToUser(userId, {
    ...digest,
    tag: "momentum-digest",
    url: "/",
  });

  await db.settings.updateMany({
    where: { userId },
    data: { lastDigestAt: new Date() },
  });

  return { userId, sent: result.sent };
}

export async function GET(req: Request) {
  try {
    if (!isCronAuthorized(req)) {
      return json({ error: "Unauthorized" }, 401);
    }
    // Cron mode: every user that has at least one subscription.
    const users = await db.pushSubscription.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });

    const outcomes: DigestOutcome[] = [];
    for (const { userId } of users) {
      try {
        outcomes.push(await digestForUser(userId));
      } catch (err) {
        if (isMissingTableError(err)) throw err;
        console.error("[push/dispatch] user digest failed:", userId, err);
      }
    }

    const sent = outcomes.reduce((sum, o) => sum + o.sent, 0);
    return json({ mode: "cron", users: outcomes.length, sent, outcomes });
  } catch (err) {
    if (isMissingTableError(err)) {
      return json({ error: "Push storage not initialized on the server yet" }, 503);
    }
    return handleApiError(err);
  }
}

export async function POST() {
  try {
    const userId = await requireUserId();
    const outcome = await digestForUser(userId);
    return json({ mode: "self", ...outcome });
  } catch (err) {
    if (isMissingTableError(err)) {
      return json({ error: "Push storage not initialized on the server yet" }, 503);
    }
    return handleApiError(err);
  }
}
