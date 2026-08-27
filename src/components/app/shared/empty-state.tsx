"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center",
        "bg-muted/30",
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 text-primary ring-1 ring-primary/10 dark:from-emerald-500/20 dark:to-teal-500/10">
        <Icon className="size-8" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-balance">
        {description}
      </p>
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && onAction && (
            <Button size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button size="sm" variant="outline" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
