#!/usr/bin/env node
// Derives a local SQLite prisma schema from prisma/schema.prisma (Postgres —
// the committed source of truth) and syncs the local dev database.
//
// Production NEVER uses this file: on Vercel the Postgres schema is pushed
// by scripts/postinstall.mjs using the project's env vars.
//
// Usage: node scripts/dev-db.mjs   (or: bun run db:local)

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const PRISMA = join(root, "node_modules", ".bin", "prisma");

const source = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");

if (!/provider\s*=\s*"postgresql"/.test(source)) {
  console.error("✗ prisma/schema.prisma is not postgresql — refusing to derive local schema.");
  process.exit(1);
}

// postgres → sqlite, drop the directUrl line (SQLite has no pooled/direct split).
const local = source
  .replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"')
  .replace(/^\s*directUrl\s*=.*$\n?/m, "");

writeFileSync(join(root, "prisma", "schema.local.prisma"), local);
mkdirSync(join(root, "db"), { recursive: true });

execSync(
  `"${PRISMA}" db push --skip-generate --accept-data-loss --schema prisma/schema.local.prisma`,
  { stdio: "inherit", cwd: root },
);
execSync(`"${PRISMA}" generate --schema prisma/schema.local.prisma`, {
  stdio: "inherit",
  cwd: root,
});

console.log("✓ Local dev database synced (SQLite, prisma/schema.local.prisma → db/custom.db)");
