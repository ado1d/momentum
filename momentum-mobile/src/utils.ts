// Shared helpers: ids, dates, streaks, formatting.

export function newId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `m-${t}-${r}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Local calendar day key: YYYY-MM-DD (device timezone). */
export function dayKey(d: Date | string | number = new Date()): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function addDaysKey(key: string, n: number): string {
  return dayKey(addDays(dayKeyToDate(key), n));
}

/** ISO weekday: Mon=1 … Sun=7. */
export function isoWeekday(d: Date = new Date()): number {
  const wd = d.getDay();
  return wd === 0 ? 7 : wd;
}

export function isToday(key: string): boolean {
  return key === dayKey();
}

export function isPast(key: string): boolean {
  return key < dayKey();
}

export function isFuture(key: string): boolean {
  return key > dayKey();
}

export function formatDateLong(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Today", "Tomorrow", "Yesterday", "Mon, Mar 3" or "Mar 3, 2025". */
export function relativeDay(key: string): string {
  const today = dayKey();
  if (key === today) return "Today";
  if (key === addDaysKey(today, 1)) return "Tomorrow";
  if (key === addDaysKey(today, -1)) return "Yesterday";
  const d = dayKeyToDate(key);
  if (isPast(key) && key > addDaysKey(today, -7)) {
    return `Last ${d.toLocaleDateString(undefined, { weekday: "long" })}`;
  }
  if (isFuture(key) && key < addDaysKey(today, 7)) {
    return d.toLocaleDateString(undefined, { weekday: "long" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Burning the midnight oil";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

/** Longest run of consecutive day-keys ending today (or yesterday if today missing). */
export function streakFromKeys(keys: Set<string>): number {
  let streak = 0;
  let cursor = dayKey();
  if (!keys.has(cursor)) {
    cursor = addDaysKey(cursor, -1);
  }
  while (keys.has(cursor)) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function minutesToClock(total: number): string {
  const m = Math.floor(total);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return `${h}h ${rem}m`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** Parse query params out of a custom-scheme URL like momentum://auth?token=… */
export function parseUrlQuery(url: string): Record<string, string> {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return {};
  const out: Record<string, string> = {};
  for (const pair of url.slice(qIndex + 1).split("&")) {
    const [k, v] = pair.split("=");
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

export function titleize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
