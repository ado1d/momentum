"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Unified skeleton block for loading states.
 *
 * Default: Tailwind's built-in pulse (`animate-pulse` on `bg-muted`).
 * `shimmer` additionally layers a subtle white gradient sweep (see
 * `.skeleton-shimmer` in globals.css — the sweep overlay only exists
 * under `prefers-reduced-motion: no-preference`, so reduced-motion
 * users just get the plain pulse with zero residue).
 */
function Skeleton({
  className,
  shimmer = false,
  ...props
}: React.ComponentProps<"div"> & { shimmer?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-muted",
        shimmer && "skeleton-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
