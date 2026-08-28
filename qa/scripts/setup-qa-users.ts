// QA helper (AUTH-A): upsert the two fake User rows so the dev-session JWT
// uids (qa_ + hex(email)) satisfy the FK on every data table — mirroring
// what the real NextAuth Google sign-in does in the jwt callback.
// Run: env -u DATABASE_URL -u DIRECT_URL bun run qa/scripts/setup-qa-users.ts

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function uidOf(email: string): string {
  return "qa_" + Buffer.from(email).toString("hex").slice(0, 24);
}

async function main() {
  for (const [email, name] of [
    ["qa-a@example.com", "QA A"],
    ["qa-b@example.com", "QA B"],
  ] as const) {
    const user = await db.user.upsert({
      where: { email },
      update: { name },
      create: { id: uidOf(email), email, name, emailVerified: new Date() },
    });
    console.log(`upserted user ${user.email} (id=${user.id})`);
  }
  console.log("total users:", await db.user.count());
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
