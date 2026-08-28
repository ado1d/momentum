// QA cleanup (AUTH-A): delete the two fake QA users — cascades wipe every
// row they own (todos, habits, routines, notes, journal, goals, focus,
// settings). Verifies the production DB ships EMPTY.
// Run: env -u DATABASE_URL -u DIRECT_URL bun run qa/scripts/cleanup-qa-users.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  for (const email of ["qa-a@example.com", "qa-b@example.com"]) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`user ${email}: already gone`);
      continue;
    }
    await db.user.delete({ where: { email } });
    console.log(`deleted user ${email} (cascades wiped their rows)`);
  }

  const counts = {
    users: await db.user.count(),
    todos: await db.todo.count(),
    subtasks: await db.subtask.count(),
    habits: await db.habit.count(),
    habitLogs: await db.habitLog.count(),
    routineTasks: await db.routineTask.count(),
    routineLogs: await db.routineLog.count(),
    notes: await db.note.count(),
    journal: await db.journalEntry.count(),
    goals: await db.goal.count(),
    focusSessions: await db.focusSession.count(),
    settings: await db.settings.count(),
  };
  console.log("row counts:", counts);
  const nonEmpty = Object.entries(counts).filter(([, n]) => n !== 0);
  console.log(nonEmpty.length === 0 ? "DB IS EMPTY ✓" : `DB NOT EMPTY: ${nonEmpty}`);
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
