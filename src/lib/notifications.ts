"use client";

// Browser notification engine — polls for due reminders while the
// app is open (lightweight: one interval, no service worker needed).

import type { Habit, RoutineTask, Todo } from "./types";
import { formatTime, todayKey } from "./dates";

const LAST_NOTIFIED_KEY = "momentum-notified";

type NotifiedMap = Record<string, number>; // id -> timestamp of reminder fired

function loadNotified(): NotifiedMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LAST_NOTIFIED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveNotified(map: NotifiedMap) {
  try {
    localStorage.setItem(LAST_NOTIFIED_KEY, JSON.stringify(map));
  } catch {
    /* storage full — ignore */
  }
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function showNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `momentum-${title}-${body}`, // dedupe
  };
  try {
    // Preferred path: show via the service worker registration — the ONLY
    // API that works inside installed iOS PWAs (the `new Notification()`
    // constructor is unsupported there).
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification(title, options))
        .catch(() => {
          /* fall back below silently */
        });
      return;
    }
    const n = new Notification(title, options);
    setTimeout(() => n.close(), 8000);
  } catch {
    /* some mobile browsers throw on constructor — ignore */
  }
}

export interface ReminderCheckResult {
  notifications: { title: string; body: string }[];
}

/**
 * Compute which reminders are due now (or within the past hour and
 * not yet notified). Called every 60s by the notification engine.
 */
export function computeDueReminders(
  todos: Todo[],
  habits: Habit[],
  routine: RoutineTask[]
): ReminderCheckResult {
  const now = Date.now();
  const notified = loadNotified();
  const fired: { title: string; body: string }[] = [];
  const next: NotifiedMap = {};

  const check = (
    id: string,
    at: number,
    title: string,
    body: string,
    cooldownMs = 12 * 60 * 60 * 1000
  ) => {
    // window: reminder time passed within the last 60 minutes
    const dueWindow = now - at;
    if (dueWindow >= -30_000 && dueWindow <= 60 * 60 * 1000) {
      const last = notified[id] ?? 0;
      if (now - last > cooldownMs) {
        fired.push({ title, body });
        next[id] = now;
      } else {
        next[id] = last;
      }
    } else if (at > now) {
      // keep future reminders unnotified
    } else {
      // long past (over an hour ago): only keep cooldown bookkeeping
      const last = notified[id] ?? 0;
      if (now - last <= cooldownMs) {
        next[id] = last;
      }
    }
  };

  // Todo reminders
  for (const t of todos) {
    if (t.completed || !t.reminderAt) continue;
    const at = new Date(t.reminderAt).getTime();
    if (Number.isNaN(at)) continue;
    check(`todo-${t.id}`, at, "Task reminder", t.title);
  }
  // Todo due today nudge (fires once at 9:00 local)
  const today = todayKey();
  for (const t of todos) {
    if (t.completed || !t.dueDate) continue;
    if (t.dueDate.slice(0, 10) !== today) continue;
    const nineAm = new Date(`${today}T09:00:00`).getTime();
    check(`todo-due-${t.id}`, nineAm, "Due today", t.title, 20 * 60 * 60 * 1000);
  }

  // Habit reminder times
  const minutesNow = new Date().getHours() * 60 + new Date().getMinutes();
  for (const h of habits) {
    if (h.archived || h.doneToday || !h.reminderTime) continue;
    const [hh, mm] = h.reminderTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const at = new Date(`${today}T${h.reminderTime}:00`).getTime();
    if (minutesNow >= hh * 60 + mm) {
      check(`habit-${h.id}-${today}`, at, "Habit reminder", `${h.emoji} ${h.name}`);
    }
  }

  // Routine task times
  for (const r of routine) {
    if (r.archived || r.doneToday || !r.time) continue;
    const [hh, mm] = r.time.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
    const at = new Date(`${today}T${r.time}:00`).getTime();
    if (minutesNow >= hh * 60 + mm) {
      check(
        `routine-${r.id}-${today}`,
        at,
        "Routine reminder",
        `${r.emoji} ${r.name}`
      );
    }
  }

  // prune stale keys beyond a day
  for (const [k, v] of Object.entries(notified)) {
    if (now - v > 24 * 60 * 60 * 1000) delete notified[k];
  }
  saveNotified({ ...notified, ...next });

  // Fire OS notifications (max 3 per cycle to avoid spam)
  for (const n of fired.slice(0, 3)) showNotification(n.title, n.body);

  return { notifications: fired };
}

export function overdueInfo(todos: Todo[]): { count: number; first: Todo | null } {
  const todayStart = new Date(`${todayKey()}T00:00:00`).getTime();
  const overdue = todos.filter(
    (t) =>
      !t.completed &&
      t.dueDate &&
      new Date(t.dueDate).getTime() < todayStart
  );
  return { count: overdue.length, first: overdue[0] ?? null };
}

export function reminderTimeLabel(value: string | null): string {
  return value ? formatTime(new Date(`2000-01-01T${value}:00`).toISOString()) : "";
}
