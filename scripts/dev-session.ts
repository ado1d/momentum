// Dev-only utility: craft a valid NextAuth v4 session cookie WITHOUT going
// through the real Google OAuth flow. Lets QA scripts (agent-browser) hit the
// authenticated API surface as an arbitrary fake user.
//
// Usage:
//   bun run scripts/dev-session.ts <email> [name]
//   → prints `document.cookie = "..."` ready for agent-browser eval
//
// Requires .env (NEXTAUTH_SECRET) — never used in production code paths.

import { encode } from "next-auth/jwt";

const email = process.argv[2] ?? "qa-user@example.com";
const name = process.argv[3] ?? "QA User";
const uid = "qa_" + Buffer.from(email).toString("hex").slice(0, 24);

const COOKIE_NAME = "next-auth.session-token"; // dev (non-HTTPS) name

async function main() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NEXTAUTH_SECRET missing from env");
    process.exit(1);
  }

  const token = {
    name,
    email,
    picture: null,
    sub: "google-oauth2|qa|" + uid,
    uid, // custom claim read by the session callback
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
    jti: crypto.randomUUID(),
  };

  // NOTE: no `salt` param — this next-auth@4.24.x build decodes the session
  // cookie WITHOUT a salt (verified by round-trip probe against the live
  // /api/auth/session endpoint). Adding salt would break server-side decode.
  const value = await encode({
    token: token as never,
    secret,
    maxAge: 30 * 24 * 3600,
  });

  // Crafted sessions reference a User row that must actually exist (the real
  // sign-in flow upserts it in the jwt callback; requireUserId verifies it).
  // Upsert it here so QA cookies work against the live API.
  const { db } = await import("../src/lib/db");
  await db.user.upsert({
    where: { email },
    update: { name },
    create: { id: uid, email, name },
  });

  console.log(`# user: ${name} <${email}>  uid: ${uid}`);
  console.log(`document.cookie = "${COOKIE_NAME}=${value}; path=/; max-age=${30 * 24 * 3600}"`);
  console.log(`# or curl: -H "Cookie: ${COOKIE_NAME}=${value}"`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
