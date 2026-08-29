// ─────────────────────────────────────────────────────────────
// Momentum — shared domain types (frontend/backend contract)
// All dates sent over the wire are ISO strings (DateTime) or
// YYYY-MM-DD day keys (String) for local-day entities.
// ─────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high" | "urgent";
export type RepeatKind = "none" | "daily" | "weekdays" | "weekly" | "monthly";
export type TodoCategory =
  | "personal"
  | "work"
  | "learning"
  | "health"
  | "other";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";
export type GoalPeriod = "daily" | "weekly" | "monthly";
export type GoalStatus = "active" | "completed" | "archived";
export type Mood = "great" | "good" | "okay" | "low" | "rough";
export type HabitColor =
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "teal"
  | "orange";
export type NoteColor =
  | "default"
  | "yellow"
  | "green"
  | "rose"
  | "violet"
  | "teal";

export interface Subtask {
  id: string;
  todoId: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubtaskInput {
  title: string;
}

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  category: string;
  dueDate: string | null; // ISO
  reminderAt: string | null; // ISO
  repeat: RepeatKind;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: Subtask[]; // ordered by sortOrder
}

export interface TodoInput {
  title: string;
  notes?: string | null;
  priority?: Priority;
  category?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  repeat?: RepeatKind;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
}

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: HabitColor;
  timeOfDay: TimeOfDay;
  reminderTime: string | null; // "HH:MM"
  targetPerDay: number;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  logs: HabitLog[]; // recent logs (last 60 days)
  streak: number; // computed server-side
  doneToday: boolean; // computed server-side
  completionsThisWeek: number; // computed server-side
}

export interface HabitInput {
  name: string;
  emoji?: string;
  color?: HabitColor;
  timeOfDay?: TimeOfDay;
  reminderTime?: string | null;
}

export interface RoutineLog {
  id: string;
  taskId: string;
  date: string;
}

export interface RoutineTask {
  id: string;
  name: string;
  emoji: string;
  section: TimeOfDay;
  time: string | null;
  days: string; // "1,2,3,4,5,6,7"
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  doneToday: boolean; // computed server-side
  streak: number; // computed server-side
}

export interface RoutineTaskInput {
  name: string;
  emoji?: string;
  section?: TimeOfDay;
  time?: string | null;
  days?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  color: NoteColor;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteInput {
  title?: string;
  content?: string;
  tag?: string | null;
  color?: NoteColor;
  pinned?: boolean;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string | null;
  content: string;
  mood: Mood | null;
  energy: number | null;
  gratitude: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryInput {
  date: string; // YYYY-MM-DD
  title?: string | null;
  content?: string;
  mood?: Mood | null;
  energy?: number | null;
  gratitude?: string | null;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  category: string;
  period: GoalPeriod;
  target: number;
  progress: number;
  unit: string | null;
  status: GoalStatus;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GoalInput {
  title: string;
  description?: string | null;
  category?: string;
  period?: GoalPeriod;
  target?: number;
  unit?: string | null;
  startDate?: string;
  endDate?: string | null;
}

export interface AppSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  weekStartsOn: number;
  defaultView: string;
  onboarded: boolean;
  timezone?: string | null; // IANA tz name (used for digest scheduling)
}

export interface DayStat {
  date: string; // YYYY-MM-DD
  todosCompleted: number;
  habitsCompleted: number;
  routineCompleted: number;
  score: number; // 0..100
}

// ─────────────────────────────────────────────────────────────
// Focus sessions (Pomodoro timer)
// ─────────────────────────────────────────────────────────────
export interface FocusSession {
  id: string;
  taskId: string | null;
  label: string | null;
  minutes: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
  createdAt: string;
}

export interface FocusSessionInput {
  taskId?: string | null;
  label?: string | null;
  minutes: number;
  startedAt?: string; // ISO, defaults to now - minutes
  endedAt?: string; // ISO, defaults to now
}

/** A focus session as shown in the recent-sessions list — the linked todo's
 *  title resolved at read time (null when unlinked or the task was deleted). */
export interface FocusSessionWithTask {
  id: string;
  minutes: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
  label: string | null;
  taskId: string | null;
  taskTitle: string | null; // resolved todo title; null when unlinked or task deleted
}

export interface FocusStats {
  todayMinutes: number;
  weekMinutes: number;
  lastWeekMinutes: number;
  totalSessions: number;
  todaySessions: number;
  /** Last 10 sessions (endedAt desc) with resolved task titles. */
  recent: FocusSessionWithTask[];
}

// ─────────────────────────────────────────────────────────────
// Insights (trends & analytics)
// ─────────────────────────────────────────────────────────────
export interface InsightsData {
  heatmap: DayStat[]; // last 12 weeks (84 days), oldest first
  todosTrend: { date: string; count: number }[]; // last 30 days
  habitConsistency: {
    id: string;
    name: string;
    emoji: string;
    color: string;
    pct: number; // 0..100 — last 30 days
    streak: number;
  }[];
  moodDistribution: { mood: Mood; count: number }[];
  focus: {
    todayMinutes: number;
    weekMinutes: number;
    lastWeekMinutes: number;
    avgSessionMinutes: number;
  };
  totals: {
    todosCompleted: number;
    journalEntries: number;
    habitChecks: number;
    bestHabitStreak: number;
    focusHours: number; // rounded to 1 decimal
  };
}

// ─────────────────────────────────────────────────────────────
// Global search (command palette)
// ─────────────────────────────────────────────────────────────
export interface SearchResults {
  todos: Todo[]; // active matches first, max 6
  notes: Note[]; // max 5
  goals: Goal[]; // max 5
  journal: JournalEntry[]; // max 5
  habits: Habit[]; // max 5
}

// ─────────────────────────────────────────────────────────────
// Weekly review (generated summary)
// ─────────────────────────────────────────────────────────────
export interface WeeklyReviewHabit {
  id: string;
  name: string;
  emoji: string;
  done: number; // days completed in the week
  total: number; // days scheduled (7)
  pct: number; // 0..100
}

export interface WeeklyReviewTask {
  title: string;
  completedAt: string | null; // ISO
  priority: string;
}

export interface WeeklyReviewGoal {
  id: string;
  title: string;
  period: GoalPeriod;
  progress: number;
  target: number;
  unit: string | null;
  status: GoalStatus;
}

export interface WeeklyReviewJournal {
  date: string; // YYYY-MM-DD
  title: string | null;
  mood: Mood | null;
}

export interface WeeklyReview {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string; // YYYY-MM-DD
  scores: DayStat[]; // 7 days, oldest first
  avgScore: number; // 0..100
  prevAvgScore: number; // previous week, 0..100
  bestDay: { date: string; score: number } | null;
  tasksCompleted: number;
  taskList: WeeklyReviewTask[]; // max 20, newest completion first
  habits: WeeklyReviewHabit[];
  goalSnapshots: WeeklyReviewGoal[]; // active goals
  journal: WeeklyReviewJournal[]; // entries written that week
  focusMinutes: number;
  focusSessions: number;
  focusVsLastWeek: number; // pct change vs previous week (e.g. +25 / -40)
  habitChecks: number; // total habit check-ins in the week
}

// ─────────────────────────────────────────────────────────────
// Backup import (round-trip of /api/export?format=json)
// ─────────────────────────────────────────────────────────────
export interface ImportCounts {
  todos: number;
  habits: number;
  routineTasks: number;
  notes: number;
  journal: number;
  goals: number;
  skipped: number; // rows skipped in merge mode (id already exists)
}

export interface ImportResult {
  ok: boolean;
  mode: "merge" | "replace";
  counts: ImportCounts;
  message: string;
}

export interface DashboardStats {
  today: {
    todosTotal: number;
    todosDone: number;
    habitsTotal: number;
    habitsDone: number;
    routineTotal: number;
    routineDone: number;
    goalsActive: number;
    bestStreak: number;
    score: number; // 0..100
    journalWritten: boolean;
    overdueCount: number;
  };
  week: DayStat[];
  activeGoals: Goal[];
  upcomingTodos: Todo[];
  todayHabits: Habit[];
  recentJournal: JournalEntry[];
  quote: { text: string; author: string };
}

export interface ToggleResult {
  done: boolean;
  streak?: number;
}

export const TODO_CATEGORIES: { value: TodoCategory; label: string; emoji: string }[] = [
  { value: "personal", label: "Personal", emoji: "🌿" },
  { value: "work", label: "Work", emoji: "💼" },
  { value: "learning", label: "Learning", emoji: "📚" },
  { value: "health", label: "Health", emoji: "💪" },
  { value: "other", label: "Other", emoji: "✨" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const REPEAT_OPTIONS: { value: RepeatKind; label: string; hint: string }[] = [
  { value: "none", label: "Never", hint: "One-off task" },
  { value: "daily", label: "Daily", hint: "Repeats every day" },
  { value: "weekdays", label: "Weekdays", hint: "Mon to Fri only" },
  { value: "weekly", label: "Weekly", hint: "Same day each week" },
  { value: "monthly", label: "Monthly", hint: "Same day each month" },
];

export const TIME_OF_DAY: { value: TimeOfDay; label: string; emoji: string }[] = [
  { value: "morning", label: "Morning", emoji: "🌅" },
  { value: "afternoon", label: "Afternoon", emoji: "☀️" },
  { value: "evening", label: "Evening", emoji: "🌙" },
  { value: "anytime", label: "Anytime", emoji: "🕒" },
];

export const GOAL_PERIODS: { value: GoalPeriod; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "Repeats every day" },
  { value: "weekly", label: "Weekly", hint: "Track progress each week" },
  { value: "monthly", label: "Monthly", hint: "Bigger picture targets" },
];

export const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: "great", label: "Great", emoji: "🤩" },
  { value: "good", label: "Good", emoji: "🙂" },
  { value: "okay", label: "Okay", emoji: "😐" },
  { value: "low", label: "Low", emoji: "🙁" },
  { value: "rough", label: "Rough", emoji: "😣" },
];

export const NOTE_COLORS: NoteColor[] = [
  "default",
  "yellow",
  "green",
  "rose",
  "violet",
  "teal",
];

export const HABIT_COLORS: HabitColor[] = [
  "emerald",
  "amber",
  "rose",
  "violet",
  "teal",
  "orange",
];

export type ViewId =
  | "dashboard"
  | "focus"
  | "tasks"
  | "routine"
  | "goals"
  | "notes"
  | "diary"
  | "insights"
  | "settings";
