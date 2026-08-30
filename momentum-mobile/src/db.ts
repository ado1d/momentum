// Momentum local database (SQLite) — the single source of truth on device.
// Offline-first: every mutation lands here instantly; sync (src/sync.ts) is
// a background, best-effort LWW merge with the Momentum web backend.

import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { ensureDriverReady } from "./driver";
import { dayKey, isoWeekday, newId, nowISO, streakFromKeys } from "./utils";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium', category TEXT NOT NULL DEFAULT 'personal',
  dueDate TEXT, reminderAt TEXT, repeat TEXT NOT NULL DEFAULT 'none',
  completed INTEGER NOT NULL DEFAULT 0, completedAt TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_todos_due ON todos(completed, dueDate) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY NOT NULL, todoId TEXT NOT NULL, title TEXT NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0, sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_subtasks_todo ON subtasks(todoId) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '✅',
  color TEXT NOT NULL DEFAULT 'emerald', timeOfDay TEXT NOT NULL DEFAULT 'anytime',
  reminderTime TEXT, targetPerDay INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0, sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_habits_arch ON habits(archived) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS habitLogs (
  id TEXT PRIMARY KEY NOT NULL, habitId TEXT NOT NULL, date TEXT NOT NULL,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT,
  UNIQUE(habitId, date)
);
CREATE INDEX IF NOT EXISTS idx_hlogs_date ON habitLogs(date);

CREATE TABLE IF NOT EXISTS routineTasks (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🌅',
  section TEXT NOT NULL DEFAULT 'morning', time TEXT,
  days TEXT NOT NULL DEFAULT '1,2,3,4,5,6,7',
  archived INTEGER NOT NULL DEFAULT 0, sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_rt_section ON routineTasks(section) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS routineLogs (
  id TEXT PRIMARY KEY NOT NULL, taskId TEXT NOT NULL, date TEXT NOT NULL,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT,
  UNIQUE(taskId, date)
);
CREATE INDEX IF NOT EXISTS idx_rlogs_date ON routineLogs(date);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL DEFAULT 'Untitled note',
  content TEXT NOT NULL DEFAULT '', tag TEXT,
  color TEXT NOT NULL DEFAULT 'default', pinned INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_notes_upd ON notes(updatedAt);

CREATE TABLE IF NOT EXISTS journal (
  id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL,
  title TEXT, content TEXT NOT NULL DEFAULT '', mood TEXT, energy INTEGER, gratitude TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT,
  UNIQUE(date)
);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, description TEXT,
  category TEXT NOT NULL DEFAULT 'learning', period TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 1, progress INTEGER NOT NULL DEFAULT 0, unit TEXT,
  status TEXT NOT NULL DEFAULT 'active', startDate TEXT NOT NULL, endDate TEXT,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status) WHERE deletedAt IS NULL;

CREATE TABLE IF NOT EXISTS focusSessions (
  id TEXT PRIMARY KEY NOT NULL, taskId TEXT, label TEXT,
  minutes INTEGER NOT NULL, startedAt TEXT NOT NULL, endedAt TEXT NOT NULL,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_focus_ended ON focusSessions(endedAt) WHERE deletedAt IS NULL;
`;

export type DbHandle = SQLite.SQLiteDatabase;

let handle: DbHandle | null = null;

function createHandle(): DbHandle {
  const h = SQLite.openDatabaseSync("momentum.db");
  h.execSync(SCHEMA_SQL);
  return h;
}

// Native: the SQLite driver is synchronous — open eagerly (identical to the
// previous behaviour). Web: opening is deferred to initDatabase() below.
if (Platform.OS !== "web") {
  handle = createHandle();
}

export let db: DbHandle = handle as DbHandle;

/**
 * Resolves the storage driver before first use. No-op on native; on web the
 * SQLite engine loads asynchronously. Call before touching `db`.
 */
export async function initDatabase(): Promise<void> {
  if (handle) return;
  await ensureDriverReady();
  handle = createHandle();
  db = handle;
}

// ─────────────────────────────────────────────────────────────
// Types (mobile row shapes — dates are ISO strings / YYYY-MM-DD keys)
// ─────────────────────────────────────────────────────────────

export interface BaseRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Todo extends BaseRow {
  title: string;
  notes: string | null;
  priority: string;
  category: string;
  dueDate: string | null; // ISO datetime or null
  reminderAt: string | null;
  repeat: string;
  completed: 0 | 1;
  completedAt: string | null;
}

export interface Subtask extends BaseRow {
  todoId: string;
  title: string;
  completed: 0 | 1;
  sortOrder: number;
}

export interface Habit extends BaseRow {
  name: string;
  emoji: string;
  color: string;
  timeOfDay: string;
  reminderTime: string | null; // "08:00"
  targetPerDay: number;
  archived: 0 | 1;
  sortOrder: number;
}

export interface HabitLog extends BaseRow {
  habitId: string;
  date: string; // YYYY-MM-DD
}

export interface RoutineTask extends BaseRow {
  name: string;
  emoji: string;
  section: string; // morning | afternoon | evening
  time: string | null;
  days: string; // "1,2,3,4,5,6,7"
  archived: 0 | 1;
  sortOrder: number;
}

export interface RoutineLog extends BaseRow {
  taskId: string;
  date: string;
}

export interface Note extends BaseRow {
  title: string;
  content: string;
  tag: string | null;
  color: string;
  pinned: 0 | 1;
}

export interface JournalEntry extends BaseRow {
  date: string; // YYYY-MM-DD
  title: string | null;
  content: string;
  mood: string | null;
  energy: number | null;
  gratitude: string | null;
}

export interface Goal extends BaseRow {
  title: string;
  description: string | null;
  category: string;
  period: string; // daily | weekly | monthly
  target: number;
  progress: number;
  unit: string | null;
  status: string; // active | completed | archived
  startDate: string;
  endDate: string | null;
}

export interface FocusSession extends BaseRow {
  taskId: string | null;
  label: string | null;
  minutes: number;
  startedAt: string;
  endedAt: string;
}

export type TableName =
  | "todos"
  | "subtasks"
  | "habits"
  | "habitLogs"
  | "routineTasks"
  | "routineLogs"
  | "notes"
  | "journal"
  | "goals"
  | "focusSessions";

// ─────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────

// (declared as SCHEMA_SQL above — applied on open)

// ─────────────────────────────────────────────────────────────
// kv store (settings / auth persistence)
// ─────────────────────────────────────────────────────────────

export function kvGet(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>(
    "SELECT value FROM kv WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  db.runSync(
    "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

// ─────────────────────────────────────────────────────────────
// Generic helpers
// ─────────────────────────────────────────────────────────────

type AnyRow = Record<string, unknown>;

export function list<T extends AnyRow>(table: TableName, where = "", params: (string | number | null)[] = []): T[] {
  const sql = `SELECT * FROM ${table} ${where}`;
  const rows = db.getAllSync<T & AnyRow>(sql, params);
  for (const r of rows) {
    const row = r as AnyRow;
    if ("completed" in row) row.completed = row.completed ? 1 : 0;
    if ("archived" in row) row.archived = row.archived ? 1 : 0;
    if ("pinned" in row) row.pinned = row.pinned ? 1 : 0;
  }
  return rows as unknown as T[];
}

/** Soft delete (tombstone) — the row is kept so the deletion can sync. */
export function softDelete(table: TableName, id: string): void {
  const now = nowISO();
  db.runSync(
    `UPDATE ${table} SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
    now,
    now,
    id,
  );
}

/** Hard delete (used when adopting server rows with different ids). */
function hardDelete(table: TableName, id: string): void {
  db.runSync(`DELETE FROM ${table} WHERE id = ?`, id);
}

function bumpRow(table: TableName, id: string): void {
  db.runSync(`UPDATE ${table} SET updatedAt = ? WHERE id = ?`, nowISO(), id);
}

// ─────────────────────────────────────────────────────────────
// Todos
// ─────────────────────────────────────────────────────────────

export interface TodoInput {
  title: string;
  notes?: string | null;
  priority?: string;
  category?: string;
  dueDate?: string | null;
  reminderAt?: string | null;
  repeat?: string;
}

export function saveTodo(id: string | null, input: TodoInput): Todo {
  const now = nowISO();
  if (id) {
    const existing = db.getFirstSync<Todo & AnyRow>("SELECT * FROM todos WHERE id = ?", id);
    if (existing) {
      db.runSync(
        `UPDATE todos SET title=?, notes=?, priority=?, category=?, dueDate=?, reminderAt=?, repeat=?, updatedAt=? WHERE id=?`,
        input.title,
        input.notes ?? existing.notes ?? null,
        input.priority ?? existing.priority,
        input.category ?? existing.category,
        input.dueDate === undefined ? existing.dueDate : input.dueDate,
        input.reminderAt === undefined ? existing.reminderAt : input.reminderAt,
        input.repeat ?? existing.repeat,
        now,
        id,
      );
      return db.getFirstSync<Todo & AnyRow>("SELECT * FROM todos WHERE id = ?", id) as unknown as Todo;
    }
  }
  const rowId = id ?? newId();
  db.runSync(
    `INSERT INTO todos (id, title, notes, priority, category, dueDate, reminderAt, repeat, completed, completedAt, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,'0',NULL,?,?)`,
    rowId,
    input.title,
    input.notes ?? null,
    input.priority ?? "medium",
    input.category ?? "personal",
    input.dueDate ?? null,
    input.reminderAt ?? null,
    input.repeat ?? "none",
    now,
    now,
  );
  return db.getFirstSync<Todo & AnyRow>("SELECT * FROM todos WHERE id = ?", rowId) as unknown as Todo;
}

export function setTodoCompleted(id: string, completed: boolean): void {
  const now = nowISO();
  const todo = db.getFirstSync<Todo & AnyRow>("SELECT * FROM todos WHERE id = ?", id);
  if (!todo) return;
  db.runSync(
    `UPDATE todos SET completed=?, completedAt=?, updatedAt=? WHERE id=?`,
    completed ? 1 : 0,
    completed ? (todo.completedAt ?? now) : null,
    now,
    id,
  );
}

export function todosForDay(key: string): Todo[] {
  const rows = list<Todo & AnyRow>(
    "todos",
    "WHERE deletedAt IS NULL AND completed = 0 ORDER BY CASE WHEN dueDate IS NULL THEN 1 ELSE 0 END, dueDate ASC",
  );
  const active = rows.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return dayKey(d) === key;
  });
  return active as unknown as Todo[];
}

export function todosOverdue(): Todo[] {
  const rows = list<Todo & AnyRow>(
    "todos",
    "WHERE deletedAt IS NULL AND completed = 0 ORDER BY dueDate ASC",
  );
  const today = dayKey();
  return rows.filter((t) => t.dueDate && dayKey(t.dueDate) < today) as unknown as Todo[];
}

export function activeTodos(): Todo[] {
  return list<Todo & AnyRow>(
    "todos",
    "WHERE deletedAt IS NULL AND completed = 0 ORDER BY CASE WHEN dueDate IS NULL THEN 1 ELSE 0 END, dueDate ASC, createdAt DESC",
  ) as unknown as Todo[];
}

export function completedTodos(limit = 200): Todo[] {
  return list<Todo & AnyRow>(
    "todos",
    "WHERE deletedAt IS NULL AND completed = 1 ORDER BY completedAt DESC LIMIT ?",
    [limit],
  ) as unknown as Todo[];
}

export function allTodos(): Todo[] {
  return list<Todo & AnyRow>("todos", "WHERE deletedAt IS NULL") as unknown as Todo[];
}

export function getTodo(id: string): Todo | null {
  const r = db.getFirstSync<Todo & AnyRow>("SELECT * FROM todos WHERE id = ?", id);
  return (r as unknown as Todo) ?? null;
}

// ─────────────────────────────────────────────────────────────
// Subtasks
// ─────────────────────────────────────────────────────────────

export function subtasksOf(todoId: string): Subtask[] {
  return list<Subtask & AnyRow>(
    "subtasks",
    "WHERE deletedAt IS NULL AND todoId = ? ORDER BY sortOrder ASC",
    [todoId],
  ) as unknown as Subtask[];
}

export function addSubtask(todoId: string, title: string): void {
  const count = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM subtasks WHERE todoId = ? AND deletedAt IS NULL",
    todoId,
  );
  const now = nowISO();
  db.runSync(
    `INSERT INTO subtasks (id, todoId, title, completed, sortOrder, createdAt, updatedAt)
     VALUES (?,?,?,'0',?,?,?)`,
    newId(),
    todoId,
    title,
    count?.n ?? 0,
    now,
    now,
  );
  bumpRow("todos", todoId);
}

export function setSubtaskCompleted(id: string, completed: boolean): void {
  const row = db.getFirstSync<Subtask & AnyRow>("SELECT * FROM subtasks WHERE id = ?", id);
  db.runSync(`UPDATE subtasks SET completed=?, updatedAt=? WHERE id=?`, completed ? 1 : 0, nowISO(), id);
  if (row) bumpRow("todos", row.todoId);
}

export function deleteSubtask(id: string): void {
  const row = db.getFirstSync<Subtask & AnyRow>("SELECT * FROM subtasks WHERE id = ?", id);
  softDelete("subtasks", id);
  if (row) bumpRow("todos", row.todoId);
}

// ─────────────────────────────────────────────────────────────
// Habits
// ─────────────────────────────────────────────────────────────

export interface HabitWithStats extends Habit {
  doneToday: boolean;
  streak: number;
  last7: boolean[]; // oldest → newest (Mon-anchored window ending today)
  last7Dates: string[]; // matching day keys for the same window
  last7DoneSet: string[]; // day keys actually done in that window
  total: number;
}

export function habits(includeArchived = false): HabitWithStats[] {
  const rows = list<Habit & AnyRow>(
    "habits",
    includeArchived
      ? "WHERE deletedAt IS NULL ORDER BY sortOrder ASC, createdAt ASC"
      : "WHERE deletedAt IS NULL AND archived = 0 ORDER BY sortOrder ASC, createdAt ASC",
  );
  const today = dayKey();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  const logs = list<HabitLog & AnyRow>(
    "habitLogs",
    "WHERE deletedAt IS NULL AND date >= ?",
    [dayKey(from)],
  );
  const byHabit = new Map<string, HabitLog[]>();
  for (const l of logs) {
    const arr = byHabit.get(l.habitId) ?? [];
    arr.push(l);
    byHabit.set(l.habitId, arr);
  }
  const allLogs = list<HabitLog & AnyRow>("habitLogs", "WHERE deletedAt IS NULL");
  const totals = new Map<string, number>();
  for (const l of allLogs) totals.set(l.habitId, (totals.get(l.habitId) ?? 0) + 1);

  return rows.map((h) => {
    const hLogs = byHabit.get(h.id) ?? [];
    const keys = new Set(hLogs.map((l) => l.date));
    const last7: boolean[] = [];
    const last7Dates: string[] = [];
    const last7DoneSet: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      last7Dates.push(key);
      if (keys.has(key)) last7DoneSet.push(key);
      last7.push(keys.has(key));
    }
    return {
      ...(h as unknown as Habit),
      doneToday: keys.has(today),
      streak: streakFromKeys(keys),
      last7,
      last7Dates,
      last7DoneSet,
      total: totals.get(h.id) ?? 0,
    };
  });
}

export function habitLogExists(habitId: string, date: string): boolean {
  const row = db.getFirstSync<{ id: string }>(
    "SELECT id FROM habitLogs WHERE habitId = ? AND date = ? AND deletedAt IS NULL",
    habitId,
    date,
  );
  return !!row;
}

export function toggleHabit(habitId: string, date: string): boolean {
  const existing = db.getFirstSync<HabitLog & AnyRow>(
    "SELECT * FROM habitLogs WHERE habitId = ? AND date = ?",
    habitId,
    date,
  );
  const now = nowISO();
  if (existing && !existing.deletedAt) {
    softDelete("habitLogs", existing.id);
    bumpRow("habits", habitId);
    return false;
  }
  if (existing && existing.deletedAt) {
    db.runSync(
      "UPDATE habitLogs SET deletedAt = NULL, updatedAt = ? WHERE id = ?",
      now,
      existing.id,
    );
    bumpRow("habits", habitId);
    return true;
  }
  db.runSync(
    `INSERT INTO habitLogs (id, habitId, date, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    newId(),
    habitId,
    date,
    now,
    now,
  );
  bumpRow("habits", habitId);
  return true;
}

export interface HabitInput {
  name: string;
  emoji?: string;
  color?: string;
  timeOfDay?: string;
  reminderTime?: string | null;
  targetPerDay?: number;
}

export function saveHabit(id: string | null, input: HabitInput): void {
  const now = nowISO();
  if (id && db.getFirstSync("SELECT id FROM habits WHERE id = ?", id)) {
    db.runSync(
      `UPDATE habits SET name=?, emoji=?, color=?, timeOfDay=?, reminderTime=?, targetPerDay=?, updatedAt=? WHERE id=?`,
      input.name,
      input.emoji ?? "✅",
      input.color ?? "emerald",
      input.timeOfDay ?? "anytime",
      input.reminderTime ?? null,
      input.targetPerDay ?? 1,
      now,
      id,
    );
    return;
  }
  const count = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM habits WHERE deletedAt IS NULL",
  );
  db.runSync(
    `INSERT INTO habits (id, name, emoji, color, timeOfDay, reminderTime, targetPerDay, archived, sortOrder, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,'0',?,?,?)`,
    id ?? newId(),
    input.name,
    input.emoji ?? "✅",
    input.color ?? "emerald",
    input.timeOfDay ?? "anytime",
    input.reminderTime ?? null,
    input.targetPerDay ?? 1,
    count?.n ?? 0,
    now,
    now,
  );
}

// ─────────────────────────────────────────────────────────────
// Routine
// ─────────────────────────────────────────────────────────────

export interface RoutineTaskWithDone extends RoutineTask {
  done: boolean;
  applies: boolean;
}

export function routineForDay(date: string): RoutineTaskWithDone[] {
  const wd = isoWeekday(new Date(`${date}T12:00:00`));
  const tasks = list<RoutineTask & AnyRow>(
    "routineTasks",
    "WHERE deletedAt IS NULL AND archived = 0 ORDER BY sortOrder ASC, time ASC",
  );
  const logs = list<RoutineLog & AnyRow>(
    "routineLogs",
    "WHERE deletedAt IS NULL AND date = ?",
    [date],
  );
  const doneIds = new Set(logs.map((l) => l.taskId));
  return tasks.map((t) => ({
    ...(t as unknown as RoutineTask),
    done: doneIds.has(t.id),
    applies: (t.days || "1,2,3,4,5,6,7")
      .split(",")
      .map((s) => parseInt(s, 10))
      .includes(wd),
  }));
}

/** All live routine tasks (any weekday) — used by the reminder scheduler. */
export function routineTasksAll(): RoutineTask[] {
  return list<RoutineTask & AnyRow>(
    "routineTasks",
    "WHERE deletedAt IS NULL AND archived = 0 ORDER BY sortOrder ASC",
  ) as unknown as RoutineTask[];
}

export function toggleRoutineTask(taskId: string, date: string): boolean {
  const existing = db.getFirstSync<RoutineLog & AnyRow>(
    "SELECT * FROM routineLogs WHERE taskId = ? AND date = ?",
    taskId,
    date,
  );
  const now = nowISO();
  if (existing && !existing.deletedAt) {
    softDelete("routineLogs", existing.id);
    bumpRow("routineTasks", taskId);
    return false;
  }
  if (existing && existing.deletedAt) {
    db.runSync(
      "UPDATE routineLogs SET deletedAt = NULL, updatedAt = ? WHERE id = ?",
      now,
      existing.id,
    );
    bumpRow("routineTasks", taskId);
    return true;
  }
  db.runSync(
    `INSERT INTO routineLogs (id, taskId, date, createdAt, updatedAt) VALUES (?,?,?,?,?)`,
    newId(),
    taskId,
    date,
    now,
    now,
  );
  bumpRow("routineTasks", taskId);
  return true;
}

export interface RoutineInput {
  name: string;
  emoji?: string;
  section?: string;
  time?: string | null;
  days?: string;
}

export function saveRoutineTask(id: string | null, input: RoutineInput): void {
  const now = nowISO();
  if (id && db.getFirstSync("SELECT id FROM routineTasks WHERE id = ?", id)) {
    db.runSync(
      `UPDATE routineTasks SET name=?, emoji=?, section=?, time=?, days=?, updatedAt=? WHERE id=?`,
      input.name,
      input.emoji ?? "🌅",
      input.section ?? "morning",
      input.time ?? null,
      input.days ?? "1,2,3,4,5,6,7",
      now,
      id,
    );
    return;
  }
  const count = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM routineTasks WHERE deletedAt IS NULL",
  );
  db.runSync(
    `INSERT INTO routineTasks (id, name, emoji, section, time, days, archived, sortOrder, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,'0',?,?,?)`,
    id ?? newId(),
    input.name,
    input.emoji ?? "🌅",
    input.section ?? "morning",
    input.time ?? null,
    input.days ?? "1,2,3,4,5,6,7",
    count?.n ?? 0,
    now,
    now,
  );
}

// ─────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────

export function notesList(search = ""): Note[] {
  const q = search.trim().toLowerCase();
  const rows = list<Note & AnyRow>(
    "notes",
    "WHERE deletedAt IS NULL ORDER BY pinned DESC, updatedAt DESC",
  );
  if (!q) return rows as unknown as Note[];
  return (rows as unknown as Note[]).filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.tag ?? "").toLowerCase().includes(q),
  );
}

/** Distinct tags across notes, alphabetical — for the filter chips. */
export function noteTags(notes: Note[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    if (n.tag) counts.set(n.tag, (counts.get(n.tag) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function getNote(id: string): Note | null {
  const r = db.getFirstSync<Note & AnyRow>("SELECT * FROM notes WHERE id = ?", id);
  return (r as unknown as Note) ?? null;
}

export interface NoteInput {
  title?: string;
  content?: string;
  tag?: string | null;
  color?: string;
  pinned?: boolean;
}

export function saveNote(id: string | null, input: NoteInput): string {
  const now = nowISO();
  if (id) {
    const existing = db.getFirstSync<Note & AnyRow>("SELECT * FROM notes WHERE id = ?", id);
    if (existing) {
      db.runSync(
        `UPDATE notes SET title=?, content=?, tag=?, color=?, pinned=?, updatedAt=? WHERE id=?`,
        input.title ?? existing.title,
        input.content ?? existing.content,
        input.tag === undefined ? existing.tag : input.tag,
        input.color ?? existing.color,
        input.pinned === undefined ? existing.pinned : input.pinned ? 1 : 0,
        now,
        id,
      );
      return id;
    }
  }
  const rowId = id ?? newId();
  db.runSync(
    `INSERT INTO notes (id, title, content, tag, color, pinned, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?)`,
    rowId,
    input.title || "Untitled note",
    input.content ?? "",
    input.tag ?? null,
    input.color ?? "default",
    input.pinned ? 1 : 0,
    now,
    now,
  );
  return rowId;
}

// ─────────────────────────────────────────────────────────────
// Journal
// ─────────────────────────────────────────────────────────────

export function journalFor(date: string): JournalEntry | null {
  const r = db.getFirstSync<JournalEntry & AnyRow>(
    "SELECT * FROM journal WHERE date = ? AND deletedAt IS NULL",
    date,
  );
  return (r as unknown as JournalEntry) ?? null;
}

export function journalList(limit = 60): JournalEntry[] {
  return list<JournalEntry & AnyRow>(
    "journal",
    "WHERE deletedAt IS NULL ORDER BY date DESC LIMIT ?",
    [limit],
  ) as unknown as JournalEntry[];
}

export interface JournalInput {
  date: string;
  title?: string | null;
  content?: string;
  mood?: string | null;
  energy?: number | null;
  gratitude?: string | null;
}

/** Upsert strictly by local date — the journal is one-entry-per-day. */
export function saveJournal(input: JournalInput): string {
  const now = nowISO();
  const existing = db.getFirstSync<JournalEntry & AnyRow>(
    "SELECT * FROM journal WHERE date = ?",
    input.date,
  );
  if (existing && !existing.deletedAt) {
    db.runSync(
      `UPDATE journal SET title=?, content=?, mood=?, energy=?, gratitude=?, updatedAt=? WHERE id=?`,
      input.title === undefined ? existing.title : input.title,
      input.content ?? existing.content,
      input.mood === undefined ? existing.mood : input.mood,
      input.energy === undefined ? existing.energy : input.energy,
      input.gratitude === undefined ? existing.gratitude : input.gratitude,
      now,
      existing.id,
    );
    return existing.id;
  }
  if (existing && existing.deletedAt) {
    // Editing a tombstoned day: resurrect with the same id.
    db.runSync(
      `UPDATE journal SET title=?, content=?, mood=?, energy=?, gratitude=?, deletedAt=NULL, updatedAt=? WHERE id=?`,
      input.title ?? null,
      input.content ?? "",
      input.mood ?? null,
      input.energy ?? null,
      input.gratitude ?? null,
      now,
      existing.id,
    );
    return existing.id;
  }
  const id = newId();
  db.runSync(
    `INSERT INTO journal (id, date, title, content, mood, energy, gratitude, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id,
    input.date,
    input.title ?? null,
    input.content ?? "",
    input.mood ?? null,
    input.energy ?? null,
    input.gratitude ?? null,
    now,
    now,
  );
  return id;
}

// ─────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────

export function goalsList(status: "active" | "completed" | "all" = "active"): Goal[] {
  const where =
    status === "all"
      ? "WHERE deletedAt IS NULL"
      : `WHERE deletedAt IS NULL AND status = '${status}'`;
  return list<Goal & AnyRow>(
    "goals",
    `${where} ORDER BY createdAt DESC`,
  ) as unknown as Goal[];
}

export function getGoal(id: string): Goal | null {
  const r = db.getFirstSync<Goal & AnyRow>("SELECT * FROM goals WHERE id = ?", id);
  return (r as unknown as Goal) ?? null;
}

export interface GoalInput {
  title: string;
  description?: string | null;
  category?: string;
  period?: string;
  target?: number;
  progress?: number;
  unit?: string | null;
  status?: string;
  startDate?: string;
  endDate?: string | null;
}

export function saveGoal(id: string | null, input: GoalInput): void {
  const now = nowISO();
  if (id && db.getFirstSync("SELECT id FROM goals WHERE id = ?", id)) {
    db.runSync(
      `UPDATE goals SET title=?, description=?, category=?, period=?, target=?, progress=?, unit=?, status=?, startDate=?, endDate=?, updatedAt=? WHERE id=?`,
      input.title,
      input.description ?? null,
      input.category ?? "learning",
      input.period ?? "daily",
      input.target ?? 1,
      input.progress ?? 0,
      input.unit ?? null,
      input.status ?? "active",
      input.startDate ?? dayKey(),
      input.endDate ?? null,
      now,
      id,
    );
    return;
  }
  db.runSync(
    `INSERT INTO goals (id, title, description, category, period, target, progress, unit, status, startDate, endDate, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id ?? newId(),
    input.title,
    input.description ?? null,
    input.category ?? "learning",
    input.period ?? "daily",
    input.target ?? 1,
    input.progress ?? 0,
    input.unit ?? null,
    input.status ?? "active",
    input.startDate ?? dayKey(),
    input.endDate ?? null,
    now,
    now,
  );
}

export function adjustGoalProgress(id: string, delta: number): void {
  const g = getGoal(id);
  if (!g) return;
  const progress = Math.max(0, g.progress + delta);
  const status =
    progress >= g.target ? "completed" : g.status === "completed" ? "active" : g.status;
  db.runSync(
    `UPDATE goals SET progress=?, status=?, updatedAt=? WHERE id=?`,
    progress,
    status,
    nowISO(),
    id,
  );
}

// ─────────────────────────────────────────────────────────────
// Focus sessions
// ─────────────────────────────────────────────────────────────

export function saveFocusSession(minutes: number, label: string | null, taskId: string | null, startedAt: string): void {
  const now = nowISO();
  db.runSync(
    `INSERT INTO focusSessions (id, taskId, label, minutes, startedAt, endedAt, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?,?,?)`,
    newId(),
    taskId,
    label,
    minutes,
    startedAt,
    now,
    now,
    now,
  );
}

export function focusSessionsForDay(date: string): FocusSession[] {
  return list<FocusSession & AnyRow>(
    "focusSessions",
    "WHERE deletedAt IS NULL AND date(endedAt) = date(?) ORDER BY endedAt DESC",
    [`${date}T12:00:00`],
  ) as unknown as FocusSession[];
}

export function focusSessionsSince(isoDate: string): FocusSession[] {
  return list<FocusSession & AnyRow>(
    "focusSessions",
    "WHERE deletedAt IS NULL AND endedAt >= ? ORDER BY endedAt DESC",
    [isoDate],
  ) as unknown as FocusSession[];
}

// ─────────────────────────────────────────────────────────────
// Insights
// ─────────────────────────────────────────────────────────────

export interface DayStat {
  key: string;
  completed: number;
  focusMinutes: number;
  habitDone: number;
  habitTotal: number;
  journalMood: string | null;
}

export function statsForDays(days: number): DayStat[] {
  const out: DayStat[] = [];
  const today = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  const fromKey = dayKey(from);

  const todos = list<Todo & AnyRow>(
    "todos",
    "WHERE deletedAt IS NULL AND completed = 1 AND completedAt IS NOT NULL AND completedAt >= ?",
    [`${fromKey}T00:00:00`],
  );
  const focus = list<FocusSession & AnyRow>(
    "focusSessions",
    "WHERE deletedAt IS NULL AND endedAt >= ?",
    [`${fromKey}T00:00:00`],
  );
  const habitCount = db.getFirstSync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM habits WHERE deletedAt IS NULL AND archived = 0",
  )?.n ?? 0;
  const hlogs = list<HabitLog & AnyRow>(
    "habitLogs",
    "WHERE deletedAt IS NULL AND date >= ?",
    [fromKey],
  );
  const journals = list<JournalEntry & AnyRow>(
    "journal",
    "WHERE deletedAt IS NULL AND date >= ?",
    [fromKey],
  );

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    out.push({
      key,
      completed: todos.filter((t) => t.completedAt && dayKey(t.completedAt) === key).length,
      focusMinutes: focus
        .filter((f) => dayKey(f.endedAt) === key)
        .reduce((s, f) => s + f.minutes, 0),
      habitDone: hlogs.filter((l) => l.date === key).length,
      habitTotal: habitCount,
      journalMood: journals.find((j) => j.date === key)?.mood ?? null,
    });
  }
  return out;
}

export function totals(): {
  todosCompleted: number;
  notes: number;
  journalEntries: number;
  focusMinutes: number;
} {
  const todosCompleted =
    db.getFirstSync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM todos WHERE deletedAt IS NULL AND completed = 1",
    )?.n ?? 0;
  const notes =
    db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM notes WHERE deletedAt IS NULL")?.n ?? 0;
  const journalEntries =
    db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM journal WHERE deletedAt IS NULL")?.n ?? 0;
  const focusMinutes =
    db.getFirstSync<{ n: number }>(
      "SELECT COALESCE(SUM(minutes), 0) AS n FROM focusSessions WHERE deletedAt IS NULL",
    )?.n ?? 0;
  return { todosCompleted, notes, journalEntries, focusMinutes };
}

// ─────────────────────────────────────────────────────────────
// Dashboard model (mirrors the web app's /api/stats computation)
// ─────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

function routineApplies(days: string, key: string): boolean {
  const wd = isoWeekday(new Date(`${key}T12:00:00`));
  return (days || "1,2,3,4,5,6,7")
    .split(",")
    .map((s) => parseInt(s, 10))
    .includes(wd);
}

export interface DashboardModel {
  score: number;
  todosDone: number;
  todosTotal: number;
  habitsDone: number;
  habitsTotal: number;
  routineDone: number;
  routineTotal: number;
  bestStreak: number;
  focusMinutesToday: number;
  overdueCount: number;
  overdue: Todo[];
  upcoming: Todo[]; // next 7 days, sorted like the web (due → priority → created)
  habits: HabitWithStats[];
  activeGoals: Goal[];
  recentJournal: JournalEntry[];
  week: { key: string; score: number; todosCompleted: number; habitsCompleted: number }[];
}

export function dashboardModel(): DashboardModel {
  const today = dayKey();
  const todos = allTodos();
  const active = todos.filter((t) => !t.completed);
  const completed = todos.filter((t) => !!t.completed);

  const todosDoneOn = (key: string) =>
    completed.filter((t) => t.completedAt && dayKey(t.completedAt) === key).length;
  const todosTotalOn = (key: string) =>
    todosDoneOn(key) + active.filter((t) => !t.dueDate || dayKey(t.dueDate) <= key).length;

  const allHabits = habits();
  const allHabitLogs = list<HabitLog & AnyRow>("habitLogs", "WHERE deletedAt IS NULL");
  const habitsDoneOn = (key: string) =>
    allHabits.filter((h) => allHabitLogs.some((l) => l.habitId === h.id && l.date === key)).length;

  const rTasks = list<RoutineTask & AnyRow>(
    "routineTasks",
    "WHERE deletedAt IS NULL AND archived = 0",
  );
  const scheduledOn = (key: string) => rTasks.filter((t) => routineApplies(t.days, key));
  const rLogs = list<RoutineLog & AnyRow>("routineLogs", "WHERE deletedAt IS NULL");
  const routineDoneOn = (key: string) =>
    scheduledOn(key).filter((t) => rLogs.some((l) => l.taskId === t.id && l.date === key)).length;

  const dayScore = (key: string) =>
    Math.round(
      (50 * todosDoneOn(key)) / Math.max(1, todosTotalOn(key)) +
        (30 * habitsDoneOn(key)) / Math.max(1, allHabits.length) +
        (20 * routineDoneOn(key)) / Math.max(1, scheduledOn(key).length),
    );

  const week: DashboardModel["week"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    week.push({
      key,
      score: dayScore(key),
      todosCompleted: todosDoneOn(key),
      habitsCompleted: habitsDoneOn(key),
    });
  }

  const overdue = active.filter((t) => t.dueDate && dayKey(t.dueDate) < today);
  const dueSoon = active.filter(
    (t) => t.dueDate && dayKey(t.dueDate) >= today && dayKey(t.dueDate) <= addDaysKeyLocal(today, 7),
  );
  dueSoon.sort((a, b) => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const dbb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (da !== dbb) return da - dbb;
    return (PRIORITY_WEIGHT[b.priority] ?? 1) - (PRIORITY_WEIGHT[a.priority] ?? 1);
  });

  return {
    score: dayScore(today),
    todosDone: todosDoneOn(today),
    todosTotal: todosTotalOn(today),
    habitsDone: habitsDoneOn(today),
    habitsTotal: allHabits.length,
    routineDone: routineDoneOn(today),
    routineTotal: scheduledOn(today).length,
    bestStreak: allHabits.reduce((m, h) => Math.max(m, h.streak), 0),
    focusMinutesToday: focusSessionsForDay(today).reduce((s, f) => s + f.minutes, 0),
    overdueCount: overdue.length,
    overdue,
    upcoming: dueSoon,
    habits: allHabits,
    activeGoals: goalsList("active"),
    recentJournal: journalList(3),
    week,
  };
}

function addDaysKeyLocal(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return dayKey(dt);
}

// ─────────────────────────────────────────────────────────────
// Sync: collect local dataset (incl. tombstones) & apply server state
// ─────────────────────────────────────────────────────────────

export function collectAll(): Record<TableName, AnyRow[]> {
  const tables: TableName[] = [
    "todos",
    "subtasks",
    "habits",
    "habitLogs",
    "routineTasks",
    "routineLogs",
    "notes",
    "journal",
    "goals",
    "focusSessions",
  ];
  const out = {} as Record<TableName, AnyRow[]>;
  for (const t of tables) {
    out[t] = list<AnyRow>(t, "WHERE updatedAt > COALESCE(deletedAt, '') OR deletedAt IS NOT NULL");
    // ↑ rows updated after their deletion OR any tombstone — simplest correct
    //   superset: just send everything; datasets are small.
    out[t] = list<AnyRow>(t);
  }
  return out;
}

export function pendingSince(iso: string | null): number {
  if (!iso) return -1;
  const tables: TableName[] = [
    "todos",
    "subtasks",
    "habits",
    "habitLogs",
    "routineTasks",
    "routineLogs",
    "notes",
    "journal",
    "goals",
    "focusSessions",
  ];
  let n = 0;
  for (const t of tables) {
    n +=
      db.getFirstSync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${t} WHERE updatedAt > ? OR (deletedAt IS NOT NULL AND deletedAt > ?)`,
        iso,
        iso,
      )?.n ?? 0;
  }
  return n;
}

export interface Tombstone {
  table: TableName;
  id: string;
  deletedAt: string;
}

interface ServerRow {
  id: string;
  updatedAt: string;
  deletedAt?: string | null;
  [k: string]: unknown;
}

/**
 * Apply the server's merged dataset. LWW: a server row replaces the local row
 * when the server copy is strictly newer. Cascade tombstones (e.g. a deleted
 * habit also clears its logs) are applied on top.
 */
export function applyServerData(
  data: Record<string, ServerRow[]>,
  tombstones: Tombstone[],
): number {
  let changed = 0;
  db.withTransactionSync(() => {
    for (const [table, rows] of Object.entries(data)) {
      const t = table as TableName;
      for (const row of rows) {
        const local = db.getFirstSync<AnyRow>(`SELECT * FROM ${t} WHERE id = ?`, row.id);
        // Journal identity is per-date; logs identity is (habitId|taskId, date).
        let localByAlt: AnyRow | undefined;
        if (t === "journal" && !local) {
          localByAlt = db.getFirstSync<AnyRow>(
            `SELECT * FROM journal WHERE date = ? AND id != ?`,
            row.date as string,
            row.id,
          ) as AnyRow | undefined;
        }
        if (t === "habitLogs" && !local) {
          localByAlt = db.getFirstSync<AnyRow>(
            `SELECT * FROM habitLogs WHERE habitId = ? AND date = ? AND id != ?`,
            row.habitId as string,
            row.date as string,
            row.id,
          ) as AnyRow | undefined;
        }
        if (t === "routineLogs" && !local) {
          localByAlt = db.getFirstSync<AnyRow>(
            `SELECT * FROM routineLogs WHERE taskId = ? AND date = ? AND id != ?`,
            row.taskId as string,
            row.date as string,
            row.id,
          ) as AnyRow | undefined;
        }
        const target = (local ?? localByAlt) as AnyRow | undefined;
        if (localByAlt && !local) {
          // Same logical row under a different id — adopt the server id and
          // drop the local one entirely (no tombstone: it IS the same row).
          hardDelete(t, localByAlt.id as string);
        }
        if (!target) {
          insertServerRow(t, row);
          changed += 1;
          continue;
        }
        if (new Date(row.updatedAt) > new Date(target.updatedAt as string)) {
          insertServerRow(t, row, target.id as string);
          changed += 1;
        }
      }
    }
    for (const ts of tombstones) {
      const local = db.getFirstSync<AnyRow>(
        `SELECT * FROM ${ts.table} WHERE id = ?`,
        ts.id,
      );
      if (!local) continue;
      const deletedAt = local.deletedAt as string | null;
      if (
        !deletedAt &&
        new Date(ts.deletedAt) >= new Date(local.updatedAt as string)
      ) {
        softDelete(ts.table, ts.id);
        changed += 1;
        // Cascades.
        if (ts.table === "todos") {
          db.runSync(
            "DELETE FROM subtasks WHERE todoId = ? AND deletedAt IS NULL",
            ts.id,
          );
        }
        if (ts.table === "habits") {
          db.runSync(
            "DELETE FROM habitLogs WHERE habitId = ? AND deletedAt IS NULL",
            ts.id,
          );
        }
        if (ts.table === "routineTasks") {
          db.runSync(
            "DELETE FROM routineLogs WHERE taskId = ? AND deletedAt IS NULL",
            ts.id,
          );
        }
      }
    }
  });
  return changed;
}

const COLUMNS: Record<TableName, string[]> = {
  todos: [
    "id", "title", "notes", "priority", "category", "dueDate", "reminderAt",
    "repeat", "completed", "completedAt", "createdAt", "updatedAt", "deletedAt",
  ],
  subtasks: ["id", "todoId", "title", "completed", "sortOrder", "createdAt", "updatedAt", "deletedAt"],
  habits: [
    "id", "name", "emoji", "color", "timeOfDay", "reminderTime", "targetPerDay",
    "archived", "sortOrder", "createdAt", "updatedAt", "deletedAt",
  ],
  habitLogs: ["id", "habitId", "date", "createdAt", "updatedAt", "deletedAt"],
  routineTasks: ["id", "name", "emoji", "section", "time", "days", "archived", "sortOrder", "createdAt", "updatedAt", "deletedAt"],
  routineLogs: ["id", "taskId", "date", "createdAt", "updatedAt", "deletedAt"],
  notes: ["id", "title", "content", "tag", "color", "pinned", "createdAt", "updatedAt", "deletedAt"],
  journal: ["id", "date", "title", "content", "mood", "energy", "gratitude", "createdAt", "updatedAt", "deletedAt"],
  goals: [
    "id", "title", "description", "category", "period", "target", "progress",
    "unit", "status", "startDate", "endDate", "createdAt", "updatedAt", "deletedAt",
  ],
  focusSessions: ["id", "taskId", "label", "minutes", "startedAt", "endedAt", "createdAt", "updatedAt", "deletedAt"],
};

function insertServerRow(table: TableName, row: ServerRow, updateId?: string): void {
  const cols = COLUMNS[table];
  const values = cols.map((c) => {
    const v = row[c];
    if (c === "completed" || c === "archived" || c === "pinned") {
      return v ? 1 : 0;
    }
    if (v === undefined) return null;
    if (v === null) return null;
    return v as string | number | null;
  });
  const idVal = updateId ?? row.id;
  const placeholders = cols.map(() => "?").join(",");
  const colList = cols.join(",");
  db.runSync(
    `INSERT OR REPLACE INTO ${table} (${colList}) VALUES (${placeholders})`,
    ...(cols.map((c, i) => (c === "id" ? idVal : values[i])) as (string | number | null)[]),
  );
}

// ─────────────────────────────────────────────────────────────
// Export / import (JSON backup)
// ─────────────────────────────────────────────────────────────

export function exportJSON(): string {
  return JSON.stringify(
    {
      app: "momentum",
      version: 1,
      exportedAt: nowISO(),
      data: collectAll(),
    },
    null,
    2,
  );
}

export function importJSON(raw: string): { ok: boolean; message: string } {
  try {
    const parsed = JSON.parse(raw) as { app?: string; data?: Record<string, ServerRow[]> };
    if (!parsed.data) return { ok: false, message: "Not a Momentum backup file" };
    const tombstones: Tombstone[] = [];
    for (const [table, rows] of Object.entries(parsed.data)) {
      if (!(table in COLUMNS)) continue;
      for (const row of rows) {
        if (row.deletedAt) {
          tombstones.push({ table: table as TableName, id: row.id, deletedAt: row.deletedAt });
        }
      }
    }
    db.withTransactionSync(() => {
      for (const [table, rows] of Object.entries(parsed.data!)) {
        if (!(table in COLUMNS)) continue;
        for (const row of rows) {
          insertServerRow(table as TableName, row);
        }
      }
      // Re-apply tombstones from the backup last.
      for (const ts of tombstones) {
        const local = db.getFirstSync<AnyRow>(`SELECT * FROM ${ts.table} WHERE id = ?`, ts.id);
        if (local && !local.deletedAt) softDelete(ts.table, ts.id);
      }
    });
    return { ok: true, message: "Backup restored" };
  } catch {
    return { ok: false, message: "Could not read that file" };
  }
}
