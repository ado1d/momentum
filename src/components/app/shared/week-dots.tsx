"use client";

import * as React from "react";
import { shortDayName, todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface WeekDotsProps {
  /** keys -> done or not */
  doneMap: Record<string, boolean>;
  /** ordered day keys to show (oldest → newest) */
  days: string[];
  className?: string;
  dotClassName?: string;
}

/** A row of day-dots used on habit cards (mini heatmap) */
export function WeekDots({ doneMap, days, className, dotClassName }: WeekDotsProps) {
  const today = todayKey();
  return (
    <div className={cn("flex items-center gap-1", className)} aria-hidden="true">
      {days.map((d) => {
        const done = doneMap[d];
        const isToday = d === today;
        return (
          <div key={d} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "size-2.5 rounded-full transition-colors",
                done
                  ? "bg-primary"
                  : isToday
                    ? "border-2 border-primary/50 bg-transparent"
                    : "bg-muted",
                dotClassName
              )}
            />
            <span
              className={cn(
                "text-[9px] font-medium leading-none",
                isToday ? "text-primary" : "text-muted-foreground/60"
              )}
            >
              {shortDayName(d).slice(0, 1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
