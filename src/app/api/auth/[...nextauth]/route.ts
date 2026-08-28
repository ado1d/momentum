// NextAuth route handler (App Router).
// Exposes every auth endpoint under /api/auth/* — Google sign-in, session,
// sign-out, and the OAuth callback.

import NextAuth from "next-auth";

import { authOptions } from "@/lib/server/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
