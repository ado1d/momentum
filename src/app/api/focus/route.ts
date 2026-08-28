// Focus sessions API.
//
// GET  /api/focus → FocusStats (today/week/last-week minutes + session counts,
//                    plus `recent` — the last 10 sessions by endedAt desc,
//                    each with the linked todo's title resolved)
// POST /api/focus { taskId?, label?, minutes, startedAt?, endedAt? } → FocusSession
//
// minutes is capped at a sane maximum (240) to keep the data honest;
// startedAt/endedAt default to "now - minutes" / "now" when omitted.

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import type { FocusSession, FocusStats, FocusSessionWithTask } from "@/lib/types";
import {
  addDaysToKey,
  dayKeyOfDate,
  todayKey,
  weekStartKeyOf,
} from "@/lib/server/daykeys";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { getSettings } from "@/lib/server/service";
import { isoDateTimeField } from "@/lib/server/schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";

const focusCreateSchema = z.object({
  taskId: z.string().trim().min(1).max(64).nullish(),
  label: z.string().trim().max(200).nullish(),
  minutes: z.number().int().min(1).max(240),
  startedAt: isoDateTimeField,
  endedAt: isoDateTimeField,
});

function serializeSession(s: {
  id: string;
  taskId: string | null;
  label: string | null;
  minutes: number;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
}): FocusSession {
  return {
    id: s.id,
    taskId: s.taskId,
    label: s.label,
    minutes: s.minutes,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  };
}

export async function GET() {
  try {
    const userId = await requireUserId();
    const today = todayKey();
    const settings = await getSettings(userId);
    const weekStart = weekStartKeyOf(today, settings.weekStartsOn);
    const lastWeekStart = addDaysToKey(weekStart, -7);

    const sessions = await db.focusSession.findMany({ where: { userId } });

    const minutesOn = (key: string) =>
      sessions
        .filter((s) => dayKeyOfDate(s.endedAt) === key)
        .reduce((sum, s) => sum + s.minutes, 0);

    // Recent sessions (last 10 by endedAt desc) with task titles resolved in
    // a single pass — no N+1 queries.
    const recentRows = [...sessions]
      .sort((a, b) => b.endedAt.getTime() - a.endedAt.getTime())
      .slice(0, 10);
    const taskIds = [
      ...new Set(
        recentRows.map((s) => s.taskId).filter((id): id is string => id !== null),
      ),
    ];
    const tasks =
      taskIds.length > 0
        ? await db.todo.findMany({
            where: { id: { in: taskIds }, userId },
            select: { id: true, title: true },
          })
        : [];
    const titleById = new Map(tasks.map((t) => [t.id, t.title]));

    const recent: FocusSessionWithTask[] = recentRows.map((s) => ({
      id: s.id,
      minutes: s.minutes,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt.toISOString(),
      label: s.label,
      taskId: s.taskId,
      taskTitle: s.taskId !== null ? titleById.get(s.taskId) ?? null : null,
    }));

    const stats: FocusStats = {
      todayMinutes: minutesOn(today),
      weekMinutes: Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)).reduce(
        (sum, k) => sum + minutesOn(k),
        0,
      ),
      lastWeekMinutes: sessions
        .filter((s) => {
          const key = dayKeyOfDate(s.endedAt);
          return key >= lastWeekStart && key < weekStart;
        })
        .reduce((sum, s) => sum + s.minutes, 0),
      totalSessions: sessions.length,
      todaySessions: sessions.filter((s) => dayKeyOfDate(s.endedAt) === today).length,
      recent,
    };
    return json(stats);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(focusCreateSchema, await readJsonBody(req));
    const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
    const startedAt = input.startedAt
      ? new Date(input.startedAt)
      : new Date(endedAt.getTime() - input.minutes * 60_000);

    if (Number.isNaN(endedAt.getTime()) || Number.isNaN(startedAt.getTime())) {
      return json({ error: "startedAt/endedAt must be valid datetimes" }, 400);
    }

    // taskId, when present, must reference one of the user's own todos
    if (input.taskId) {
      const todo = await db.todo.findFirst({ where: { id: input.taskId, userId } });
      if (!todo) return json({ error: "Task not found" }, 404);
    }

    const session = await db.focusSession.create({
      data: {
        userId,
        taskId: input.taskId ?? null,
        label: input.label ?? null,
        minutes: input.minutes,
        startedAt,
        endedAt,
      },
    });
    return json(serializeSession(session), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
