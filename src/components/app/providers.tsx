"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

// Module-level debounce flag for 401 handling. While true, additional
// "momentum:unauthorized" events (a burst of 401s from several queries
// failing in the same tick) are ignored; it resets after 5s so a later,
// genuinely-new session loss is handled again.
let handlingUnauthorized = false;

/**
 * Listens for 401 signals dispatched by src/lib/api.ts (see the guard there).
 * On the first 401 in a burst: cancel in-flight queries and clear the cache so
 * signed-out payloads never render / never get retried in a loop.
 *
 * Deliberately does NOT call signOut(): useSession's own polling decides the
 * final auth state — a single route hiccup shouldn't kill a still-valid
 * session. Page-level gating (src/app/page.tsx) swaps to the login screen
 * once the session actually reads as signed out.
 */
function UnauthorizedWatcher() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const onUnauthorized = () => {
      if (handlingUnauthorized) return;
      handlingUnauthorized = true;
      void queryClient.cancelQueries();
      queryClient.clear();
      window.setTimeout(() => {
        handlingUnauthorized = false;
      }, 5000);
    };
    window.addEventListener("momentum:unauthorized", onUnauthorized);
    return () => window.removeEventListener("momentum:unauthorized", onUnauthorized);
  }, [queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20 * 1000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* SessionProvider needs no config — the defaults hit /api/auth/session. */}
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <UnauthorizedWatcher />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
