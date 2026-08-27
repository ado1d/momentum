// Day-key math for local "YYYY-MM-DD" strings.
// IMPORTANT: day keys are compared and manipulated as pure date components
// (UTC midnight epoch-day arithmetic) — they never pass through a local
// Date->timezone conversion, so no timezone drift can occur. Only
// `todayKey()` / `dayKeyOfDate()` look at wall-clock time (on purpose).

const DAY_MS = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today's local day key "YYYY-MM-DD". */
export function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

/** Local day key of a JS Date (used for DateTime columns like completedAt). */
export function dayKeyOfDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Structural + calendar validity check for "YYYY-MM-DD" strings. */
export function isValidDayKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/** Day key → epoch day number (UTC midnight). */
export function dayKeyToNum(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Epoch day number → day key. */
export function numToDayKey(n: number): string {
  const dt = new Date(n * DAY_MS);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function addDaysToKey(key: string, days: number): string {
  return numToDayKey(dayKeyToNum(key) + days);
}

/** Last `n` day keys ending at `fromKey` (inclusive), oldest → newest. */
export function lastNDayKeys(n: number, fromKey: string = todayKey()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) out.push(addDaysToKey(fromKey, -i));
  return out;
}

/** ISO weekday of a day key: Mon=1 … Sun=7. */
export function isoWeekdayOfKey(key: string): number {
  // Epoch day 0 (1970-01-01) was a Thursday (ISO weekday 4).
  return (dayKeyToNum(key) + 3) % 7 + 1;
}

/** Start of the calendar week containing `key`, respecting weekStartsOn (0=Sun). */
export function weekStartKeyOf(key: string, weekStartsOn = 1): string {
  const ws = ((Math.trunc(weekStartsOn) % 7) + 7) % 7;
  const dayNum = dayKeyToNum(key);
  const localWeekday = isoWeekdayOfKey(key) % 7; // 0=Sun … 6=Sat
  const back = (localWeekday - ws + 7) % 7;
  return numToDayKey(dayNum - back);
}

/**
 * Streak of consecutive logged days ending today (or yesterday, so a streak
 * isn't considered broken before the day is over).
 */
export function computeStreak(dates: ReadonlySet<string>, today: string): number {
  let cursor = today;
  if (!dates.has(cursor)) {
    cursor = addDaysToKey(cursor, -1);
    if (!dates.has(cursor)) return 0;
  }
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDaysToKey(cursor, -1);
  }
  return streak;
}

/** 1-based day of year for a day key (used to rotate the daily quote). */
export function dayOfYearOfKey(key: string): number {
  return dayKeyToNum(key) - dayKeyToNum(`${key.slice(0, 4)}-01-01`) + 1;
}
