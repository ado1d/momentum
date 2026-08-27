// Recurrence helpers for repeating todos.
// A completed recurring todo spawns its next occurrence; the next due date is
// advanced from the current due date (never from "now"), but if the series has
// fallen behind the next occurrence is rolled forward until it is in the
// future so users never get an instantly-overdue clone.

export type RepeatKind = "none" | "daily" | "weekdays" | "weekly" | "monthly";

/** Days in a given month (1-based). */
function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** One step of the recurrence: from `d` to the next occurrence. */
function advance(d: Date, repeat: Exclude<RepeatKind, "none">): Date {
  const next = new Date(d);
  switch (repeat) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekdays": {
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6); // skip Sat/Sun
      return next;
    }
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly": {
      const day = next.getDate();
      const targetMonth = next.getMonth() + 1;
      next.setDate(1); // avoid month-overflow before setting the month
      next.setMonth(targetMonth);
      next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
      return next;
    }
  }
}

/**
 * Next due date for a recurring todo, given its current due date.
 * Rolls the series forward past "now" (with a small grace window so a task
 * due later today still yields tomorrow when completed in the morning).
 * Returns null when the task has no due date (the clone simply has none too).
 */
export function nextOccurrence(
  dueDate: Date | null,
  repeat: Exclude<RepeatKind, "none">,
  now: Date = new Date(),
): Date | null {
  if (!dueDate) return null;
  const graceMs = 60_000; // 1 min — ignore sub-minute rounding
  let next = advance(dueDate, repeat);
  // Safety cap: ~2 years of daily steps.
  for (let i = 0; i < 800 && next.getTime() < now.getTime() - graceMs; i += 1) {
    next = advance(next, repeat);
  }
  return next;
}
