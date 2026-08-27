"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Priority, TodoCategory } from "@/lib/types";

const priorityStyles: Record<Priority, string> = {
  urgent: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
        priorityStyles[priority] ?? priorityStyles.low
      )}
    >
      {priority}
    </Badge>
  );
}

const categoryEmoji: Record<string, string> = {
  personal: "🌿",
  work: "💼",
  learning: "📚",
  health: "💪",
  other: "✨",
};

export function CategoryBadge({ category }: { category: string }) {
  return (
    <Badge
      variant="secondary"
      className="rounded-full px-2 py-0 text-[10px] font-medium"
    >
      {categoryEmoji[category] ?? "✨"} {category}
    </Badge>
  );
}

export const habitDotStyles: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
  orange: "bg-orange-500",
};

export const habitRingStyles: Record<string, string> = {
  emerald: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  amber: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rose: "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  violet: "border-violet-500/60 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  teal: "border-teal-500/60 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  orange: "border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-300",
};

export function getTodoCategoryValues(): TodoCategory[] {
  return ["personal", "work", "learning", "health", "other"];
}
