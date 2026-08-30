// Local notifications — three layers, all opt-in friendly:
//   1. A gentle daily check-in reminder (Settings → Notifications).
//   2. AUTOMATIC data reminders: every routine block with a time fires
//      weekly on its scheduled days, habits with a reminder time fire
//      daily, and tasks with a reminderAt fire once. Re-synced whenever
//      data changes — no per-item toggling needed.
//   3. A test notification.
//
// Scheduled ids are tracked in the kv table per layer, so cancelling one
// layer never disturbs the others.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useApp } from "./store";
import { kvGet, kvSet, routineTasksAll, habits, activeTodos } from "./db";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const CHANNEL_ID = "momentum-reminders";
const DAILY_NOTIF_KEY = "notif:daily";
const DATA_NOTIF_KEY = "notif:data";

const MAX_TODO_REMINDERS = 24; // one-shot task reminders kept at once
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true },
  });
  return asked.granted;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 90, 180],
      lightColor: "#2dd4a8",
    });
  }
}

// ── helpers ──────────────────────────────────────────────────

function parseHHMM(t: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** ISO weekday (Mon=1…Sun=7) → expo-notifications weekday (Sun=1…Sat=7). */
function expoWeekday(isoWd: number): number {
  return (isoWd % 7) + 1;
}

async function cancelTracked(key: string): Promise<void> {
  const raw = kvGet(key);
  if (!raw) return;
  try {
    const ids = JSON.parse(raw) as string[];
    await Promise.all(
      ids.filter(Boolean).map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
      ),
    );
  } catch {
    /* malformed registry — nothing to cancel */
  }
  kvSet(key, "[]");
}

function trackIds(key: string, ids: string[]): void {
  kvSet(key, JSON.stringify(ids));
}

async function schedule(
  content: Notifications.NotificationContentInput,
  trigger: Notifications.NotificationTriggerInput,
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { ...content, sound: true },
      trigger,
    });
  } catch {
    return null;
  }
}

// ── 1. daily check-in ────────────────────────────────────────

export async function scheduleDailyReminder(): Promise<boolean> {
  await cancelTracked(DAILY_NOTIF_KEY);
  const { reminderEnabled, reminderHour, reminderMinute } = useApp.getState();
  if (!reminderEnabled) return false;
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  await ensureChannel();
  const id = await schedule(
    {
      title: "Momentum ✦",
      body: "Time to check in — knock out a task or keep a streak alive.",
    },
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminderHour,
      minute: reminderMinute,
      channelId: CHANNEL_ID,
    },
  );
  if (id) trackIds(DAILY_NOTIF_KEY, [id]);
  return !!id;
}

// ── 2. automatic data reminders ──────────────────────────────

export interface DataReminderSummary {
  scheduled: number;
  routine: number;
  habits: number;
  tasks: number;
}

/**
 * Rebuilds every automatic reminder from the current data:
 *   • routine blocks with a time → weekly calendar trigger per weekday
 *   • habits with a reminder time → repeating daily trigger
 *   • incomplete tasks with a future reminderAt → one-shot trigger
 * Only runs when the "autoReminders" setting is on AND permission is
 * granted — otherwise it just clears the previous set.
 */
export async function syncDataReminders(): Promise<DataReminderSummary> {
  await cancelTracked(DATA_NOTIF_KEY);
  const summary: DataReminderSummary = { scheduled: 0, routine: 0, habits: 0, tasks: 0 };
  if (!useApp.getState().autoReminders) return summary;
  const granted = await ensureNotificationPermission();
  if (!granted) return summary;
  await ensureChannel();

  const ids: string[] = [];

  // Routine blocks — one repeating weekly notification per weekday.
  for (const t of routineTasksAll()) {
    const time = t.time ? parseHHMM(t.time) : null;
    if (!time) continue;
    const section = t.section === "morning" ? "Morning" : t.section === "afternoon" ? "Afternoon" : "Evening";
    for (const d of (t.days || "1,2,3,4,5,6,7").split(",")) {
      const isoWd = parseInt(d, 10);
      if (!(isoWd >= 1 && isoWd <= 7)) continue;
      const id = await schedule(
        {
          title: `${t.emoji} ${t.name}`,
          body: `${section} routine · ${t.time}${isoWeekdayLabel(isoWd)}`,
        },
        {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: time.hour,
          minute: time.minute,
          weekday: expoWeekday(isoWd),
          repeats: true,
          channelId: CHANNEL_ID,
        },
      );
      if (id) ids.push(id);
      summary.routine += 1;
    }
  }

  // Habits — repeating daily reminder at their reminder time.
  for (const h of habits()) {
    const time = h.reminderTime ? parseHHMM(h.reminderTime) : null;
    if (!time) continue;
    const id = await schedule(
      {
        title: `${h.emoji} ${h.name}`,
        body:
          h.streak > 0
            ? `Keep your ${h.streak}-day streak alive — tap to check in.`
            : "Time to check in — one tap keeps the streak going.",
      },
      {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: CHANNEL_ID,
      },
    );
    if (id) ids.push(id);
    summary.habits += 1;
  }

  // Tasks — one-shot reminders for future reminderAt values.
  const soon = activeTodos()
    .filter((t) => t.reminderAt && new Date(t.reminderAt).getTime() > Date.now())
    .sort(
      (a, b) =>
        new Date(a.reminderAt as string).getTime() - new Date(b.reminderAt as string).getTime(),
    )
    .slice(0, MAX_TODO_REMINDERS);
  for (const t of soon) {
    const id = await schedule(
      { title: "⏰ Task reminder", body: t.title },
      {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(t.reminderAt as string),
        channelId: CHANNEL_ID,
      },
    );
    if (id) ids.push(id);
    summary.tasks += 1;
  }

  trackIds(DATA_NOTIF_KEY, ids);
  summary.scheduled = ids.length;
  return summary;
}

function isoWeekdayLabel(isoWd: number): string {
  // expo weekday = iso % 7 + 1 → 1=Sun … 7=Sat; DAY_NAMES is Sun-anchored.
  return ` · ${DAY_NAMES[expoWeekday(isoWd) - 1]}`;
}

/** How many automatic reminders the current data would produce (for UI copy). */
export function countDataReminders(): DataReminderSummary {
  const summary = { scheduled: 0, routine: 0, habits: 0, tasks: 0 };
  for (const t of routineTasksAll()) {
    if (!t.time || !parseHHMM(t.time)) continue;
    summary.routine += (t.days || "1,2,3,4,5,6,7").split(",").filter((d) => {
      const n = parseInt(d, 10);
      return n >= 1 && n <= 7;
    }).length;
  }
  for (const h of habits()) {
    if (h.reminderTime && parseHHMM(h.reminderTime)) summary.habits += 1;
  }
  summary.tasks = activeTodos().filter(
    (t) => t.reminderAt && new Date(t.reminderAt).getTime() > Date.now(),
  ).length;
  summary.scheduled = summary.routine + summary.habits + summary.tasks;
  return summary;
}

// ── 3. test notification ─────────────────────────────────────

export async function sendTestNotification(): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Momentum ✦",
      body: "Notifications are working 🎉",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: CHANNEL_ID,
    },
  });
}
