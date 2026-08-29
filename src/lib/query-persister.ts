"use client";

// TanStack Query cache persister backed by IndexedDB (via idb-keyval).
// Persisting the query cache means the app opens with fresh-enough data
// even on a cold start with no network — combined with the service
// worker's app-shell cache this is what makes Momentum feel installed
// rather than hosted.

import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { get, set, del } from "idb-keyval";

const STORAGE_KEY = "momentum-query-cache-v1";

export function createIdbPersister(): Persister {
  return {
    async persistClient(client: PersistedClient) {
      try {
        await set(STORAGE_KEY, client);
      } catch {
        /* storage quota / private mode — persistence is best-effort */
      }
    },
    async restoreClient(): Promise<PersistedClient | undefined> {
      try {
        const value = await get<PersistedClient>(STORAGE_KEY);
        return value ?? undefined;
      } catch {
        return undefined;
      }
    },
    async removeClient() {
      try {
        await del(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
