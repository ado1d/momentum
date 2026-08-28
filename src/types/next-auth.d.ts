// Augment next-auth's Session type: the JWT session callback in
// src/lib/server/auth.ts stamps the database User id onto session.user.id.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}
