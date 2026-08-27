"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Animated count-up for pure number slots.
 *
 * Tweens from the previously rendered value to `value` with a cubic
 * ease-out over `duration` ms (default 700) using requestAnimationFrame,
 * and re-runs whenever `value` changes. Jumps instantly (no tween) when
 * the user prefers reduced motion, when the tab is hidden, or when the
 * value did not change. Rounds to integers; pass `format` for custom
 * rendering (e.g. `n.toLocaleString()`).
 *
 * Only wrap plain numbers — keep units/suffixes ("%", "days", "2h 5m")
 * and aria-label text outside the component so accessible names stay
 * stable while the visible number animates. Unmount-safe via
 * cancelAnimationFrame + a mounted flag.
 */
export function CountUp({
  value,
  duration = 700,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = React.useState(0);
  // Last value we rendered or tweened towards (null before first run).
  const lastRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number>(0);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    mountedRef.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hidden = document.visibilityState === "hidden";
    const from = lastRef.current;
    const start = from ?? 0; // first mount counts up from zero
    const delta = from === null ? value : value - from;

    if (reduce || hidden || delta === 0) {
      lastRef.current = value;
      setDisplay(value);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      if (!mountedRef.current) return;
      // Clamp t: rAF timestamps can land slightly before t0 (frame
      // boundaries), which would otherwise overshoot the ease curve.
      const t = Math.min(1, Math.max(0, (now - t0) / duration));
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      const current = Math.round(start + (value - start) * eased);
      lastRef.current = current;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return (
    <span className={cn("tabular-nums", className)}>
      {format ? format(display) : String(display)}
    </span>
  );
}
