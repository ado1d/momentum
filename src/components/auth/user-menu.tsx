"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Initials for the avatar fallback: first letters of the first two words of
 *  the display name, or of the email local part when the name is missing. */
function initialsOf(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "?";
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const first = words[0]?.[0] ?? "";
  const second = words[1]?.[0] ?? "";
  return (first + second).toUpperCase() || "U";
}

/**
 * Header avatar + account dropdown (name / email / sign out).
 * Lives in the app-shell header next to the theme toggle & notifications bell.
 */
export function UserMenu() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const name = session?.user?.name ?? null;
  const email = session?.user?.email ?? null;
  const image = session?.user?.image ?? null;
  const initials = initialsOf(name, email);

  const handleSignOut = async () => {
    try {
      // Clear client caches BEFORE the sign-out request so this definitely
      // runs — user A's data must never leak to user B. Three stores hold
      // user data: the TanStack in-memory cache (plus its IndexedDB
      // persistence), the service-worker HTTP caches, and the offline
      // write queue.
      queryClient.clear();
      if ("caches" in window) {
        try {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
        } catch {
          /* Storage API unavailable (private mode…) — nothing to clean. */
        }
      }
      try {
        const { clearQueue } = await import("@/lib/offline-queue");
        await clearQueue();
        const { del } = await import("idb-keyval");
        await del("momentum-query-cache-v1");
      } catch {
        /* best effort */
      }
    } finally {
      // Full-page redirect to "/" — page.tsx then shows the login screen.
      await signOut({ callbackUrl: "/" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="press flex size-10 shrink-0 items-center justify-center rounded-full outline-none"
        >
          {image ? (
            <img
              src={image}
              alt=""
              className="size-8 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-2 ring-border"
            >
              {initials}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="min-w-0">
          <p className="truncate font-medium">{name ?? email ?? "Signed in"}</p>
          {email && (
            <p className="max-w-40 truncate text-xs font-normal text-muted-foreground">
              {email}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void handleSignOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
