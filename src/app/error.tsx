"use client";

// Route-level error boundary for the app. Catches ANY client-side render
// exception inside the root layout (the layout itself keeps rendering —
// theme, fonts and the SW stay alive) and shows a friendly recovery
// screen instead of Next.js's raw white "client-side exception" page.
// Offline changes queued on the device are unaffected by a render error,
// so the copy can honestly reassure the user their data is safe.

import * as React from "react";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [offline, setOffline] = React.useState(false);

  React.useEffect(() => {
    // Log for dev diagnostics without spamming production consoles.
    console.error("[momentum] render error:", error);
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center"
    >
      <div className="flex size-16 items-center justify-center rounded-2xl border bg-muted/50">
        {offline ? (
          <CloudOff className="size-8 text-muted-foreground" aria-hidden="true" />
        ) : (
          <TriangleAlert className="size-8 text-amber-500" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          {offline ? "You're offline" : "Something went wrong"}
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          {offline
            ? "The app couldn't reach the network just now. Anything you changed is still saved safely on this device and will sync when you're back online."
            : "An unexpected error interrupted Momentum. Your data is safe — anything you changed recently is saved on this device and syncs when you reconnect."}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-11 items-center gap-2 rounded-xl border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          Reload app
        </button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
