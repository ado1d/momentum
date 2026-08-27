// Date helpers — all "day keys" are local YYYY-MM-DD strings,
// which avoids timezone drift for daily-tracked entities.

import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfWeek,
  type Day,
} from "date-fns";

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function dateToKey(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function keyToDate(key: string): Date {
  const d = parseISO(key);
  return isValid(d) ? d : new Date(NaN);
}

export function isSameKey(a: string | null | undefined, b: string): boolean {
  return !!a && a.slice(0, 10) === b;
}

export function addDaysToKey(key: string, days: number): string {
  return dateToKey(addDays(keyToDate(key), days));
}

export function dayDiff(a: string, b: string): number {
  return differenceInCalendarDays(keyToDate(a), keyToDate(b));
}

export function weekdayOfKey(key: string): number {
  // ISO weekday: Mon=1 … Sun=7
  const d = keyToDate(key).getDay();
  return d === 0 ? 7 : d;
}

export function weekStartKey(key: string, weekStartsOn: Day = 1): string {
  return dateToKey(startOfWeek(keyToDate(key), { weekStartsOn }));
}

export function weekEndKey(key: string, weekStartsOn: Day = 1): string {
  return dateToKey(endOfWeek(keyToDate(key), { weekStartsOn }));
}

export function lastNDays(n: number, fromKey = todayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDaysToKey(fromKey, -i));
  return out;
}

export function formatKeyLabel(key: string): string {
  const d = keyToDate(key);
  if (!isValid(d)) return key;
  return format(d, "EEE, MMM d");
}

export function formatKeyLong(key: string): string {
  const d = keyToDate(key);
  if (!isValid(d)) return key;
  return format(d, "EEEE, MMMM d, yyyy");
}

export function shortDayName(key: string): string {
  const d = keyToDate(key);
  if (!isValid(d)) return "?";
  return format(d, "EEE");
}

/** "Today", "Yesterday", "Tomorrow" or a friendly date */
export function friendlyDay(key: string): string {
  const diff = dayDiff(key, todayKey());
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(keyToDate(key), "EEEE");
  return formatKeyLabel(key);
}

/** Format an ISO datetime for display, e.g. "3:30 PM" or "Mar 2" */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "p");
}

export function formatDueLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const key = dateToKey(d);
  const label = friendlyDay(key);
  if (hasTime(iso)) return `${label} · ${format(d, "p")}`;
  return label;
}

export function hasTime(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

/** Overdue = due strictly before today's local start */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return startOfDay(d).getTime() < startOfDay(new Date()).getTime();
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

export function monthLabel(key: string): string {
  const d = keyToDate(key);
  return isValid(d) ? format(d, "MMMM yyyy") : key;
}
