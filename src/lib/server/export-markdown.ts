// Markdown export builder — renders a well-structured document with one
// section per entity type. Used by GET /api/export?format=markdown.

import type {
  Goal as GoalRow,
  JournalEntry as JournalEntryRow,
  Note as NoteRow,
  Subtask as SubtaskRow,
  Todo as TodoRow,
} from "@prisma/client";
import { computeStreak, dayKeyOfDate } from "./daykeys";
import type { HabitWithLogs, RoutineTaskWithLogs } from "./service";

export type ExportScope = "all" | "tasks" | "routine" | "notes" | "journal" | "goals";

export interface ExportData {
  todos: (TodoRow & { subtasks?: SubtaskRow[] })[];
  habits: HabitWithLogs[];
  routineTasks: RoutineTaskWithLogs[];
  notes: NoteRow[];
  journal: JournalEntryRow[];
  goals: GoalRow[];
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // index = ISO weekday - 1

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

function daysLabel(days: string): string {
  const parts = days
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
  if (parts.length === 7) return "every day";
  return parts.map((p) => WEEKDAY_NAMES[Number(p) - 1] ?? p).join(", ");
}

function nowStamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dayKeyOfDate(d)} ${hh}:${mm}`;
}

function indentBlockquote(text: string): string {
  return `> ${text.replace(/\n/g, "\n> ")}`;
}

function sortActiveTodos(a: TodoRow, b: TodoRow): number {
  const dueA = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  const dueB = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  const prA = PRIORITY_WEIGHT[a.priority] ?? 1;
  const prB = PRIORITY_WEIGHT[b.priority] ?? 1;
  if (prA !== prB) return prB - prA;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function tasksSection(data: ExportData, out: string[]): void {
  const active = data.todos.filter((t) => !t.completed).sort(sortActiveTodos);
  const completed = data.todos
    .filter((t) => t.completed)
    .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

  out.push("## ✅ Tasks", "");
  out.push(`### To do (${active.length})`, "");
  if (active.length === 0) {
    out.push("_No active tasks._", "");
  } else {
    for (const t of active) {
      const bits = [`**${t.title}**`, t.priority, t.category];
      if (t.dueDate) bits.push(`due ${dayKeyOfDate(t.dueDate)}`);
      if (t.repeat && t.repeat !== "none") bits.push(`repeats ${t.repeat}`);
      if (t.reminderAt) bits.push(`reminder ${dayKeyOfDate(t.reminderAt)}`);
      const subs = (t.subtasks ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      if (subs.length > 0) {
        const done = subs.filter((s) => s.completed).length;
        bits.push(`checklist ${done}/${subs.length}`);
      }
      out.push(`- ${bits.join(" · ")}`);
      for (const s of subs) {
        out.push(`  - [${s.completed ? "x" : " "}] ${s.title}`);
      }
      if (t.notes) out.push(`  ${indentBlockquote(t.notes)}`);
    }
    out.push("");
  }
  out.push(`### Completed (${completed.length})`, "");
  if (completed.length === 0) {
    out.push("_No completed tasks._", "");
  } else {
    for (const t of completed) {
      const when = t.completedAt ? dayKeyOfDate(t.completedAt) : "unknown date";
      out.push(`- ~~${t.title}~~ · completed ${when} · ${t.priority}`);
    }
    out.push("");
  }
}

function routineSection(
  data: ExportData,
  ctx: { today: string; weekStart: string },
  out: string[],
): void {
  const sectionOrder: { key: string; label: string }[] = [
    { key: "morning", label: "Morning" },
    { key: "afternoon", label: "Afternoon" },
    { key: "evening", label: "Evening" },
    { key: "anytime", label: "Anytime" },
  ];

  out.push("## 🌅 Routine", "");

  // Habits are part of routine tracking, so they are exported here too.
  out.push(`### Habits (${data.habits.length})`, "");
  if (data.habits.length === 0) {
    out.push("_No habits tracked._", "");
  } else {
    for (const h of data.habits) {
      const logDates = new Set(h.logs.map((l) => l.date));
      const streak = computeStreak(logDates, ctx.today);
      const thisWeek = h.logs.filter(
        (l) => l.date >= ctx.weekStart && l.date <= ctx.today,
      ).length;
      const bits = [
        `${h.emoji} **${h.name}**`,
        h.timeOfDay,
        `streak ${streak} day${streak === 1 ? "" : "s"}`,
        logDates.has(ctx.today) ? "done today ✅" : "not done today",
        `${thisWeek}× this week`,
      ];
      out.push(`- ${bits.join(" · ")}`);
      if (h.reminderTime) out.push(`  - reminder at ${h.reminderTime}`);
      if (h.logs.length > 0) {
        out.push(`  - logged: ${h.logs.map((l) => l.date).join(", ")}`);
      }
    }
    out.push("");
  }

  for (const section of sectionOrder) {
    const tasks = data.routineTasks
      .filter((t) => t.section === section.key)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (tasks.length === 0) continue;
    out.push(`### ${section.label} (${tasks.length})`, "");
    for (const t of tasks) {
      const logDates = new Set(t.logs.map((l) => l.date));
      const streak = computeStreak(logDates, ctx.today);
      const bits = [`${t.emoji} **${t.name}**`];
      if (t.time) bits.push(t.time);
      bits.push(daysLabel(t.days));
      bits.push(`streak ${streak} day${streak === 1 ? "" : "s"}`);
      if (logDates.has(ctx.today)) bits.push("done today ✅");
      out.push(`- ${bits.join(" · ")}`);
      if (t.logs.length > 0) {
        out.push(`  - logged: ${t.logs.map((l) => l.date).join(", ")}`);
      }
    }
    out.push("");
  }
  if (data.routineTasks.length === 0) {
    out.push("_No routine tasks._", "");
  }
}

function notesSection(data: ExportData, out: string[]): void {
  const sorted = data.notes
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.getTime() - a.updatedAt.getTime());
  const pinned = sorted.filter((n) => n.pinned);
  const rest = sorted.filter((n) => !n.pinned);

  out.push("## 📝 Notes", "");
  const render = (notes: typeof sorted, heading: string) => {
    if (notes.length === 0) return;
    out.push(`### ${heading} (${notes.length})`, "");
    for (const n of notes) {
      const meta: string[] = [];
      if (n.tag) meta.push(`tag: ${n.tag}`);
      meta.push(`color: ${n.color}`);
      meta.push(`updated ${dayKeyOfDate(n.updatedAt)}`);
      out.push(`#### ${n.title || "Untitled note"}`, "");
      out.push(`_${meta.join(" · ")}_`, "");
      if (n.content.trim()) {
        out.push(n.content, "");
      }
      out.push("---", "");
    }
  };
  render(pinned, "📌 Pinned");
  render(rest, "Notes");
  if (sorted.length === 0) out.push("_No notes._", "");
}

function journalSection(data: ExportData, out: string[]): void {
  const sorted = data.journal.slice().sort((a, b) => b.date.localeCompare(a.date));
  out.push("## 📖 Journal", "");
  if (sorted.length === 0) {
    out.push("_No journal entries._", "");
    return;
  }
  for (const e of sorted) {
    const title = e.title ? ` — ${e.title}` : "";
    out.push(`### ${e.date}${title}`, "");
    const meta: string[] = [];
    if (e.mood) meta.push(`mood: ${e.mood}`);
    if (e.energy !== null) meta.push(`energy: ${e.energy}/5`);
    if (meta.length > 0) out.push(`_${meta.join(" · ")}_`, "");
    if (e.gratitude) out.push(`**Grateful for:** ${e.gratitude}`, "");
    if (e.content.trim()) {
      out.push(e.content, "");
    }
    out.push("---", "");
  }
}

function goalsSection(data: ExportData, out: string[]): void {
  const statusOrder: Record<string, number> = { active: 0, completed: 1, archived: 2 };
  const sorted = data.goals.slice().sort((a, b) => {
    const sw = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (sw !== 0) return sw;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  out.push("## 🎯 Goals", "");
  if (sorted.length === 0) {
    out.push("_No goals set._", "");
    return;
  }
  for (const g of sorted) {
    const progressLabel = g.unit
      ? `${g.progress}/${g.target} ${g.unit}`
      : `${g.progress}/${g.target}`;
    const bits = [`**${g.title}**`, g.period, g.category, progressLabel, g.status];
    if (g.startDate) bits.push(`started ${g.startDate}`);
    if (g.endDate) bits.push(`ends ${g.endDate}`);
    out.push(`- ${bits.join(" · ")}`);
    if (g.description) out.push(`  ${indentBlockquote(g.description)}`);
  }
  out.push("");
}

/** Builds the full markdown document for the requested scope. */
export function buildMarkdownExport(
  data: ExportData,
  ctx: { scope: ExportScope; today: string; weekStart: string },
): string {
  const out: string[] = [];
  out.push("# Momentum Export", "");
  out.push(`_Generated ${nowStamp()} · scope: ${ctx.scope}_`, "");
  out.push("---", "");

  if (ctx.scope === "all" || ctx.scope === "tasks") tasksSection(data, out);
  if (ctx.scope === "all" || ctx.scope === "routine") routineSection(data, ctx, out);
  if (ctx.scope === "all" || ctx.scope === "notes") notesSection(data, out);
  if (ctx.scope === "all" || ctx.scope === "journal") journalSection(data, out);
  if (ctx.scope === "all" || ctx.scope === "goals") goalsSection(data, out);

  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
