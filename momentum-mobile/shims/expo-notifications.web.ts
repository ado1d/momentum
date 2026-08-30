// WEB TEST SHIM — expo-notifications: in-memory mock so the reminder
// scheduler can be QA'd in the browser (nothing actually fires).
export const AndroidImportance = { DEFAULT: 3, HIGH: 4 };
export const SchedulableTriggerInputTypes = {
  DAILY: "daily",
  TIME_INTERVAL: "timeInterval",
  CALENDAR: "calendar",
  DATE: "date",
} as const;

type Scheduled = { id: string; content: unknown; trigger: unknown };
const scheduled: Scheduled[] = [];
let granted = false;
let nextId = 1;

// Expose for QA (agent-browser can read window.__notif to verify scheduling).
declare const globalThis: { __notif?: unknown };
export const __qa = {
  scheduled,
  grant(): void {
    granted = true;
  },
  scheduledCount(): number {
    return scheduled.length;
  },
};
if (typeof globalThis !== "undefined") {
  (globalThis as { __notif?: unknown }).__notif = __qa;
}

export function setNotificationHandler(_handler: unknown): void {
  /* no-op */
}
export async function getPermissionsAsync(): Promise<{ granted: boolean }> {
  return { granted };
}
export async function requestPermissionsAsync(): Promise<{ granted: boolean }> {
  // Auto-grant on web so the auto-reminder flow is testable.
  granted = true;
  return { granted };
}
export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  scheduled.length = 0;
}
export async function cancelScheduledNotificationAsync(id: string): Promise<void> {
  const i = scheduled.findIndex((s) => s.id === id);
  if (i >= 0) scheduled.splice(i, 1);
}
export async function getAllScheduledNotificationsAsync(): Promise<Scheduled[]> {
  return [...scheduled];
}
export async function setNotificationChannelAsync(): Promise<void> {
  /* no-op */
}
export async function scheduleNotificationAsync(opts: {
  content: unknown;
  trigger: unknown;
}): Promise<string> {
  const id = `web-notif-${nextId++}`;
  scheduled.push({ id, content: opts.content, trigger: opts.trigger });
  return id;
}
