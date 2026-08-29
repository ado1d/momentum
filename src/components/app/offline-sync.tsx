"use client";

// OfflineSync — invisible component mounted inside the QueryClientProvider.
//
// Responsibilities:
//   • Apply optimistic cache patches when a mutation is diverted into the
//     offline queue (so the UI reflects offline changes immediately).
//   • Replay the queue when connectivity returns ("online" event) and on
//     app load (catching up changes made during a previous offline session).
//   • After a successful sync, invalidate all queries so the UI converges
//     on fresh server truth, with user-facing toasts.
//
// UI state is broadcast via window events so the OfflineBadge (and any
// other component) can react without prop drilling.

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { applyOfflineOptimistic, type OfflineMutationDetail } from "@/lib/offline-cache";
import { getQueueCount, replayQueue } from "@/lib/offline-queue";

export const QUEUE_SYNCING_EVENT = "momentum:queue-syncing";

export function OfflineSync() {
  const queryClient = useQueryClient();
  const syncingRef = React.useRef(false);
  const queuedToastShownRef = React.useRef(false);

  const sync = React.useCallback(async () => {
    if (syncingRef.current) return;
    const pending = await getQueueCount();
    if (pending === 0) {
      queuedToastShownRef.current = false;
      return;
    }

    syncingRef.current = true;
    window.dispatchEvent(
      new CustomEvent(QUEUE_SYNCING_EVENT, { detail: { active: true, count: pending } }),
    );
    try {
      const result = await replayQueue();
      if (result.synced > 0 || result.dropped > 0) {
        void queryClient.invalidateQueries();
      }
      if (result.synced > 0) {
        toast.success(
          result.synced === 1
            ? "Offline change synced ✓"
            : `All ${result.synced} offline changes synced ✓`,
        );
      }
      if (result.dropped > 0) {
        toast.warning(
          result.dropped === 1
            ? "1 offline change couldn't sync — it may have been removed on another device"
            : `${result.dropped} offline changes couldn't sync — they may have been removed on another device`,
        );
      }
      queuedToastShownRef.current = false;
    } finally {
      syncingRef.current = false;
      window.dispatchEvent(
        new CustomEvent(QUEUE_SYNCING_EVENT, {
          detail: { active: false, count: await getQueueCount() },
        }),
      );
    }
  }, [queryClient]);

  React.useEffect(() => {
    const onQueued = (event: Event) => {
      const detail = (event as CustomEvent<OfflineMutationDetail>).detail;
      if (detail) applyOfflineOptimistic(queryClient, detail);
      if (!queuedToastShownRef.current) {
        queuedToastShownRef.current = true;
        toast.info("You're offline — saved on this device, will sync automatically", {
          description: "Keep using the app; your changes upload when you reconnect.",
          duration: 6000,
        });
      }
    };
    const onOnline = () => {
      queuedToastShownRef.current = false;
      void sync();
    };

    window.addEventListener("momentum:offline-queued", onQueued);
    window.addEventListener("online", onOnline);

    // Catch up on changes queued during a previous offline session.
    if (typeof navigator !== "undefined" && navigator.onLine) void sync();

    return () => {
      window.removeEventListener("momentum:offline-queued", onQueued);
      window.removeEventListener("online", onOnline);
    };
  }, [queryClient, sync]);

  return null;
}
