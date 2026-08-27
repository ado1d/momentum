// ─────────────────────────────────────────────────────────────
// Momentum — shared domain types (frontend/backend contract)
// All dates sent over the wire are ISO strings (DateTime) or
// YYYY-MM-DD day keys (String) for local-day entities.
// ─────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high" | "urgent";
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

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  category: string;
  dueDate: string | null; // ISO
  reminderAt: string | null; // ISO
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodoInput {
  title: string;
  notes?: string | null;
  priority?: Priority;
  category?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
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
}

export interface DayStat {
  date: string; // YYYY-MM-DD
  todosCompleted: number;
  habitsCompleted: number;
  routineCompleted: number;
  score: number; // 0..100
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
  | "tasks"
  | "routine"
  | "goals"
  | "notes"
  | "diary"
  | "settings";
