"use client";

import * as React from "react";
import { QueryCache, QueryClient, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { createIdbPersister } from "@/lib/query-persister";
import { scheduleOfflineReapply } from "@/lib/offline-cache";
import { OfflineSync } from "./offline-sync";

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
  const [queryClient] = React.useState(() => {
    let client!: QueryClient;
    // QueryCache.onSuccess fires ONLY for successful FETCHES (never for
    // setQueryData), which makes it the perfect hook for re-applying
    // optimistic offline patches: whenever fresh server data lands while
    // the offline queue is non-empty — including the stale SW-cached
    // responses served while offline — the pending patches are re-applied
    // on top so offline changes stay visible. Without this, a background
    // refetch while offline silently wipes every offline change from the
    // screen (setQueryData doesn't trigger onSuccess → no loop).
    const queryCache = new QueryCache({
      onSuccess: () => scheduleOfflineReapply(client),
    });
    client = new QueryClient({
      queryCache,
      defaultOptions: {
        queries: {
          staleTime: 20 * 1000,
          retry: 1,
          refetchOnWindowFocus: true,
          // Keep restored queries around for a week so offline cold
          // starts (app opened with no network) still render data.
          gcTime: 1000 * 60 * 60 * 24 * 7,
        },
        mutations: {
          // Mutations must EXECUTE while offline so api.ts can divert
          // them into the IndexedDB offline queue (default "online"
          // mode would pause them instead — the queue would never fill).
          networkMode: "offlineFirst",
          retry: 0,
        },
      },
    });
    return client;
  });

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* SessionProvider needs no config — the defaults hit /api/auth/session. */}
      <SessionProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: createIdbPersister(),
            maxAge: 1000 * 60 * 60 * 24 * 7, // one week
            dehydrateOptions: {
              // Persist successful queries only — never error states.
              shouldDehydrateQuery: (query) => query.state.status === "success",
            },
          }}
        >
          <UnauthorizedWatcher />
          {/* Offline write queue: optimistic patches + replay on reconnect */}
          <OfflineSync />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </PersistQueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
