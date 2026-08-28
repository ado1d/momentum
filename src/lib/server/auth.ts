// NextAuth configuration + server-side session helpers.
// Google provider, JWT strategy (stateless — ideal for serverless/Vercel).
// The User row is upserted on first sign-in; its id rides inside the JWT
// (`token.uid`) so every API request can scope data to its owner without
// an extra DB lookup in the session callback hot path.

import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth/next";
import GoogleProvider from "next-auth/providers/google";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/server/http";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // First sign-in (or re-consent): upsert the local User row and
      // attach its id to the token. `token.uid` persists across requests.
      if (account && user?.email) {
        const dbUser = await db.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name ?? undefined,
            image: user.image ?? undefined,
          },
          create: {
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
            emailVerified: new Date(),
          },
        });
        token.uid = dbUser.id;
        token.picture = user.image ?? token.picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        (session.user as { id?: string }).id = token.uid as string;
      }
      return session;
    },
  },
  pages: {
    // The login experience lives INSIDE the single-page app (client view),
    // not on a separate route. This URL is only used as an error fallback.
    signIn: "/",
  },
};

/** Returns the authenticated user's id, or null when signed out. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * API-route guard: resolves the signed-in user id or throws HttpError(401).
 * Usage inside a route handler:
 *
 *   const userId = await requireUserId();
 *   // …then scope every Prisma query with `where: { userId, … }`
 *
 * The User row's existence is verified too — a valid-but-orphaned session
 * (user deleted server-side, or a forged uid) must fail cleanly with 401
 * instead of crashing later writes on the userId FK.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    throw new HttpError("Sign in to use Momentum", 401);
  }
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new HttpError("Sign in to use Momentum", 401);
  }
  return userId;
}
