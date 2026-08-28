// Public health probe + deployment marker.
// VERCEL_GIT_COMMIT_SHA is injected by Vercel for git-connected deployments
// ("dev" when running locally). Deliberately unauthenticated: it exposes only
// the already-public commit sha and exists for uptime checks and deploy
// verification.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "momentum",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    time: new Date().toISOString(),
  });
}
