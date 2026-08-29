#!/usr/bin/env node
// Smart postinstall — picks the right Prisma workflow for the environment:
//
//   1. On Vercel (production/preview) with a Postgres URL:
//        • generate the client from the committed Postgres schema
//        • `prisma db push` (additive-only) so new models/columns reach the
//          database automatically at deploy time — no manual Neon access
//          needed. Prisma refuses destructive changes here (no
//          --accept-data-loss), which is exactly the safety we want.
//
//   2. Locally with a file: DATABASE_URL:
//        • derive + sync the local SQLite dev database (scripts/dev-db.mjs)
//
//   3. Otherwise: plain `prisma generate`.
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const PRISMA = join(root, "node_modules", ".bin", "prisma");
const dbUrl = process.env.DATABASE_URL ?? "";

function run(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root });
}

const isPostgres = dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");

if (process.env.VERCEL && isPostgres) {
  run(`"${PRISMA}" generate`);
  try {
    run(`"${PRISMA}" db push --skip-generate`);
    console.log("✓ Deploy-time schema sync complete");
  } catch (error) {
    // Never break the whole build on a schema-sync hiccup — the push
    // API routes degrade gracefully when tables are missing.
    console.error("⚠ prisma db push failed — continuing build:", error.message);
  }
} else if (dbUrl.startsWith("file:")) {
  run("node scripts/dev-db.mjs");
} else {
  run(`"${PRISMA}" generate`);
}
