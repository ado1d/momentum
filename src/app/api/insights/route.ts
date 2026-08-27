// GET /api/insights → InsightsData
//
// Analytics over the whole account:
// - heatmap: daily scores for the last 12 weeks (84 days), oldest first
// - todosTrend: todos completed per day, last 30 days
// - habitConsistency: % of the last 30 days each habit was checked (+ streak)
// - moodDistribution: journal mood counts (all time)
// - focus: focus-minute stats (today / this week / last week / avg session)
// - totals: lifetime counts (todos completed, journal entries, habit checks,
//   best habit streak, focus hours)
//
// The daily score reuses the dashboard formula WITHOUT the journal bonus:
//   round(50*todosDone/todosTotal + 30*habitsDone/habitsTotal + 20*routineDone/routineTotal)

import { db } from "@/lib/db";
import type { InsightsData, Mood } from "@/lib/types";
import {
  addDaysToKey,
  computeStreak,
  dayKeyOfDate,
  lastNDayKeys,
  todayKey,
  weekStartKeyOf,
} from "@/lib/server/daykeys";
import { handleApiError, json } from "@/lib/server/http";
import { fetchHabitsWithLogs, fetchRoutineTasksWithLogs, getSettings, isRoutineDay } from "@/lib/server/service";

export const dynamic = "force-dynamic";

const HEATMAP_DAYS = 84;
const TREND_DAYS = 30;

export async function GET() {
  try {
    const today = todayKey();
    const settings = await getSettings();
    const weekStart = weekStartKeyOf(today, settings.weekStartsOn);
    const lastWeekStart = addDaysToKey(weekStart, -7);

    const [todos, habits, routineTasks, journal, focusSessions] = await Promise.all([
      db.todo.findMany(),
      fetchHabitsWithLogs(),
      fetchRoutineTasksWithLogs(),
      db.journalEntry.findMany(),
      db.focusSession.findMany(),
    ]);

    const activeTodos = todos.filter((t) => !t.completed);

    const todosDoneOn = (key: string) =>
      todos.filter((t) => t.completedAt !== null && dayKeyOfDate(t.completedAt) === key)
        .length;

    // For historical days, "total" = done that day + active todos already due
    // then (or undated). Mirrors /api/stats semantics.
    const todosTotalOn = (key: string) =>
      todosDoneOn(key) +
      activeTodos.filter((t) => t.dueDate === null || dayKeyOfDate(t.dueDate) <= key)
        .length;

    const habitsDoneOn = (key: string) =>
      habits.filter((h) => h.logs.some((l) => l.date === key)).length;

    const scheduledOn = (key: string) =>
      routineTasks.filter((t) => isRoutineDay(t.days, key));

    const routineDoneOn = (key: string) =>
      scheduledOn(key).filter((t) => t.logs.some((l) => l.date === key)).length;

    const dayScore = (key: string) =>
      Math.round(
        (50 * todosDoneOn(key)) / Math.max(1, todosTotalOn(key)) +
          (30 * habitsDoneOn(key)) / Math.max(1, habits.length) +
          (20 * routineDoneOn(key)) / Math.max(1, scheduledOn(key).length),
      );

    // ── heatmap + trend ────────────────────────────────────────
    const heatmap = lastNDayKeys(HEATMAP_DAYS, today).map((key) => ({
      date: key,
      todosCompleted: todosDoneOn(key),
      habitsCompleted: habitsDoneOn(key),
      routineCompleted: routineDoneOn(key),
      score: dayScore(key),
    }));

    const todosTrend = lastNDayKeys(TREND_DAYS, today).map((key) => ({
      date: key,
      count: todosDoneOn(key),
    }));

    // ── habit consistency (last 30 days) ───────────────────────
    const windowStart = addDaysToKey(today, -(TREND_DAYS - 1));
    const habitConsistency = habits.map((h) => {
      const dates = new Set(h.logs.map((l) => l.date));
      const hits = h.logs.filter((l) => l.date >= windowStart && l.date <= today).length;
      return {
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        color: h.color,
        pct: Math.round((hits / TREND_DAYS) * 100),
        streak: computeStreak(dates, today),
      };
    });

    // ── mood distribution (all time) ───────────────────────────
    const moodCounts = new Map<Mood, number>();
    for (const e of journal) {
      if (e.mood) {
        const m = e.mood as Mood;
        moodCounts.set(m, (moodCounts.get(m) ?? 0) + 1);
      }
    }
    const moodOrder: Mood[] = ["great", "good", "okay", "low", "rough"];
    const moodDistribution = moodOrder
      .map((mood) => ({ mood, count: moodCounts.get(mood) ?? 0 }))
      .filter((m) => m.count > 0);

    // ── focus ──────────────────────────────────────────────────
    const minutesOn = (key: string) =>
      focusSessions
        .filter((s) => dayKeyOfDate(s.endedAt) === key)
        .reduce((sum, s) => sum + s.minutes, 0);

    const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));

    const focus = {
      todayMinutes: minutesOn(today),
      weekMinutes: weekKeys.reduce((sum, k) => sum + minutesOn(k), 0),
      lastWeekMinutes: focusSessions
        .filter((s) => {
          const key = dayKeyOfDate(s.endedAt);
          return key >= lastWeekStart && key < weekStart;
        })
        .reduce((sum, s) => sum + s.minutes, 0),
      avgSessionMinutes: focusSessions.length
        ? Math.round(
            focusSessions.reduce((sum, s) => sum + s.minutes, 0) / focusSessions.length,
          )
        : 0,
    };

    // ── totals ─────────────────────────────────────────────────
    const bestHabitStreak = Math.max(
      0,
      ...habits.map((h) => computeStreak(new Set(h.logs.map((l) => l.date)), today)),
    );
    const totals = {
      todosCompleted: todos.filter((t) => t.completed).length,
      journalEntries: journal.length,
      habitChecks: habits.reduce((sum, h) => sum + h.logs.length, 0),
      bestHabitStreak,
      focusHours:
        Math.round(
          (focusSessions.reduce((sum, s) => sum + s.minutes, 0) / 60) * 10,
        ) / 10,
    };

    const data: InsightsData = {
      heatmap,
      todosTrend,
      habitConsistency,
      moodDistribution,
      focus,
      totals,
    };
    return json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
