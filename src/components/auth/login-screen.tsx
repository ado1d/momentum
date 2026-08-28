"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { Flame, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** Standard 4-color Google "G" mark (inline so no external asset is needed). */
function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

const FEATURES = [
  { icon: Sparkles, label: "Tasks & habits" },
  { icon: Flame, label: "Streaks" },
  { icon: ShieldCheck, label: "Private by design" },
] as const;

/**
 * Shown instead of the whole app while signed out (see page.tsx gating).
 * Single client view — there is no separate /login route.
 */
export function LoginScreen() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* Ambient emerald glows (Tailwind-only; mirrors the app's .glow-ring vibe) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-20 size-80 rounded-full bg-primary/5 blur-3xl"
      />

      <main className="relative flex w-full max-w-sm flex-col items-center gap-8">
        {/* Brand — same Zap mark the app-shell header uses */}
        <div className="flex flex-col items-center gap-3">
          <div className="glow-ring flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Zap className="size-8" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Momentum</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your calm productivity companion
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <Card className="w-full gap-0 py-0">
          <CardContent className="flex flex-col gap-5 px-6 py-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold tracking-tight">Welcome back</h2>
              <p className="mt-1.5 text-balance text-sm text-muted-foreground">
                Sign in to sync your tasks, habits, goals and reflections.
              </p>
            </div>

            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="press flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-white text-sm font-semibold text-neutral-900 shadow-sm transition-shadow hover:shadow-md active:scale-95"
            >
              <GoogleG className="size-4.5" />
              Continue with Google
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              {FEATURES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1 rounded-full border bg-card px-2.5 py-1"
                >
                  <Icon className="size-3 text-primary" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Your data lives in your own database.
        </p>
      </main>
    </div>
  );
}
