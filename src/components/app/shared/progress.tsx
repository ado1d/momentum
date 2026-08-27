"use client";

import { cn } from "@/lib/utils";

interface ProgressRingProps {
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  label?: string;
  /**
   * Optional node rendered in place of the plain `label` text (e.g. an
   * animated <CountUp/>). `label` still drives the accessible name, so
   * screen-reader output stays static while the visible number animates.
   */
  labelNode?: React.ReactNode;
  sublabel?: string;
  className?: string;
}

export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 9,
  label,
  labelNode,
  sublabel,
  className,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      role="img"
      aria-label={label ? `${label}: ${Math.round(clamped)} percent` : `Progress ${Math.round(clamped)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <span className="text-xl font-bold tabular-nums sm:text-2xl">
            {labelNode ?? label}
          </span>
        )}
        {sublabel && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  value: number; // 0..100
  className?: string;
  barClassName?: string;
}

export function ProgressBar({ value, className, barClassName }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-500 ease-out",
          barClassName
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
