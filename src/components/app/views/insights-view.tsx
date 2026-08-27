"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, isValid } from "date-fns";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CloudOff,
  Flame,
  Gauge,
  Repeat,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { statsApi } from "@/lib/api";
import { keyToDate, todayKey, weekdayOfKey } from "@/lib/dates";
import { useUiStore } from "@/lib/store";
import { MOODS, type DayStat, type InsightsData, type Mood } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/shared/empty-state";
import { habitDotStyles, habitRingStyles } from "@/components/app/shared/badges";
import { ProgressBar } from "@/components/app/shared/progress";
import { ViewHeader } from "@/components/app/shared/view-header";
import { ReviewDialog } from "@/components/app/review-dialog";
import { cn } from "@/lib/utils";

type TrendPoint = { date: string; count: number };
type HabitStat = InsightsData["habitConsistency"][number];

// ── Helpers ──────────────────────────────────────────────────

/** "Aug 27" style short label for a YYYY-MM-DD key. */
function shortDate(key: string): string {
  const d = keyToDate(key);
  return isValid(d) ? format(d, "MMM d") : key;
}

/** 65 → "1h 5m", 45 → "45m", 120 → "2h" */
function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatCompact(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** GitHub-style heat levels for a 0..100 day score. */
function heatLevelClass(score: number): string {
  if (score <= 0) return "bg-muted";
  if (score < 25) return "bg-emerald-500/25";
  if (score < 50) return "bg-emerald-500/45";
  if (score < 75) return "bg-emerald-500/70";
  return "bg-emerald-500";
}

const moodBarStyles: Record<Mood, string> = {
  great: "bg-emerald-500",
  good: "bg-teal-500",
  okay: "bg-amber-500",
  low: "bg-orange-500",
  rough: "bg-rose-500",
};

const WEEKDAY_LABELS = ["M", "", "W", "", "F", "", ""];

/** Catmull-Rom → cubic bezier smoothing, clamped to the 0..40 plot band. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  const clamp = (v: number) => Math.min(40, Math.max(0, v));
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

// ── Small building blocks ────────────────────────────────────

/** Light mount-only fade/slide so cards stagger in (matches dashboard). */
function FadeIn({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function StatChip({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconClassName?: string;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className={cn("size-3.5 shrink-0", iconClassName)} aria-hidden="true" />
      {label}
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </span>
  );
}

function CardHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <CardTitle className="text-base font-semibold leading-tight">{title}</CardTitle>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Skeleton / error ─────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading insights">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[78px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function InsightsError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={CloudOff}
      title="Couldn't load your insights"
      description="Something went wrong while crunching your numbers. Check your connection and try again."
      actionLabel="Try again"
      onAction={onRetry}
      className="mt-8"
    />
  );
}

// ── Totals strip ─────────────────────────────────────────────

function TotalsStrip({ totals }: { totals: InsightsData["totals"] }) {
  const items = [
    {
      icon: CheckCircle2,
      label: "Tasks completed",
      value: totals.todosCompleted.toLocaleString(),
      tile: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      icon: BookOpen,
      label: "Diary entries",
      value: totals.journalEntries.toLocaleString(),
      tile: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    },
    {
      icon: Repeat,
      label: "Habit checks",
      value: totals.habitChecks.toLocaleString(),
      tile: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
    },
    {
      icon: Timer,
      label: "Focus hours",
      value: formatCompact(totals.focusHours),
      tile: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <section
      aria-label="All-time totals"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      {items.map(({ icon: Icon, label, value, tile }) => (
        <Card key={label} className="gap-0 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                tile
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
              <p className="mt-1 text-xs font-medium leading-snug text-muted-foreground">
                {label}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}

// ── Activity heatmap ─────────────────────────────────────────

function HeatmapCard({ heatmap }: { heatmap: DayStat[] }) {
  const today = todayKey();

  // Pad the first column so day 1 of the data lands on its Monday-based row.
  const weeks = React.useMemo(() => {
    if (heatmap.length === 0) return [] as (DayStat | null)[][];
    const pad = weekdayOfKey(heatmap[0].date) - 1; // Mon=1 → 0 padding
    const cells: (DayStat | null)[] = [
      ...Array.from({ length: pad }, () => null),
      ...heatmap,
    ];
    const out: (DayStat | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [heatmap]);

  // Tiny month label above a column whenever the month changes.
  const monthLabels = React.useMemo(() => {
    let last = -1;
    return weeks.map((week) => {
      const first = week.find((c): c is DayStat => c !== null);
      if (!first) return "";
      const d = keyToDate(first.date);
      if (!isValid(d)) return "";
      const m = d.getFullYear() * 12 + d.getMonth();
      if (m !== last) {
        last = m;
        return format(d, "MMM");
      }
      return "";
    });
  }, [weeks]);

  const { longestStreak, activeDays, avgScore } = React.useMemo(() => {
    let streak = 0;
    let best = 0;
    let active = 0;
    let sum = 0;
    for (const d of heatmap) {
      if (d.score > 0) {
        streak += 1;
        active += 1;
        if (streak > best) best = streak;
      } else {
        streak = 0;
      }
      sum += d.score;
    }
    return {
      longestStreak: best,
      activeDays: active,
      avgScore: heatmap.length ? Math.round(sum / heatmap.length) : 0,
    };
  }, [heatmap]);

  const allEmpty = heatmap.length > 0 && heatmap.every((d) => d.score <= 0);
  const totalDays = heatmap.length;

  return (
    <Card className="gap-4 rounded-2xl p-4 sm:p-5">
      <CardHead
        title="Activity"
        subtitle="Last 12 weeks"
        action={
          <div
            className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
            aria-hidden="true"
          >
            Less
            {[
              "bg-muted",
              "bg-emerald-500/25",
              "bg-emerald-500/45",
              "bg-emerald-500/70",
              "bg-emerald-500",
            ].map((c) => (
              <span key={c} className={cn("size-2.5 rounded-[3px]", c)} />
            ))}
            More
          </div>
        }
      />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="no-scrollbar overflow-x-auto"
          role="img"
          aria-label={`Activity heatmap for the last 12 weeks — ${activeDays} of ${totalDays} days active, average score ${avgScore}.`}
        >
          <div className="flex w-max gap-1">
            {/* Weekday hints (M / W / F) */}
            <div
              className="mr-1 flex flex-col gap-1 pt-4 text-[9px] font-medium leading-none text-muted-foreground/60"
              aria-hidden="true"
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i} className="flex h-[11px] items-center sm:h-3">
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                <span className="flex h-3 items-center text-[9px] font-medium leading-none text-muted-foreground/70">
                  {monthLabels[wi]}
                </span>
                {week.map((cell, ci) =>
                  cell ? (
                    <span
                      key={cell.date}
                      title={`${shortDate(cell.date)} · score ${cell.score} · ${cell.todosCompleted} ${cell.todosCompleted === 1 ? "task" : "tasks"}, ${cell.habitsCompleted} ${cell.habitsCompleted === 1 ? "habit" : "habits"}, ${cell.routineCompleted} routine`}
                      className={cn(
                        "size-[11px] rounded-[3px] sm:size-3",
                        heatLevelClass(cell.score),
                        cell.date === today &&
                          "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      )}
                    />
                  ) : (
                    <span
                      key={`pad-${wi}-${ci}`}
                      className="size-[11px] sm:size-3"
                      aria-hidden="true"
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:max-w-[13rem] sm:flex-col sm:items-stretch sm:gap-2.5">
          <StatChip
            icon={Flame}
            iconClassName="text-orange-500"
            label="Longest streak"
            value={`${longestStreak} ${longestStreak === 1 ? "day" : "days"}`}
          />
          <StatChip
            icon={CalendarCheck}
            iconClassName="text-teal-600 dark:text-teal-400"
            label="Active days"
            value={`${activeDays} / ${totalDays}`}
          />
          <StatChip
            icon={Activity}
            iconClassName="text-emerald-600 dark:text-emerald-400"
            label="Avg score"
            value={String(avgScore)}
          />
        </div>
      </div>

      {allEmpty && (
        <p className="text-xs text-muted-foreground">
          Start checking things off to fill your heatmap.
        </p>
      )}
    </Card>
  );
}

// ── Tasks trend (pure inline SVG line/area chart) ────────────

function TasksTrendCard({ trend }: { trend: TrendPoint[] }) {
  const n = trend.length;

  const { max, total, best, avg } = React.useMemo(() => {
    const counts = trend.map((p) => p.count);
    const t = counts.reduce((a, b) => a + b, 0);
    // Round odd maxima up so the mid gridline/label stays an integer.
    const m = Math.max(1, ...counts);
    return {
      max: m >= 3 && m % 2 === 1 ? m + 1 : m,
      total: t,
      best: counts.length ? Math.max(...counts) : 0,
      avg: counts.length ? t / counts.length : 0,
    };
  }, [trend]);

  // Points live in a 100×40 viewBox; the SVG stretches with
  // preserveAspectRatio="none" and strokes use vector-effect so they
  // stay crisp. Text (axis labels) is rendered as HTML so it never distorts.
  const points = React.useMemo(
    () =>
      trend.map((p, i) => ({
        ...p,
        x: ((i + 0.5) * 100) / n,
        y: 40 - (p.count / max) * 40,
        yPct: (1 - p.count / max) * 100,
      })),
    [trend, n, max]
  );

  const linePath = React.useMemo(() => smoothPath(points), [points]);
  const areaPath = React.useMemo(() => {
    if (points.length < 2) return "";
    const last = points[points.length - 1];
    const first = points[0];
    return `${linePath} L ${last.x.toFixed(2)} 40 L ${first.x.toFixed(2)} 40 Z`;
  }, [linePath, points]);

  const xLabelIdx = React.useMemo(() => {
    if (n === 0) return [] as number[];
    const raw = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((n - 1) * f));
    return [...new Set(raw)];
  }, [n]);

  const mid = max / 2;
  const showMid = max >= 2; // max=1 has no integer midpoint

  return (
    <Card className="gap-4 rounded-2xl p-4 sm:p-5">
      <CardHead title="Tasks completed" subtitle="Last 30 days" />

      <div
        className="flex gap-2"
        role="img"
        aria-label={`Tasks completed per day over the last ${n} days — total ${total}, best day ${best}, average ${avg.toFixed(1)} per day.`}
      >
        {/* Y-axis labels (HTML so they stay crisp) */}
        <div className="relative w-7 shrink-0 text-right text-[9px] font-medium leading-none tabular-nums text-muted-foreground">
          <span className="absolute inset-x-0 top-0 -translate-y-1/2">
            {formatCompact(max)}
          </span>
          {showMid && (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2">
              {formatCompact(mid)}
            </span>
          )}
          <span className="absolute inset-x-0 top-full -translate-y-1/2">0</span>
        </div>

        {/* Plot area */}
        <div className="relative h-36 min-w-0 flex-1">
          <svg
            className="absolute inset-0 h-full w-full text-primary"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="insights-trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Gridlines */}
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="0"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="stroke-muted-foreground/15"
            />
            {showMid && (
              <line
                x1="0"
                y1="20"
                x2="100"
                y2="20"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                className="stroke-muted-foreground/10"
              />
            )}
            <line
              x1="0"
              y1="40"
              x2="100"
              y2="40"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
              className="stroke-muted-foreground/15"
            />
            {/* Area + line */}
            {areaPath && <path d={areaPath} fill="url(#insights-trend-fill)" />}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                className="stroke-primary"
              />
            )}
          </svg>

          {/* Hover zones: one per day — tooltip + guideline + dot */}
          <div
            className="absolute inset-0 grid"
            style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
            aria-hidden="true"
          >
            {points.map((p) => (
              <div
                key={p.date}
                className="group relative"
                title={`${shortDate(p.date)} · ${p.count} ${p.count === 1 ? "task" : "tasks"} completed`}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/15 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                <span
                  className="absolute left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  style={{ top: `${p.yPct}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* X-axis labels */}
      <div className="-mt-2 flex justify-between pl-9 text-[9px] font-medium leading-none tabular-nums text-muted-foreground">
        {xLabelIdx.map((i) => (
          <span key={i}>{shortDate(trend[i].date)}</span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatChip
          icon={CheckCircle2}
          iconClassName="text-emerald-600 dark:text-emerald-400"
          label="Total"
          value={total.toLocaleString()}
        />
        <StatChip
          icon={Zap}
          iconClassName="text-amber-500"
          label="Best day"
          value={String(best)}
        />
        <StatChip
          icon={Gauge}
          iconClassName="text-teal-600 dark:text-teal-400"
          label="Average"
          value={`${avg.toFixed(1)}/day`}
        />
      </div>
    </Card>
  );
}

// ── Habit consistency ────────────────────────────────────────

function HabitRow({ habit }: { habit: HabitStat }) {
  const ring = habitRingStyles[habit.color] ?? habitRingStyles.teal;
  const bar = habitDotStyles[habit.color] ?? habitDotStyles.teal;
  return (
    <div className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border text-lg leading-none",
          ring
        )}
        aria-hidden="true"
      >
        {habit.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{habit.name}</span>
            {habit.streak > 1 && (
              <span
                className="shrink-0 text-xs font-semibold tabular-nums text-orange-500"
                title={`${habit.streak} day streak`}
              >
                🔥 {habit.streak}
              </span>
            )}
          </p>
          <span className="shrink-0 text-sm font-semibold tabular-nums">
            {habit.pct}%
          </span>
        </div>
        <ProgressBar
          value={habit.pct}
          className="mt-2 h-1.5"
          barClassName={bar}
        />
      </div>
    </div>
  );
}

function HabitConsistencyCard({
  habits,
  onGoRoutine,
}: {
  habits: HabitStat[];
  onGoRoutine: () => void;
}) {
  const header = (
    <CardHead title="Habit consistency" subtitle="Last 30 days" />
  );

  if (habits.length === 0) {
    return (
      <Card className="gap-3 rounded-2xl p-4 sm:p-5">
        {header}
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          description="Create habits in your routine and their 30-day consistency will show up here."
          actionLabel="Create habits"
          onAction={onGoRoutine}
          className="border-0 bg-transparent py-8"
        />
      </Card>
    );
  }

  return (
    <Card className="gap-3 rounded-2xl p-4 sm:p-5">
      {header}
      <div className="max-h-[26rem] divide-y overflow-y-auto pr-1">
        {habits.map((habit) => (
          <HabitRow key={habit.id} habit={habit} />
        ))}
      </div>
    </Card>
  );
}

// ── Mood distribution ────────────────────────────────────────

function MoodCard({ distribution }: { distribution: InsightsData["moodDistribution"] }) {
  const total = distribution.reduce((a, d) => a + d.count, 0);

  // Render in a fixed best→rough order, only moods that were recorded.
  const rows = MOODS.map((m) => {
    const entry = distribution.find((d) => d.mood === m.value);
    return entry ? { ...m, count: entry.count } : null;
  }).filter((r): r is { value: Mood; label: string; emoji: string; count: number } => r !== null);

  const pctOf = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return (
    <Card className="gap-4 rounded-2xl p-4 sm:p-5">
      <CardHead title="Mood over time" subtitle="From your diary entries" />

      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Mood distribution across ${total} diary ${total === 1 ? "entry" : "entries"}: ${rows
          .map((r) => `${r.label} ${pctOf(r.count)}%`)
          .join(", ")}.`}
      >
        {rows.map((r) => (
          <div
            key={r.value}
            className={moodBarStyles[r.value]}
            style={{ width: `${pctOf(r.count)}%` }}
            title={`${r.label} · ${r.count} ${r.count === 1 ? "entry" : "entries"} · ${pctOf(r.count)}%`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.value} className="flex items-center gap-2 text-sm">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", moodBarStyles[r.value])}
              aria-hidden="true"
            />
            <span className="text-base leading-none" aria-hidden="true">
              {r.emoji}
            </span>
            <span className="font-medium">{r.label}</span>
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {r.count} · {pctOf(r.count)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Focus time ───────────────────────────────────────────────

function FocusCard({ focus }: { focus: InsightsData["focus"] }) {
  const delta = focus.weekMinutes - focus.lastWeekMinutes;
  const noFocus = focus.weekMinutes === 0;

  return (
    <Card className="gap-4 rounded-2xl p-4 sm:p-5">
      <CardHead title="Focus time" subtitle="Your recent deep-work sessions" />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            This week
          </p>
          <p className="mt-1 text-3xl font-bold leading-none tabular-nums">
            {formatMinutes(focus.weekMinutes)}
          </p>
        </div>
        {noFocus ? (
          <p className="max-w-[16rem] text-xs text-muted-foreground">
            Use the Focus timer to track deep work.
          </p>
        ) : delta === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Same as last week
          </span>
        ) : (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
              delta > 0
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/15 text-red-700 dark:text-red-300"
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="size-3.5" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3.5" aria-hidden="true" />
            )}
            {delta > 0 ? "+" : "-"}
            {formatMinutes(Math.abs(delta))} vs last week
          </span>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/40 px-3.5 py-3">
          <p className="text-xs font-medium text-muted-foreground">Today</p>
          <p className="mt-1 text-xl font-bold leading-none tabular-nums">
            {formatMinutes(focus.todayMinutes)}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 px-3.5 py-3">
          <p className="text-xs font-medium text-muted-foreground">Avg session</p>
          <p className="mt-1 text-xl font-bold leading-none tabular-nums">
            {formatMinutes(focus.avgSessionMinutes)}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ── Weekly review CTA ────────────────────────────────────────

/** Emerald-gradient-bordered call-to-action that opens the weekly review dialog. */
function WeeklyReviewCta({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 p-px shadow-card">
      <button
        type="button"
        onClick={onOpen}
        className="press flex w-full items-center gap-3 rounded-[calc(1rem-1px)] bg-background px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
          aria-hidden="true"
        >
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Weekly review</span>
          <span className="block truncate text-xs text-muted-foreground">
            Your week in one view — scores, wins &amp; moments
          </span>
        </span>
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────

export function InsightsView() {
  const setView = useUiStore((s) => s.setView);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["insights"],
    queryFn: statsApi.insights,
  });

  if (isLoading) return <InsightsSkeleton />;
  if (isError || !data) {
    return <InsightsError onRetry={() => void refetch()} />;
  }

  return (
    <div>
      <ViewHeader title="Insights" subtitle="Your productivity trends at a glance" />

      <div className="space-y-4 sm:space-y-5">
        <FadeIn>
          <WeeklyReviewCta onOpen={() => setReviewOpen(true)} />
        </FadeIn>

        <FadeIn delay={0.05}>
          <TotalsStrip totals={data.totals} />
        </FadeIn>

        <FadeIn delay={0.1}>
          <HeatmapCard heatmap={data.heatmap} />
        </FadeIn>

        <FadeIn delay={0.15}>
          <TasksTrendCard trend={data.todosTrend} />
        </FadeIn>

        <FadeIn delay={0.2}>
          <HabitConsistencyCard
            habits={data.habitConsistency}
            onGoRoutine={() => setView("routine")}
          />
        </FadeIn>

        {data.moodDistribution.length > 0 && (
          <FadeIn delay={0.25}>
            <MoodCard distribution={data.moodDistribution} />
          </FadeIn>
        )}

        <FadeIn delay={0.3}>
          <FocusCard focus={data.focus} />
        </FadeIn>

        <FadeIn delay={0.35}>
          <p className="pb-2 pt-1 text-center text-xs text-muted-foreground">
            Insights update as you use Momentum — complete tasks, check habits,
            write your diary.
          </p>
        </FadeIn>
      </div>

      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
