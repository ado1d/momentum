// Minimal HS256 JWT (sign/verify) for the mobile app's sync bearer tokens.
// Signed with NEXTAUTH_SECRET so production needs no new env vars.
// Hand-rolled with node:crypto — no extra dependency.

import crypto from "crypto";

const SECRET = () => process.env.NEXTAUTH_SECRET ?? "";
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

export interface MobileJwtPayload {
  uid: string;
  email: string;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return crypto.createHmac("sha256", SECRET()).update(data).digest("base64url");
}

export function signMobileJwt(uid: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ uid, email, iat: now, exp: now + TTL_SECONDS }),
  );
  const sig = hmac(`${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

/** Returns the payload when the token is well-formed, signature-valid and unexpired. */
export function verifyMobileJwt(token: string): MobileJwtPayload | null {
  if (!SECRET()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = hmac(`${header}.${payload}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as MobileJwtPayload;
    if (!parsed.uid || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Extracts the uid from an `Authorization: Bearer <token>` header, or null. */
export function bearerUid(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const payload = verifyMobileJwt(match[1].trim());
  return payload?.uid ?? null;
}
