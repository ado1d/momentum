"use client";

import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "./pwa-register";
import { cn } from "@/lib/utils";

/**
 * OfflineBadge — small fixed pill at the bottom-left that slides/fades in
 * when the browser reports no connection (and back out when it returns).
 * Theme-aware (muted surface + border); sits above the safe area and, on
 * mobile, above the fixed bottom navigation. No toasts — the badge alone
 * communicates the offline state.
 */
export function OfflineBadge() {
  const online = useOnlineStatus();
  const visible = !online;

  return (
    <div
      data-offline-badge={visible ? "" : undefined}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
      className={cn(
        // Fixed bottom-left, above the safe area (and above the mobile
        // bottom nav); z-40 keeps it above content but under dialogs.
        "fixed left-3 z-40 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] lg:left-4",
        "flex items-center gap-2 rounded-full border bg-muted/95 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-muted/85",
        "transition-all duration-300 ease-out",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">Offline — showing cached data</span>
    </div>
  );
}
