// GET /api/stats → DashboardStats
//
// Score formula (per day):
//   round(50*todosCompleted/max(1,todosTotal)
//       + 30*habitsCompleted/max(1,habitsTotal)
//       + 20*routineCompleted/max(1,routineTotal))
// For "today" a written journal entry adds a 5-point bonus (capped at 100).
//
// Semantics used (single-user app, all in local day keys):
// - todosDone(day)  = todos with completedAt on that day
// - todosTotal(day) = todosDone(day) + still-active todos that are undated or
//                     were due on/before that day
// - routineTotal/Done(day) = non-archived routine tasks scheduled that day
//   (their `days` field contains the ISO weekday) / scheduled & logged that day

import { db } from "@/lib/db";
import type { Todo as TodoRow } from "@prisma/client";
import type { DashboardStats, DayStat } from "@/lib/types";
import {
  addDaysToKey,
  dayKeyOfDate,
  dayOfYearOfKey,
  lastNDayKeys,
  todayKey,
  weekStartKeyOf,
} from "@/lib/server/daykeys";
import { handleApiError, json } from "@/lib/server/http";
import {
  fetchHabitsWithLogs,
  fetchRoutineTasksWithLogs,
  getSettings,
  isRoutineDay,
  serializeGoal,
  serializeHabit,
  serializeJournalEntry,
  serializeRoutineTask,
  serializeTodo,
} from "@/lib/server/service";

export const dynamic = "force-dynamic";

const QUOTES: { text: string; author: string }[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  {
    text: "You do not rise to the level of your goals; you fall to the level of your systems.",
    author: "James Clear",
  },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
];

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

function compareUpcoming(a: TodoRow, b: TodoRow): number {
  const dueA = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const dueB = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  const prA = PRIORITY_WEIGHT[a.priority] ?? 1;
  const prB = PRIORITY_WEIGHT[b.priority] ?? 1;
  if (prA !== prB) return prB - prA;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export async function GET() {
  try {
    const today = todayKey();
    const settings = await getSettings();
    const weekStart = weekStartKeyOf(today, settings.weekStartsOn);

    const [todos, habits, routineTasks, recentJournalRows, journalToday, activeGoalRows] =
      await Promise.all([
        db.todo.findMany({ include: { subtasks: { orderBy: { sortOrder: "asc" } } } }),
        fetchHabitsWithLogs(),
        fetchRoutineTasksWithLogs(),
        db.journalEntry.findMany({ orderBy: { date: "desc" }, take: 3 }),
        db.journalEntry.findUnique({ where: { date: today } }),
        db.goal.findMany({ where: { status: "active" } }),
      ]);

    const activeTodos = todos.filter((t) => !t.completed);

    const todosDoneOn = (key: string) =>
      todos.filter((t) => t.completedAt !== null && dayKeyOfDate(t.completedAt) === key)
        .length;

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

    const week: DayStat[] = lastNDayKeys(7).map((key) => ({
      date: key,
      todosCompleted: todosDoneOn(key),
      habitsCompleted: habitsDoneOn(key),
      routineCompleted: routineDoneOn(key),
      score: dayScore(key),
    }));

    const serializedHabits = habits.map((h) => serializeHabit(h, { today, weekStart }));
    const serializedRoutine = routineTasks.map((t) =>
      serializeRoutineTask(t, { today }),
    );

    const journalWritten = journalToday !== null;
    const bestStreak = Math.max(
      0,
      ...serializedHabits.map((h) => h.streak),
      ...serializedRoutine.map((t) => t.streak),
    );

    const upcomingEnd = addDaysToKey(today, 6);
    const upcomingTodos = activeTodos
      .filter(
        (t) =>
          t.dueDate !== null &&
          dayKeyOfDate(t.dueDate) >= today &&
          dayKeyOfDate(t.dueDate) <= upcomingEnd,
      )
      .sort(compareUpcoming)
      .slice(0, 6);

    const activeGoals = activeGoalRows
      .slice()
      .sort((a, b) => {
        const ratioA = a.progress / Math.max(1, a.target);
        const ratioB = b.progress / Math.max(1, b.target);
        if (ratioA !== ratioB) return ratioB - ratioA;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, 4);

    const stats: DashboardStats = {
      today: {
        todosTotal: todosTotalOn(today),
        todosDone: todosDoneOn(today),
        habitsTotal: habits.length,
        habitsDone: habitsDoneOn(today),
        routineTotal: scheduledOn(today).length,
        routineDone: routineDoneOn(today),
        goalsActive: activeGoalRows.length,
        bestStreak,
        score: Math.min(100, dayScore(today) + (journalWritten ? 5 : 0)),
        journalWritten,
        overdueCount: activeTodos.filter(
          (t) => t.dueDate !== null && dayKeyOfDate(t.dueDate) < today,
        ).length,
      },
      week,
      activeGoals: activeGoals.map(serializeGoal),
      upcomingTodos: upcomingTodos.map(serializeTodo),
      todayHabits: serializedHabits.slice(0, 6),
      recentJournal: recentJournalRows.map(serializeJournalEntry),
      quote: QUOTES[dayOfYearOfKey(today) % QUOTES.length],
    };
    return json(stats);
  } catch (err) {
    return handleApiError(err);
  }
}
