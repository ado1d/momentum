// GET /api/search?q=… → SearchResults
// Case-insensitive substring search across todos, notes, goals, journal and
// habits. The dataset is single-user and small, so matching happens in memory
// (unicode-safe, unlike SQLite LIKE).

import { db } from "@/lib/db";
import { handleApiError, json } from "@/lib/server/http";
import {
  habitContext,
  serializeGoal,
  serializeHabit,
  serializeJournalEntry,
  serializeNote,
  serializeTodo,
} from "@/lib/server/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(200),
});

function matches(haystacks: (string | null | undefined)[], needle: string): boolean {
  return haystacks.some((h) => (h ?? "").toLowerCase().includes(needle));
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const { q } = querySchema.parse({ q: url.searchParams.get("q") ?? "" });
    const needle = q.toLowerCase();

    const [todoRows, noteRows, goalRows, journalRows, habitCtx] = await Promise.all([
      db.todo.findMany({
        orderBy: { createdAt: "desc" },
        include: { subtasks: { orderBy: { sortOrder: "asc" } } },
      }),
      db.note.findMany({ orderBy: { updatedAt: "desc" } }),
      db.goal.findMany({ orderBy: { updatedAt: "desc" } }),
      db.journalEntry.findMany({ orderBy: { date: "desc" } }),
      habitContext(),
    ]);
    const habitRows = await db.habit.findMany({
      where: { archived: false },
      orderBy: { sortOrder: "asc" },
      include: { logs: { orderBy: { date: "asc" } } },
    });

    // Todos: active matches first, then completed; newest first within each.
    const todoMatches = todoRows
      .filter((t) => matches([t.title, t.notes], needle))
      .sort((a, b) => Number(a.completed) - Number(b.completed))
      .slice(0, 6)
      .map(serializeTodo);

    const noteMatches = noteRows
      .filter((n) => matches([n.title, n.content, n.tag], needle))
      .slice(0, 5)
      .map(serializeNote);

    const goalMatches = goalRows
      .filter((g) => matches([g.title, g.description], needle))
      .slice(0, 5)
      .map(serializeGoal);

    const journalMatches = journalRows
      .filter((e) => matches([e.title, e.content, e.gratitude], needle))
      .slice(0, 5)
      .map(serializeJournalEntry);

    const habitMatches = habitRows
      .filter((h) => matches([h.name], needle))
      .slice(0, 5)
      .map((h) => serializeHabit(h, habitCtx));

    return json({
      todos: todoMatches,
      notes: noteMatches,
      goals: goalMatches,
      journal: journalMatches,
      habits: habitMatches,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
