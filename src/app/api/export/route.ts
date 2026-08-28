// GET /api/export?format=markdown|json&scope=all|tasks|routine|notes|journal|goals
//   - markdown → text/markdown document with a section per entity type
//     (scope "routine" includes habits + routine tasks)
//   - json → full backup of every table (incl. settings + subtasks)

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import { todayKey, weekStartKeyOf } from "@/lib/server/daykeys";
import { buildMarkdownExport, type ExportScope } from "@/lib/server/export-markdown";
import { handleApiError, json, parseOrThrow } from "@/lib/server/http";
import { getSettings } from "@/lib/server/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const exportQuerySchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
  scope: z
    .enum(["all", "tasks", "routine", "notes", "journal", "goals"])
    .default("all"),
});

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const query = parseOrThrow(exportQuerySchema, {
      format: url.searchParams.get("format") ?? undefined,
      scope: url.searchParams.get("scope") ?? undefined,
    });

    const [todos, subtasks, habits, routineTasks, notes, journal, goals, settings] =
      await Promise.all([
        db.todo.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          include: { subtasks: { orderBy: { sortOrder: "asc" } } },
        }),
        db.subtask.findMany({
          where: { todo: { userId } },
          orderBy: [{ todoId: "asc" }, { sortOrder: "asc" }],
        }),
        db.habit.findMany({
          where: { userId },
          orderBy: { sortOrder: "asc" },
          include: { logs: { orderBy: { date: "asc" } } },
        }),
        db.routineTask.findMany({
          where: { userId },
          orderBy: { sortOrder: "asc" },
          include: { logs: { orderBy: { date: "asc" } } },
        }),
        db.note.findMany({
          where: { userId },
          orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
        }),
        db.journalEntry.findMany({ where: { userId }, orderBy: { date: "desc" } }),
        db.goal.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
        getSettings(userId),
      ]);

    if (query.format === "json") {
      return json({
        app: "momentum",
        version: 2,
        exportedAt: new Date().toISOString(),
        todos,
        subtasks,
        habits,
        routineTasks,
        notes,
        journal,
        goals,
        settings,
      });
    }

    const today = todayKey();
    const markdown = buildMarkdownExport(
      { todos, habits, routineTasks, notes, journal, goals },
      {
        scope: query.scope as ExportScope,
        today,
        weekStart: weekStartKeyOf(today, settings.weekStartsOn),
      },
    );
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
