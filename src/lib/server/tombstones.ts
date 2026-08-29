// Deletion tombstones for mobile sync. When a record is deleted (from the web
// app OR the mobile app), a tombstone row records the deletion so other
// devices learn about it on their next sync instead of resurrecting the row.

import { db } from "@/lib/db";

export type SyncTable =
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

export async function recordTombstone(
  userId: string,
  table: SyncTable,
  recordId: string,
): Promise<void> {
  try {
    await db.syncTombstone.upsert({
      where: {
        userId_table_recordId: { userId, table, recordId },
      },
      update: { deletedAt: new Date() },
      create: { userId, table, recordId },
    });
  } catch {
    // Tombstones are best-effort — a failed write must never fail the
    // user-facing delete that triggered it.
  }
}

/**
 * Records tombstones for a record AND its cascading children before the row
 * is hard-deleted from Postgres.
 */
export async function recordCascadeTombstones(
  userId: string,
  table: SyncTable,
  recordId: string,
): Promise<void> {
  try {
    if (table === "todos") {
      const children = await db.subtask.findMany({
        where: { todoId: recordId },
        select: { id: true },
      });
      for (const c of children) await recordTombstone(userId, "subtasks", c.id);
    }
    if (table === "habits") {
      const children = await db.habitLog.findMany({
        where: { habitId: recordId },
        select: { id: true },
      });
      for (const c of children) await recordTombstone(userId, "habitLogs", c.id);
    }
    if (table === "routineTasks") {
      const children = await db.routineLog.findMany({
        where: { taskId: recordId },
        select: { id: true },
      });
      for (const c of children) await recordTombstone(userId, "routineLogs", c.id);
    }
    await recordTombstone(userId, table, recordId);
  } catch {
    // best-effort
  }
}

/** Tombstones older than this are pruned during sync. */
export const TOMBSTONE_TTL_DAYS = 90;
