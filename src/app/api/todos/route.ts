// GET /api/todos?status=active|completed|all&category=… → Todo[]
// POST /api/todos { title, notes?, priority?, category?, dueDate?, reminderAt? } → Todo

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/server/auth";
import type { Prisma, Todo as TodoRow } from "@prisma/client";
import { handleApiError, json, parseOrThrow, readJsonBody } from "@/lib/server/http";
import { toNullableDate, todoCreateSchema } from "@/lib/server/schemas";
import { serializeTodo, type TodoWithSubtasks } from "@/lib/server/service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

const listQuerySchema = z.object({
  status: z.enum(["active", "completed", "all"]).optional(),
  category: z.string().trim().min(1).max(40).optional(),
});

function completedTime(t: TodoRow): number {
  return t.completedAt?.getTime() ?? 0;
}

/**
 * Ordering per contract: active first by dueDate ASC (nulls last), then
 * priority weight (urgent > high > medium > low), then createdAt DESC.
 * For status=completed order by completedAt DESC. "all" appends completed
 * after actives.
 */
function sortTodosForList(
  todos: TodoWithSubtasks[],
  status: "active" | "completed" | "all",
): TodoWithSubtasks[] {
  if (status === "completed") {
    return todos.slice().sort((a, b) => completedTime(b) - completedTime(a));
  }
  const active = todos
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const dueA = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
      const dueB = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
      if (dueA !== dueB) return dueA - dueB;
      const prA = PRIORITY_WEIGHT[a.priority] ?? 1;
      const prB = PRIORITY_WEIGHT[b.priority] ?? 1;
      if (prA !== prB) return prB - prA;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  if (status === "active") return active;
  const completed = todos
    .filter((t) => t.completed)
    .sort((a, b) => completedTime(b) - completedTime(a));
  return [...active, ...completed];
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const category = url.searchParams.get("category")?.trim() ?? "";
    const query = parseOrThrow(listQuerySchema, {
      status: url.searchParams.get("status") ?? undefined,
      category: category === "" ? undefined : category,
    });

    const status = query.status ?? "active";
    const where: Prisma.TodoWhereInput = { userId };
    if (status === "active") where.completed = false;
    else if (status === "completed") where.completed = true;
    if (query.category) where.category = query.category;

    const todos = await db.todo.findMany({
      where,
      include: { subtasks: { orderBy: { sortOrder: "asc" } } },
    });
    return json(sortTodosForList(todos, status).map(serializeTodo));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const input = parseOrThrow(todoCreateSchema, await readJsonBody(req));
    const todo = await db.todo.create({
      data: {
        userId,
        title: input.title,
        notes: input.notes ?? null,
        priority: input.priority ?? "medium",
        category: input.category ?? "personal",
        dueDate: toNullableDate(input.dueDate) ?? null,
        reminderAt: toNullableDate(input.reminderAt) ?? null,
        repeat: input.repeat ?? "none",
      },
    });
    return json(serializeTodo(todo), 201);
  } catch (err) {
    return handleApiError(err);
  }
}
