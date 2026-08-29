// GET /api/mobile/auth/google — Google sign-in for the Android/iOS app.
//
// Two phases in one URL:
//   1. App opens  /api/mobile/auth/google?state=…&redirect=momentum://auth
//      → 302 to Google's consent screen (client id/secret live server-side).
//   2. Google returns ?code=…&state=…
//      → server exchanges the code, upserts the User row, mints a signed
//        mobile-JWT and 302s back to the app: momentum://auth?token=…
//
// The app only ever needs its own custom scheme — no client secret, no SHA-1
// fingerprint juggling. Requires GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env
// vars (already set for NextAuth on production) and this exact URL added as
// an Authorized redirect URI on that same Google Web client.

import { db } from "@/lib/db";
import { signMobileJwt } from "@/lib/server/mobile-jwt";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_REDIRECT_PREFIXES = ["momentum://", "exp://"];

function redirectToApp(base: string, params: Record<string, string>): Response {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  // Plain 302 with a custom-scheme Location — NextResponse.redirect only
  // accepts http(s) URLs, but Android/Chrome happily follows scheme links.
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), "Cache-Control": "no-store" },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const state = url.searchParams.get("state") ?? "";
  const redirectParam = url.searchParams.get("redirect") ?? "momentum://auth";
  const redirect = ALLOWED_REDIRECT_PREFIXES.some((p) => redirectParam.startsWith(p))
    ? redirectParam
    : "momentum://auth";

  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri = `${url.origin}/api/mobile/auth/google`;

  if (error) {
    return redirectToApp(redirect, { error: "auth_failed", state });
  }

  if (!clientId || !clientSecret || clientId.includes("placeholder")) {
    return redirectToApp(redirect, { error: "config", state });
  }

  // Phase 1 — bounce to Google's consent screen.
  if (!code) {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("prompt", "select_account");
    if (state) authUrl.searchParams.set("state", state);
    return new Response(null, {
      status: 302,
      headers: { Location: authUrl.toString(), "Cache-Control": "no-store" },
    });
  }

  // Phase 2 — exchange the code and mint the app token.
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return redirectToApp(redirect, { error: "auth_failed", state });
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return redirectToApp(redirect, { error: "auth_failed", state });
    }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      return redirectToApp(redirect, { error: "auth_failed", state });
    }
    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!profile.email) {
      return redirectToApp(redirect, { error: "auth_failed", state });
    }

    // Same upsert semantics as the NextAuth jwt callback (P2002-safe).
    let user;
    try {
      user = await db.user.upsert({
        where: { email: profile.email },
        update: { name: profile.name ?? undefined, image: profile.picture ?? undefined },
        create: {
          email: profile.email,
          name: profile.name ?? null,
          image: profile.picture ?? null,
          emailVerified: new Date(),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        user = await db.user.findUniqueOrThrow({ where: { email: profile.email } });
      } else {
        throw err;
      }
    }

    const token = signMobileJwt(user.id, user.email);
    return redirectToApp(redirect, {
      token,
      state,
      email: user.email,
      name: user.name ?? "",
      image: user.image ?? "",
    });
  } catch {
    return redirectToApp(redirect, { error: "auth_failed", state });
  }
}
