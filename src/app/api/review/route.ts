// GET /api/review?week=YYYY-MM-DD → WeeklyReview
//
// Generated weekly summary: daily scores for the 7-day window containing
// `week` (defaults to the current week per settings.weekStartsOn), average
// score vs previous week, tasks completed (with titles), habit consistency,
// active goal snapshots, journal entries, and focus-minute stats.
//
// `week` may be ANY day inside the target week — the containing week start
// is computed server-side.

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import type { Mood, WeeklyReview } from "@/lib/types";
import {
  addDaysToKey,
  dayKeyOfDate,
  isValidDayKey,
  todayKey,
  weekStartKeyOf,
} from "@/lib/server/daykeys";
import { handleApiError, HttpError, json } from "@/lib/server/http";
import { fetchHabitsWithLogs, fetchRoutineTasksWithLogs, getSettings, isRoutineDay } from "@/lib/server/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const weekParam = url.searchParams.get("week");
    if (weekParam !== null && !isValidDayKey(weekParam)) {
      throw new HttpError("week must be a valid YYYY-MM-DD date", 400);
    }

    const today = todayKey();
    const settings = await getSettings(userId);
    const anchor = weekParam ?? today;
    const weekStart = weekStartKeyOf(anchor, settings.weekStartsOn);
    const prevWeekStart = addDaysToKey(weekStart, -7);
    const weekEnd = addDaysToKey(weekStart, 6);
    const weekKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
    const prevWeekKeys = Array.from({ length: 7 }, (_, i) => addDaysToKey(prevWeekStart, i));

    const [todos, habits, routineTasks, journal, goals, focusSessions] = await Promise.all([
      db.todo.findMany({ where: { userId } }),
      fetchHabitsWithLogs(userId),
      fetchRoutineTasksWithLogs(userId),
      db.journalEntry.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      db.goal.findMany({ where: { userId, status: "active" }, orderBy: { createdAt: "asc" } }),
      db.focusSession.findMany({ where: { userId } }),
    ]);

    const activeTodos = todos.filter((t) => !t.completed);

    const todosDoneOn = (key: string) =>
      todos.filter((t) => t.completedAt !== null && dayKeyOfDate(t.completedAt) === key).length;

    // Same "total" semantics as /api/stats and /api/insights.
    const todosTotalOn = (key: string) =>
      todosDoneOn(key) +
      activeTodos.filter((t) => t.dueDate === null || dayKeyOfDate(t.dueDate) <= key).length;

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

    const scores = weekKeys.map((key) => ({
      date: key,
      todosCompleted: todosDoneOn(key),
      habitsCompleted: habitsDoneOn(key),
      routineCompleted: routineDoneOn(key),
      score: dayScore(key),
    }));

    const avgScore = Math.round(scores.reduce((s, d) => s + d.score, 0) / 7);
    const prevAvgScore = Math.round(
      prevWeekKeys.reduce((s, k) => s + dayScore(k), 0) / 7,
    );
    const best = scores.reduce<{ date: string; score: number } | null>((acc, d) => {
      if (!acc || d.score > acc.score) return { date: d.date, score: d.score };
      return acc;
    }, null);

    // Tasks completed in the window (newest first, capped at 20).
    const completedTasks = todos
      .filter(
        (t) =>
          t.completed &&
          t.completedAt !== null &&
          dayKeyOfDate(t.completedAt) >= weekStart &&
          dayKeyOfDate(t.completedAt) <= weekEnd,
      )
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
      .slice(0, 20)
      .map((t) => ({
        title: t.title,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        priority: t.priority,
      }));

    // Habit consistency within the week.
    const habitStats = habits.map((h) => {
      const done = h.logs.filter((l) => l.date >= weekStart && l.date <= weekEnd).length;
      return {
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        done,
        total: 7,
        pct: Math.round((done / 7) * 100),
      };
    });
    const habitChecks = habitStats.reduce((s, h) => s + h.done, 0);

    // Journal entries written in the week (newest first).
    const journalInWeek = journal
      .filter((e) => e.date >= weekStart && e.date <= weekEnd)
      .map((e) => ({
        date: e.date,
        title: e.title,
        mood: (e.mood as Mood | null) ?? null,
      }));

    // Focus minutes in the window vs the previous window.
    const minutesIn = (keys: string[]) =>
      focusSessions
        .filter((s) => keys.includes(dayKeyOfDate(s.endedAt)))
        .reduce((sum, s) => sum + s.minutes, 0);
    const sessionsInWeek = focusSessions.filter((s) =>
      weekKeys.includes(dayKeyOfDate(s.endedAt)),
    );
    const focusMinutes = minutesIn(weekKeys);
    const prevFocusMinutes = minutesIn(prevWeekKeys);
    const focusVsLastWeek =
      prevFocusMinutes === 0
        ? focusMinutes > 0
          ? 100
          : 0
        : Math.round(((focusMinutes - prevFocusMinutes) / prevFocusMinutes) * 100);

    const data: WeeklyReview = {
      weekStart,
      weekEnd,
      scores,
      avgScore,
      prevAvgScore,
      bestDay: best && best.score > 0 ? best : null,
      tasksCompleted: completedTasks.length,
      taskList: completedTasks,
      habits: habitStats,
      goalSnapshots: goals.map((g) => ({
        id: g.id,
        title: g.title,
        period: g.period as WeeklyReview["goalSnapshots"][number]["period"],
        progress: g.progress,
        target: g.target,
        unit: g.unit,
        status: g.status as WeeklyReview["goalSnapshots"][number]["status"],
      })),
      journal: journalInWeek,
      focusMinutes,
      focusSessions: sessionsInWeek.length,
      focusVsLastWeek,
      habitChecks,
    };
    return json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
