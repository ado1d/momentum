// Server-side web-push helpers.
//
// Zero-config VAPID: if VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars are set
// they win; otherwise a keypair is generated once and stored in the
// AppConfig table so serverless instances share it. This keeps push
// notifications working without any manual environment setup.

import webpush from "web-push";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const VAPID_CONFIG_KEY = "vapid-keys";

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  removed: number; // stale subscriptions pruned (404/410)
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: VapidKeys | null = null;

/** Returns the VAPID keypair, generating + persisting one on first use. */
export async function getVapidKeys(): Promise<VapidKeys> {
  if (cachedKeys) return cachedKeys;

  const envPublic = process.env.VAPID_PUBLIC_KEY;
  const envPrivate = process.env.VAPID_PRIVATE_KEY;
  if (envPublic && envPrivate) {
    cachedKeys = { publicKey: envPublic, privateKey: envPrivate };
    return cachedKeys;
  }

  // Stored keypair (shared across serverless instances).
  const row = await db.appConfig.findUnique({ where: { key: VAPID_CONFIG_KEY } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value) as VapidKeys;
      if (parsed.publicKey && parsed.privateKey) {
        cachedKeys = parsed;
        return cachedKeys;
      }
    } catch {
      /* corrupted row — regenerate below */
    }
  }

  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeys = { publicKey: generated.publicKey, privateKey: generated.privateKey };
  await db.appConfig.upsert({
    where: { key: VAPID_CONFIG_KEY },
    update: { value: JSON.stringify(keys) },
    create: { key: VAPID_CONFIG_KEY, value: JSON.stringify(keys) },
  });
  cachedKeys = keys;
  return keys;
}

/** Prisma error thrown when a table is missing (schema not yet pushed). */
export function isMissingTableError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P2021" || err.code === "P2022")
  );
}

/** Sends one push notification to every subscription of a user. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  const keys = await getVapidKeys();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:momentum-app@example.com",
    keys.publicKey,
    keys.privateKey,
  );

  const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 24 * 60 * 60, urgency: "normal" },
        );
        sent += 1;
        // Keep lastUsedAt fresh (fire-and-forget, never blocks the send).
        void db.pushSubscription
          .update({ where: { id: sub.id }, data: { lastUsedAt: new Date() } })
          .catch(() => undefined);
      } catch (err) {
        const status =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode?: unknown }).statusCode)
            : 0;
        if (status === 404 || status === 410) {
          // Subscription expired/unregistered — prune it.
          removed += 1;
          void db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        } else {
          failed += 1;
        }
      }
    }),
  );

  return { sent, failed, removed };
}

// ── Timezone helpers ──────────────────────────────────────────────────

/** Milliseconds that `tz` is offset from UTC at the given instant. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    map.year,
    (map.month ?? 1) - 1,
    map.day ?? 1,
    map.hour === 24 ? 0 : (map.hour ?? 0),
    map.minute ?? 0,
    map.second ?? 0,
  );
  return asUtc - date.getTime();
}

/** The UTC instant of local midnight "today" in `timeZone`. */
export function localMidnightUtc(timeZone: string, now = new Date()): Date {
  const shifted = new Date(now.getTime() + tzOffsetMs(now, timeZone));
  const guess = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  // Refine once (handles DST boundaries close to midnight).
  return new Date(guess - tzOffsetMs(new Date(guess), timeZone));
}

/** "YYYY-MM-DD" for the user's local day in `timeZone`. */
export function localDayKey(timeZone: string, now = new Date()): string {
  const shifted = new Date(now.getTime() + tzOffsetMs(now, timeZone));
  return shifted.toISOString().slice(0, 10);
}

/** Current local hour (0–23) in `timeZone`. */
export function localHour(timeZone: string, now = new Date()): number {
  const shifted = new Date(now.getTime() + tzOffsetMs(now, timeZone));
  return shifted.getUTCHours();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export interface DigestContent {
  title: string;
  body: string;
}

/**
 * Builds the morning digest notification for a user: tasks due today
 * (+ first title), overdue count, habits left, goals wrapping up this week.
 */
export async function buildMorningDigest(
  userId: string,
  timeZone: string,
): Promise<DigestContent> {
  const now = new Date();
  const midnight = localMidnightUtc(timeZone, now);
  const nextMidnight = new Date(midnight.getTime() + 24 * 60 * 60 * 1000);
  const todayKey = localDayKey(timeZone, now);
  const weekAheadKey = localDayKey(timeZone, new Date(midnight.getTime() + 7 * 24 * 3600 * 1000));

  const [dueToday, overdue, habits, goalsEnding] = await Promise.all([
    db.todo.findMany({
      where: { userId, completed: false, dueDate: { gte: midnight, lt: nextMidnight } },
      orderBy: { dueDate: "asc" },
      take: 3,
      select: { title: true },
    }),
    db.todo.count({
      where: { userId, completed: false, dueDate: { lt: midnight } },
    }),
    db.habit.findMany({
      where: { userId, archived: false },
      select: { id: true, targetPerDay: true },
    }),
    db.goal.count({
      where: {
        userId,
        status: "active",
        endDate: { gte: todayKey, lte: weekAheadKey },
      },
    }),
  ]);

  const habitIds = habits.map((h) => h.id);
  const logsToday = habitIds.length
    ? await db.habitLog.findMany({
        where: { habitId: { in: habitIds }, date: todayKey },
        select: { habitId: true },
      })
    : [];
  const logsByHabit = new Map<string, number>();
  for (const log of logsToday) {
    logsByHabit.set(log.habitId, (logsByHabit.get(log.habitId) ?? 0) + 1);
  }
  const habitsLeft = habits.filter((h) => (logsByHabit.get(h.id) ?? 0) < h.targetPerDay).length;

  const parts: string[] = [];
  if (dueToday.length > 0) parts.push(`${dueToday.length} task${dueToday.length === 1 ? "" : "s"} due today`);
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (habitsLeft > 0) parts.push(`${habitsLeft} habit${habitsLeft === 1 ? "" : "s"} to go`);
  if (goalsEnding > 0) parts.push(`${goalsEnding} goal${goalsEnding === 1 ? "" : "s"} wrapping up`);

  let body = parts.join(" · ");
  if (dueToday.length === 1) body += ` — "${truncate(dueToday[0].title, 42)}"`;
  if (!body) body = "Nothing due today — have a great day ☀️";

  return { title: "Good morning ☀️", body };
}
