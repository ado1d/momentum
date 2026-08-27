// Shared HTTP helpers for API route handlers: consistent JSON responses,
// zod-backed body validation, and error → status mapping.
// Every route handler wraps its logic in try/catch + handleApiError so bad
// input never crashes the server.

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";

/** Throwable error carrying an HTTP status. */
export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** JSON response helper. */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function errorJson(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function formatZodError(err: ZodError): string {
  const parts = err.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "body";
    return `${path}: ${issue.message}`;
  });
  return parts.length > 0
    ? `Validation failed — ${parts.join("; ")}`
    : "Validation failed";
}

/**
 * Reads and parses a JSON request body. An empty/absent body resolves to `{}`.
 * Throws HttpError(400) for unreadable or non-JSON bodies.
 */
export async function readJsonBody(req: Request): Promise<unknown> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new HttpError("Unable to read request body", 400);
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError("Request body must be valid JSON", 400);
  }
}

/** Validates `data` against a zod schema; throws HttpError(400) on failure. */
export function parseOrThrow<S extends ZodType>(schema: S, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(formatZodError(result.error), 400);
  }
  return result.data;
}

/** Maps any thrown value to a `{ error }` JSON response with a proper status. */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return errorJson(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return errorJson(formatZodError(err), 400);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return errorJson("Record not found", 404);
    if (err.code === "P2002") {
      return errorJson("A record with these unique values already exists", 409);
    }
  }
  console.error("[api] unhandled error:", err);
  return errorJson("Internal server error", 500);
}
