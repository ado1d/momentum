"use client";

import * as React from "react";
import { CloudUpload, Loader2, WifiOff } from "lucide-react";
import { useOnlineStatus } from "./pwa-register";
import { getQueueCount, replayQueue, QUEUE_CHANGED_EVENT } from "@/lib/offline-queue";
import { QUEUE_SYNCING_EVENT } from "./offline-sync";
import { cn } from "@/lib/utils";

/**
 * OfflineBadge — small fixed pill at the bottom-left that reflects the
 * app's connection + sync state:
 *
 *   • Offline: "Offline — 3 changes saved on this device" (or the plain
 *     "showing cached data" variant when nothing is queued).
 *   • Online with queued changes: "3 changes waiting — tap to sync".
 *   • Syncing: spinner + "Syncing changes…".
 *
 * The pill is a button while there are pending changes online (tap =
 * replay the queue now); purely informational otherwise. Sits above the
 * safe area and, on mobile, above the fixed bottom navigation.
 */
export function OfflineBadge() {
  const online = useOnlineStatus();
  const [pending, setPending] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const count = await getQueueCount();
      if (alive) setPending(count);
    };
    void refresh();

    const onQueueChanged = () => void refresh();
    const onSyncing = (event: Event) => {
      const detail = (event as CustomEvent<{ active: boolean }>).detail;
      setSyncing(Boolean(detail?.active));
    };
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    window.addEventListener(QUEUE_SYNCING_EVENT, onSyncing);
    return () => {
      alive = false;
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
      window.removeEventListener(QUEUE_SYNCING_EVENT, onSyncing);
    };
  }, []);

  const visible = !online || pending > 0 || syncing;
  const label = syncing
    ? pending > 0
      ? `Syncing ${pending} change${pending === 1 ? "" : "s"}…`
      : "Syncing changes…"
    : !online
      ? pending > 0
        ? `Offline — ${pending} change${pending === 1 ? "" : "s"} saved on this device`
        : "Offline — showing cached data"
      : `${pending} change${pending === 1 ? "" : "s"} waiting — tap to sync`;

  const interactive = online && pending > 0 && !syncing;

  return (
    <button
      type="button"
      data-offline-badge={visible ? "" : undefined}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      tabIndex={visible && interactive ? 0 : -1}
      disabled={!interactive}
      onClick={() => void replayQueue()}
      className={cn(
        // Fixed bottom-left, above the safe area (and above the mobile
        // bottom nav); z-40 keeps it above content but under dialogs.
        "fixed left-3 z-40 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] lg:left-4",
        "flex items-center gap-2 rounded-full border bg-muted/95 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-muted/85",
        "transition-all duration-300 ease-out",
        interactive && "cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      {syncing ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
      ) : online ? (
        <CloudUpload className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
