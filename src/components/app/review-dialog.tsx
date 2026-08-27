"use client";

// Weekly review dialog — renders the aggregated week (GET /api/review)
// with week navigation, sparkline, stat tiles, and PDF / Markdown export.

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
  BookOpen,
  CalendarOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Download,
  Printer,
  Repeat,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

import { reviewApi } from "@/lib/api";
import { addDaysToKey, keyToDate, todayKey } from "@/lib/dates";
import { downloadMarkdown, esc, printHtml } from "@/lib/export";
import type { Mood, WeeklyReview } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/shared/empty-state";
import { ProgressBar } from "@/components/app/shared/progress";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────

const MOOD_EMOJI: Record<Mood, string> = {
  great: "🤩",
  good: "🙂",
  okay: "😐",
  low: "🙁",
  rough: "😣",
};

/** Priority dot colors — mirrors the PriorityBadge tints in shared/badges. */
const PRIORITY_DOT: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/40",
};

/** 125 → "2h 5m", 45 → "45m", 120 → "2h" */
function formatMinutes(total: number): string {
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** "Aug 24 – 30, 2026" (dialog header). */
function rangeLabel(startKey: string, endKey: string): string {
  const s = keyToDate(startKey);
  const e = keyToDate(endKey);
  if (!isValid(s) || !isValid(e)) return `${startKey} – ${endKey}`;
  if (s.getFullYear() !== e.getFullYear()) {
    return `${format(s, "MMM d, yyyy")} – ${format(e, "MMM d, yyyy")}`;
  }
  if (s.getMonth() === e.getMonth()) {
    return `${format(s, "MMM d")} – ${format(e, "d, yyyy")}`;
  }
  return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
}

/** "Aug 24–30, 2026" (compact, for export titles / filenames). */
function compactRangeLabel(startKey: string, endKey: string): string {
  const s = keyToDate(startKey);
  const e = keyToDate(endKey);
  if (!isValid(s) || !isValid(e)) return `${startKey}–${endKey}`;
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${format(s, "MMM d")}–${format(e, "d, yyyy")}`;
  }
  return rangeLabel(startKey, endKey);
}

function dayLabel(key: string): string {
  const d = keyToDate(key);
  return isValid(d) ? format(d, "EEE, MMM d") : key;
}

function moodEmoji(mood: Mood | null): string {
  return mood ? MOOD_EMOJI[mood] ?? "📝" : "📝";
}

// ── Export builders ──────────────────────────────────────────

/** True when the week had no tracked activity at all. */
function weekIsEmpty(r: WeeklyReview): boolean {
  return (
    r.avgScore === 0 &&
    r.tasksCompleted === 0 &&
    r.habitChecks === 0 &&
    r.focusMinutes === 0 &&
    r.journal.length === 0
  );
}

/** Styled HTML for the print pipeline (mirrors the dialog sections). */
function buildReviewHtml(r: WeeklyReview): string {
  const delta = r.avgScore - r.prevAvgScore;
  const deltaText =
    delta === 0
      ? "same as last week"
      : `${delta > 0 ? "up" : "down"} ${Math.abs(delta)} vs last week (${r.prevAvgScore})`;
  const out: string[] = [];

  // Overview
  out.push(`
    <div style="display:flex; align-items:baseline; gap:14px; margin-bottom:2px;">
      <span style="font-size:42px; font-weight:700; color:#0f766e; line-height:1;">${r.avgScore}</span>
      <span style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:1.5px;">Avg daily score</span>
    </div>
    <div style="font-size:12px; color:#555; margin-bottom:20px;">
      ${esc(deltaText)}${r.bestDay ? ` &middot; Best day: <strong>${esc(dayLabel(r.bestDay.date))}</strong> (${r.bestDay.score})` : ""}
    </div>`);

  // Day-by-day score table
  out.push(`
    <div style="font-size:14px; font-weight:700; margin:16px 0 6px;">Day-by-day</div>
    <table style="width:100%; border-collapse:collapse; font-size:12px;">
      <tr style="background:#f0fdf9;">
        <th align="left" style="padding:6px 8px; border-bottom:2px solid #0f766e;">Day</th>
        <th align="right" style="padding:6px 8px; border-bottom:2px solid #0f766e;">Score</th>
        <th align="right" style="padding:6px 8px; border-bottom:2px solid #0f766e;">Tasks</th>
        <th align="right" style="padding:6px 8px; border-bottom:2px solid #0f766e;">Habits</th>
        <th align="right" style="padding:6px 8px; border-bottom:2px solid #0f766e;">Routine</th>
      </tr>
      ${r.scores
        .map(
          (d) => `
        <tr>
          <td style="padding:5px 8px; border-bottom:1px solid #e8e8e8;">${esc(dayLabel(d.date))}</td>
          <td align="right" style="padding:5px 8px; border-bottom:1px solid #e8e8e8;"><strong>${d.score}</strong></td>
          <td align="right" style="padding:5px 8px; border-bottom:1px solid #e8e8e8;">${d.todosCompleted}</td>
          <td align="right" style="padding:5px 8px; border-bottom:1px solid #e8e8e8;">${d.habitsCompleted}</td>
          <td align="right" style="padding:5px 8px; border-bottom:1px solid #e8e8e8;">${d.routineCompleted}</td>
        </tr>`
        )
        .join("")}
    </table>`);

  // Stat strip
  out.push(`
    <div style="font-size:14px; font-weight:700; margin:18px 0 6px;">The week at a glance</div>
    <ul style="margin:0 0 4px 18px; padding:0; font-size:13px; line-height:1.7;">
      <li>Tasks completed: <strong>${r.tasksCompleted}</strong></li>
      <li>Habit check-ins: <strong>${r.habitChecks}</strong></li>
      <li>Focus time: <strong>${esc(formatMinutes(r.focusMinutes))}</strong> across ${r.focusSessions} ${r.focusSessions === 1 ? "session" : "sessions"}${r.focusMinutes > 0 && r.focusVsLastWeek !== 0 ? ` (${r.focusVsLastWeek > 0 ? "+" : ""}${r.focusVsLastWeek}% vs last week)` : ""}</li>
      <li>Journal entries: <strong>${r.journal.length}</strong></li>
    </ul>`);

  if (r.taskList.length > 0) {
    out.push(`
      <div style="font-size:14px; font-weight:700; margin:18px 0 6px;">Completed tasks</div>
      <ul style="margin:0 0 4px 18px; padding:0; font-size:13px; line-height:1.7;">
        ${r.taskList
          .map(
            (t) =>
              `<li>${t.completedAt ? esc(dayLabel(t.completedAt.slice(0, 10))) + " — " : ""}${esc(t.title)} <span style="color:#888;">(${esc(t.priority)})</span></li>`
          )
          .join("")}
      </ul>`);
  }

  if (r.habits.length > 0) {
    out.push(`
      <div style="font-size:14px; font-weight:700; margin:18px 0 6px;">Habits</div>
      <ul style="margin:0 0 4px 18px; padding:0; font-size:13px; line-height:1.7;">
        ${r.habits
          .map(
            (h) =>
              `<li>${esc(h.emoji)} ${esc(h.name)} — ${h.done}/${h.total} days (${h.pct}%)</li>`
          )
          .join("")}
      </ul>`);
  }

  if (r.goalSnapshots.length > 0) {
    out.push(`
      <div style="font-size:14px; font-weight:700; margin:18px 0 6px;">Goals in progress</div>
      <ul style="margin:0 0 4px 18px; padding:0; font-size:13px; line-height:1.7;">
        ${r.goalSnapshots
          .map(
            (g) =>
              `<li>${esc(g.title)} — ${g.progress}/${g.target}${g.unit ? ` ${esc(g.unit)}` : ""}</li>`
          )
          .join("")}
      </ul>`);
  }

  if (r.journal.length > 0) {
    out.push(`
      <div style="font-size:14px; font-weight:700; margin:18px 0 6px;">Journal moments</div>
      <ul style="margin:0 0 4px 18px; padding:0; font-size:13px; line-height:1.7;">
        ${r.journal
          .map(
            (j) =>
              `<li>${moodEmoji(j.mood)} ${esc(dayLabel(j.date))} — ${esc(j.title || "Untitled entry")}</li>`
          )
          .join("")}
      </ul>`);
  }

  return out.join("\n");
}

/** Markdown rendering of the same review data. */
function buildReviewMarkdown(r: WeeklyReview): string {
  const delta = r.avgScore - r.prevAvgScore;
  const lines: string[] = [];

  lines.push(`# Weekly Review — ${compactRangeLabel(r.weekStart, r.weekEnd)}`, "");
  lines.push(`**Avg daily score:** ${r.avgScore} (last week: ${r.prevAvgScore}${delta !== 0 ? ` — ${delta > 0 ? "up" : "down"} ${Math.abs(delta)}` : ""})`);
  if (r.bestDay) {
    lines.push(`**Best day:** ${dayLabel(r.bestDay.date)} · ${r.bestDay.score}`);
  }
  lines.push("");

  lines.push("## Day-by-day", "");
  lines.push("| Day | Score | Tasks | Habits | Routine |");
  lines.push("| :-- | ----: | ----: | -----: | ------: |");
  for (const d of r.scores) {
    lines.push(
      `| ${dayLabel(d.date)} | ${d.score} | ${d.todosCompleted} | ${d.habitsCompleted} | ${d.routineCompleted} |`
    );
  }
  lines.push("");

  lines.push("## The week at a glance", "");
  lines.push(`- Tasks completed: ${r.tasksCompleted}`);
  lines.push(`- Habit check-ins: ${r.habitChecks}`);
  lines.push(
    `- Focus time: ${formatMinutes(r.focusMinutes)} across ${r.focusSessions} ${r.focusSessions === 1 ? "session" : "sessions"}${r.focusMinutes > 0 && r.focusVsLastWeek !== 0 ? ` (${r.focusVsLastWeek > 0 ? "+" : ""}${r.focusVsLastWeek}% vs last week)` : ""}`
  );
  lines.push(`- Journal entries: ${r.journal.length}`);
  lines.push("");

  if (r.taskList.length > 0) {
    lines.push("## Completed tasks", "");
    for (const t of r.taskList) {
      lines.push(`- ${t.title} (${t.priority})`);
    }
    lines.push("");
  }

  if (r.habits.length > 0) {
    lines.push("## Habits", "");
    for (const h of r.habits) {
      lines.push(`- ${h.emoji} ${h.name} — ${h.done}/${h.total} days (${h.pct}%)`);
    }
    lines.push("");
  }

  if (r.goalSnapshots.length > 0) {
    lines.push("## Goals in progress", "");
    for (const g of r.goalSnapshots) {
      lines.push(`- ${g.title} — ${g.progress}/${g.target}${g.unit ? ` ${g.unit}` : ""}`);
    }
    lines.push("");
  }

  if (r.journal.length > 0) {
    lines.push("## Journal moments", "");
    for (const j of r.journal) {
      lines.push(`- ${moodEmoji(j.mood)} ${dayLabel(j.date)} — ${j.title || "Untitled entry"}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Small building blocks ────────────────────────────────────

function ScoreDelta({ avg, prev }: { avg: number; prev: number }) {
  const delta = avg - prev;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        Same as last week
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        up
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
      )}
    >
      {up ? (
        <TrendingUp className="size-3" aria-hidden="true" />
      ) : (
        <TrendingDown className="size-3" aria-hidden="true" />
      )}
      {up ? "+" : "−"}
      {Math.abs(delta)} vs last week {prev}
    </span>
  );
}

function ScoreBars({ scores }: { scores: WeeklyReview["scores"] }) {
  const today = todayKey();
  return (
    <div
      role="img"
      aria-label={`Daily scores: ${scores
        .map((d) => `${format(keyToDate(d.date), "EEE")} ${d.score}`)
        .join(", ")}`}
    >
      <div className="flex h-20 items-end gap-1.5">
        {scores.map((d) => {
          const isToday = d.date === today;
          return (
            <div key={d.date} className="flex h-full flex-1 items-end">
              <div
                title={`${format(keyToDate(d.date), "EEE")} ${d.score}`}
                style={{ height: `${Math.max(d.score, 5)}%` }}
                className={cn(
                  "w-full rounded-md transition-[height] duration-500",
                  d.score > 0
                    ? isToday
                      ? "bg-gradient-to-t from-emerald-600 to-teal-400"
                      : "bg-emerald-500/60"
                    : "bg-muted"
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {scores.map((d) => (
          <span
            key={d.date}
            className="flex-1 truncate text-center text-[10px] font-medium leading-none text-muted-foreground"
          >
            {format(keyToDate(d.date), "EEE")}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatTiles({ review }: { review: WeeklyReview }) {
  const focusDelta = review.focusVsLastWeek;
  const showFocusDelta = review.focusMinutes > 0 && focusDelta !== 0;
  const tiles = [
    {
      icon: CheckCircle2,
      label: "Tasks completed",
      value: String(review.tasksCompleted),
      tile: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      sub: null as string | null,
      subUp: true,
    },
    {
      icon: Repeat,
      label: "Habit check-ins",
      value: String(review.habitChecks),
      tile: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
      sub: null,
      subUp: true,
    },
    {
      icon: Timer,
      label: "Focus time",
      value: formatMinutes(review.focusMinutes),
      tile: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
      sub: showFocusDelta
        ? `${focusDelta > 0 ? "+" : ""}${focusDelta}% vs last wk`
        : null,
      subUp: focusDelta > 0,
    },
    {
      icon: BookOpen,
      label: "Journal entries",
      value: String(review.journal.length),
      tile: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
      sub: null,
      subUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tiles.map(({ icon: Icon, label, value, tile, sub, subUp }) => (
        <div key={label} className="rounded-xl border bg-muted/30 p-3">
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg",
              tile
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-2 text-lg font-bold leading-none tabular-nums">
            {value}
          </p>
          <p className="mt-1 text-[11px] font-medium leading-snug text-muted-foreground">
            {label}
          </p>
          {sub && (
            <p
              className={cn(
                "mt-0.5 text-[10px] font-semibold leading-none",
                subUp
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon
        className="size-3.5 text-emerald-600 dark:text-emerald-400"
        aria-hidden="true"
      />
      {children}
    </h3>
  );
}

function ReviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading weekly review">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-16" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
    </div>
  );
}

// ── Dialog ───────────────────────────────────────────────────

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewDialog({ open, onOpenChange }: ReviewDialogProps) {
  const [anchor, setAnchor] = React.useState(todayKey());

  // Always start on the current week when the dialog opens.
  React.useEffect(() => {
    if (open) setAnchor(todayKey());
  }, [open]);

  const prevAnchor = addDaysToKey(anchor, -7);
  const nextAnchor = addDaysToKey(anchor, 7);
  const nextDisabled = nextAnchor > todayKey(); // no future weeks

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["review", anchor],
    queryFn: () => reviewApi.get(anchor),
    enabled: open,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const handleExportPdf = () => {
    if (!data) return;
    try {
      printHtml(
        `Weekly Review — ${compactRangeLabel(data.weekStart, data.weekEnd)}`,
        buildReviewHtml(data)
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "PDF export failed"
      );
    }
  };

  const handleDownloadMd = () => {
    if (!data) return;
    try {
      downloadMarkdown(
        buildReviewMarkdown(data),
        `momentum-review-${data.weekStart}.md`
      );
      toast.success("Markdown downloaded", {
        description: `Saved momentum-review-${data.weekStart}.md`,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Markdown export failed"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-lg">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 pb-4 pr-12 pt-5 sm:px-6">
          <div className="min-w-0">
            <DialogTitle className="text-lg">Your week</DialogTitle>
            <DialogDescription className="mt-0.5 tabular-nums">
              {data ? rangeLabel(data.weekStart, data.weekEnd) : "…"}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label="Previous week"
              onClick={() => setAnchor(prevAnchor)}
              disabled={isLoading && !data}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg"
              aria-label="Next week"
              onClick={() => setAnchor(nextAnchor)}
              disabled={nextDisabled || (isLoading && !data)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {isLoading && !data ? (
            <ReviewSkeleton />
          ) : isError ? (
            <EmptyState
              icon={CloudOff}
              title="Couldn't load your review"
              description="Something went wrong while summarizing your week. Check your connection and try again."
              actionLabel="Try again"
              onAction={() => void refetch()}
              className="py-10"
            />
          ) : data ? (
            weekIsEmpty(data) ? (
              <EmptyState
                icon={CalendarOff}
                title="A quiet week — nothing tracked yet"
                description="Complete tasks, check off habits, or write a diary entry and this space will fill up."
                className="py-10"
              />
            ) : (
              <div className="space-y-5">
                {/* Hero */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <p className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-5xl font-bold leading-none tabular-nums text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400">
                      {data.avgScore}
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Avg daily score
                      </p>
                      <ScoreDelta avg={data.avgScore} prev={data.prevAvgScore} />
                    </div>
                  </div>
                  {data.bestDay && (
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Best day
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {dayLabel(data.bestDay.date)} · {data.bestDay.score}
                      </p>
                    </div>
                  )}
                </div>

                {/* Score sparkline */}
                <ScoreBars scores={data.scores} />

                {/* Stat tiles */}
                <StatTiles review={data} />

                {/* Completed tasks */}
                {data.taskList.length > 0 && (
                  <section aria-label="Completed tasks" className="space-y-2.5">
                    <SectionLabel icon={CheckCircle2}>
                      Completed tasks
                    </SectionLabel>
                    <ul className="space-y-1.5">
                      {data.taskList.map((t, i) => (
                        <li key={`${i}-${t.title}`} className="flex items-center gap-2.5 text-sm">
                          <CheckCircle2
                            className="size-4 shrink-0 text-emerald-500"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {t.title}
                          </span>
                          <span
                            role="img"
                            aria-label={`${t.priority} priority`}
                            title={`${t.priority} priority`}
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.low
                            )}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Habits */}
                {data.habits.length > 0 && (
                  <section aria-label="Habits" className="space-y-2.5">
                    <SectionLabel icon={Repeat}>Habits</SectionLabel>
                    <ul className="space-y-3">
                      {data.habits.map((h) => (
                        <li key={h.id} className="flex items-center gap-3">
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-base leading-none"
                            aria-hidden="true"
                          >
                            {h.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">
                                {h.name}
                              </p>
                              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                done {h.done}/{h.total}
                              </p>
                            </div>
                            <ProgressBar
                              value={h.pct}
                              className="mt-1.5 h-1.5"
                              barClassName="bg-gradient-to-r from-emerald-500 to-teal-500"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Goals in progress */}
                {data.goalSnapshots.length > 0 && (
                  <section
                    aria-label="Goals in progress"
                    className="space-y-2.5"
                  >
                    <SectionLabel icon={Target}>Goals in progress</SectionLabel>
                    <ul className="space-y-3">
                      {data.goalSnapshots.map((g) => (
                        <li key={g.id} className="flex items-center gap-3">
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                            aria-hidden="true"
                          >
                            <Target className="size-4" aria-hidden="true" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium">
                                {g.title}
                              </p>
                              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {g.progress}/{g.target}
                                {g.unit ? ` ${g.unit}` : ""}
                              </p>
                            </div>
                            <ProgressBar
                              value={g.target > 0 ? (g.progress / g.target) * 100 : 0}
                              className="mt-1.5 h-1.5"
                              barClassName="bg-gradient-to-r from-teal-500 to-emerald-500"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Journal moments */}
                {data.journal.length > 0 && (
                  <section
                    aria-label="Journal moments"
                    className="space-y-2.5"
                  >
                    <SectionLabel icon={BookOpen}>Journal moments</SectionLabel>
                    <ul className="space-y-1.5">
                      {data.journal.map((j) => (
                        <li key={j.date} className="flex items-center gap-2.5 text-sm">
                          <span
                            className="shrink-0 text-base leading-none"
                            aria-hidden="true"
                          >
                            {moodEmoji(j.mood)}
                          </span>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {dayLabel(j.date)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-muted-foreground">
                            {j.title || "Untitled entry"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )
          ) : null}
        </div>

        {/* Sticky footer actions */}
        <div className="shrink-0 border-t px-5 py-3.5 sm:px-6">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadMd}
              disabled={!data}
            >
              <Download className="size-4" aria-hidden="true" />
              Download .md
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={!data}
            >
              <Printer className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
