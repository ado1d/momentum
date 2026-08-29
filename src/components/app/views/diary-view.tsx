"use client";

import * as React from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  Ellipsis,
  FileText,
  Heart,
  Loader2,
  Pencil,
  Printer,
  Save,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import { addMonths, format, type Day } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";

import { EmptyState } from "@/components/app/shared/empty-state";
import { ViewHeader } from "@/components/app/shared/view-header";
import { MarkdownContent } from "@/components/app/shared/markdown";
import {
  RichEditor,
  type RichEditorHandle,
} from "@/components/app/shared/rich-editor";
import { exportApi, journalApi, settingsApi } from "@/lib/api";
import {
  addDaysToKey,
  dateToKey,
  formatKeyLabel,
  formatKeyLong,
  keyToDate,
  monthLabel,
  relativeTime,
  shortDayName,
  todayKey,
} from "@/lib/dates";
import { downloadMarkdown, esc, miniMarkdownToHtml, printHtml, readingStats } from "@/lib/export";
import { MOODS, type JournalEntry, type Mood } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Helpers ──────────────────────────────────────────────────

function moodEmojiOf(mood: Mood | null): string {
  return MOODS.find((m) => m.value === mood)?.emoji ?? "";
}

function moodLabelOf(mood: Mood | null): string {
  return MOODS.find((m) => m.value === mood)?.label ?? "";
}

/** Soft tinted halos per mood (all /10 backgrounds, theme aware). */
const MOOD_TINT: Record<Mood, string> = {
  great: "bg-emerald-500/10 ring-1 ring-emerald-500/15",
  good: "bg-teal-500/10 ring-1 ring-teal-500/15",
  okay: "bg-amber-500/10 ring-1 ring-amber-500/15",
  low: "bg-orange-500/10 ring-1 ring-orange-500/15",
  rough: "bg-rose-500/10 ring-1 ring-rose-500/15",
};

/** Matching outline badge tint for the expanded entry panel. */
const MOOD_BADGE: Record<Mood, string> = {
  great:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  good: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  okay: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  low: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  rough: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

/** Solid mood fills for the month heatmap (white day numbers). */
const MOOD_FILL: Record<Mood, string> = {
  great: "bg-emerald-500/80 text-white",
  good: "bg-teal-500/80 text-white",
  okay: "bg-amber-500/80 text-white",
  low: "bg-orange-500/80 text-white",
  rough: "bg-rose-500/80 text-white",
};

/** Neutral fill for entries logged without a mood. */
const MOOD_FILL_NONE = "bg-foreground/20 text-foreground";

/** Solid legend dots per mood. */
const MOOD_DOT: Record<Mood, string> = {
  great: "bg-emerald-500",
  good: "bg-teal-500",
  okay: "bg-amber-500",
  low: "bg-orange-500",
  rough: "bg-rose-500",
};

/** Single-letter weekday labels indexed by Date.getDay() (0 = Sunday). */
const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Longest run of consecutive day keys in a list of entries */
function longestStreakOf(entries: JournalEntry[]): number {
  const keys = Array.from(new Set(entries.map((e) => e.date))).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    run = prev !== null && addDaysToKey(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return best;
}

function entryPreview(entry: JournalEntry): string {
  if (entry.title?.trim()) return entry.title.trim();
  const plain = entry.content.replace(/[#>*_`~\-]/g, "").replace(/\s+/g, " ").trim();
  return plain.length > 60 ? `${plain.slice(0, 60)}…` : plain;
}

// ── Small shared pieces ──────────────────────────────────────

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We could not load your diary. Try again in a moment.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function StatChip({
  value,
  label,
  title,
}: {
  value: string | number;
  label: string;
  title?: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-card px-2 py-3 text-center shadow-card"
      title={title}
    >
      <p className="text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function DiarySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading diary">
      <Skeleton className="h-11 w-2/3 rounded-2xl" />
      <Skeleton className="h-[26rem] w-full rounded-2xl" />
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ── Timeline row ─────────────────────────────────────────────

interface TimelineRowProps {
  entry: JournalEntry;
  expanded: boolean;
  onToggle: () => void;
  onOpenDay: (entry: JournalEntry) => void;
  onRead: (entry: JournalEntry) => void;
  onDelete: (entry: JournalEntry) => void;
  isCurrent: boolean;
}

function TimelineRow({
  entry,
  expanded,
  onToggle,
  onOpenDay,
  onRead,
  onDelete,
  isCurrent,
}: TimelineRowProps) {
  return (
    <div
      className={cn(
        "press relative overflow-hidden rounded-2xl border bg-card shadow-card transition-colors",
        isCurrent && "border-primary/40"
      )}
    >
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={`entry-panel-${entry.id}`}
          className="flex min-h-[3.25rem] flex-1 items-center gap-3 rounded-l-2xl p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl text-xl",
              entry.mood ? MOOD_TINT[entry.mood] : "bg-muted/50"
            )}
            aria-hidden="true"
          >
            {moodEmojiOf(entry.mood) || "·"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{formatKeyLabel(entry.date)}</span>
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {shortDayName(entry.date)}
              </span>
              {isCurrent && (
                <Badge
                  className="rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide"
                  variant="default"
                >
                  Today
                </Badge>
              )}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {entryPreview(entry) || <span className="italic opacity-60">No content</span>}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
              aria-label={`Options for entry on ${formatKeyLabel(entry.date)}`}
            >
              <Ellipsis className="size-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => onRead(entry)}>
              <BookOpen aria-hidden="true" /> Read entry
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onOpenDay(entry)}>
              <Pencil aria-hidden="true" /> Edit this day
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(entry)}>
              <Trash2 aria-hidden="true" /> Delete entry
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        id={`entry-panel-${entry.id}`}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          expanded ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t px-3 pb-3 pt-3 sm:px-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {entry.mood && (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                    MOOD_BADGE[entry.mood]
                  )}
                >
                  {moodEmojiOf(entry.mood)} {moodLabelOf(entry.mood)}
                </Badge>
              )}
              {entry.energy !== null && (
                <Badge
                  variant="outline"
                  className="gap-1 rounded-full border-amber-500/30 bg-amber-500/15 px-2 py-0 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
                >
                  <Zap className="size-3" aria-hidden="true" /> Energy {entry.energy}/5
                </Badge>
              )}
            </div>
            {entry.content.trim() ? (
              <MarkdownContent content={entry.content} className="mt-2" />
            ) : (
              <p className="mt-2 text-sm italic text-muted-foreground/70">No content.</p>
            )}
            {entry.gratitude && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                <Heart className="mt-0.5 size-4 shrink-0 fill-rose-500 text-rose-500" aria-hidden="true" />
                <span>{entry.gratitude}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mood month heatmap ───────────────────────────────────────

function MoodCalendarCard({
  today,
  weekStartsOn,
  onReadEntry,
}: {
  today: string;
  weekStartsOn: Day;
  onReadEntry: (entry: JournalEntry) => void;
}) {
  const currentMonth = today.slice(0, 7);
  const [monthKey, setMonthKey] = React.useState(currentMonth);

  const { data: entries = [], isFetching } = useQuery({
    queryKey: ["journal", "month", monthKey],
    queryFn: () => journalApi.month(monthKey),
    placeholderData: keepPreviousData,
  });

  const byDate = React.useMemo(() => {
    const map = new Map<string, JournalEntry>();
    for (const e of entries) if (!map.has(e.date)) map.set(e.date, e);
    return map;
  }, [entries]);

  // Grid math — local calendar dates only, no timezone conversion.
  const firstOfMonth = keyToDate(`${monthKey}-01`);
  const daysInMonth = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth() + 1,
    0
  ).getDate();
  const leadingBlanks = (firstOfMonth.getDay() - weekStartsOn + 7) % 7;

  // Free navigation backwards capped at 12 months; never beyond the
  // current month forwards.
  const minMonth = format(
    addMonths(keyToDate(`${currentMonth}-01`), -12),
    "yyyy-MM"
  );
  const prevDisabled = monthKey <= minMonth;
  const nextDisabled = monthKey >= currentMonth;

  const shiftMonth = (delta: number) =>
    setMonthKey(format(addMonths(keyToDate(`${monthKey}-01`), delta), "yyyy-MM"));

  const weekdayHeader = Array.from(
    { length: 7 },
    (_, i) => WEEKDAY_LETTERS[(weekStartsOn + i) % 7]
  );

  const label = monthLabel(`${monthKey}-01`);

  return (
    <Card className="view-enter rounded-2xl py-0 shadow-card">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15 dark:text-emerald-400"
              aria-hidden="true"
            >
              <CalendarDays className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Mood calendar</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your month in colors
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              onClick={() => shiftMonth(-1)}
              disabled={prevDisabled}
              aria-label="Previous month"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span
              className="min-w-[7.5rem] text-center text-sm font-semibold tabular-nums"
              aria-live="polite"
            >
              {label}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-xl"
              onClick={() => shiftMonth(1)}
              disabled={nextDisabled}
              aria-label="Next month"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "mt-4 w-full max-w-[336px] transition-opacity",
            isFetching && "opacity-60"
          )}
          aria-busy={isFetching}
          aria-label={`Mood calendar — ${label}`}
        >
          <div className="grid grid-cols-7 gap-1">
            {weekdayHeader.map((letter, i) => (
              <span
                key={`wd-${i}`}
                aria-hidden="true"
                className="flex aspect-square items-center justify-center text-[11px] font-medium text-muted-foreground"
              >
                {letter}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, i) => (
              <span key={`blank-${i}`} aria-hidden="true" className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = `${monthKey}-${String(day).padStart(2, "0")}`;
              const entry = byDate.get(key) ?? null;
              const isToday = key === today;
              const isFuture = key > today;
              const moodLabel = entry?.mood ? moodLabelOf(entry.mood) : null;
              const tooltip = entry
                ? moodLabel
                  ? `${formatKeyLabel(key)} — ${moodLabel}`
                  : formatKeyLabel(key)
                : undefined;

              if (entry) {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onReadEntry(entry)}
                    title={tooltip}
                    aria-label={tooltip}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ring-1 ring-black/5 transition-[filter,box-shadow,transform] hover:brightness-110 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      entry.mood ? MOOD_FILL[entry.mood] : MOOD_FILL_NONE,
                      isToday &&
                        "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      isFuture && "opacity-50"
                    )}
                  >
                    {day}
                  </button>
                );
              }

              return (
                <div
                  key={key}
                  aria-disabled="true"
                  className={cn(
                    "flex aspect-square cursor-default items-center justify-center rounded-lg bg-muted/40 text-[11px] font-medium tabular-nums text-muted-foreground",
                    isToday &&
                      "ring-2 ring-primary ring-offset-1 ring-offset-background",
                    isFuture && "opacity-50"
                  )}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {MOODS.map((m) => (
              <span
                key={m.value}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
              >
                <span
                  className={cn("size-2 rounded-full", MOOD_DOT[m.value])}
                  aria-hidden="true"
                />
                {m.label}
              </span>
            ))}
          </div>
          <p className="whitespace-nowrap text-[11px] text-muted-foreground">
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {entries.length}
            </span>{" "}
            entries this month
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Entry read-mode dialog ───────────────────────────

/**
 * Read-mode dialog for a diary entry — clicking a mood-calendar day
 * or "Read entry" opens this rendered view FIRST (the editor stays
 * for the explicit "Edit this day" action). Shows the full date,
 * mood + energy, headline, rendered markdown and gratitude.
 */
function EntryReaderDialog({
  open,
  entry,
  today,
  onOpenChange,
  onEditDay,
}: {
  open: boolean;
  entry: JournalEntry | null;
  today: string;
  onOpenChange: (open: boolean) => void;
  onEditDay: (entry: JournalEntry) => void;
}) {
  // Keep the last entry around so the close animation has content.
  const lastEntryRef = React.useRef<JournalEntry | null>(null);
  if (entry) lastEntryRef.current = entry;
  const shown = entry ?? lastEntryRef.current;

  if (!shown) return null;

  const stats = readingStats(shown.content);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogDescription className="sr-only">Reading view</DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-8 sm:pt-6">
          <div className="flex items-start gap-3 pr-8">
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl",
                shown.mood ? MOOD_TINT[shown.mood] : "bg-muted/50"
              )}
              aria-hidden="true"
            >
              {moodEmojiOf(shown.mood) || "·"}
            </span>
            <div className="min-w-0">
              <DialogTitle className="break-words text-left text-lg font-bold leading-snug sm:text-xl">
                {formatKeyLong(shown.date)}
              </DialogTitle>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {shown.date === today && (
                  <Badge
                    className="rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide"
                    variant="default"
                  >
                    Today
                  </Badge>
                )}
                {shown.mood && (
                  <span>
                    {moodEmojiOf(shown.mood)} {moodLabelOf(shown.mood)}
                  </span>
                )}
                {shown.energy !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Energy {shown.energy}/5</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {shown.title && (
            <h3 className="mt-4 break-words text-base font-semibold sm:text-lg">
              {shown.title}
            </h3>
          )}

          <Separator className="my-4" />

          <div key={shown.id} className="view-enter">
            {shown.content.trim() ? (
              <MarkdownContent
                content={shown.content}
                className="text-[15px] leading-7 sm:text-base [&_blockquote]:my-3 [&_blockquote]:pl-4 [&_code]:text-[13px] [&_h1]:mb-2 [&_h1]:mt-6 [&_h1]:text-2xl [&_h2]:mb-1.5 [&_h2]:mt-5 [&_h2]:text-xl [&_h3]:mt-4 [&_h3]:text-lg [&_li]:mt-1 [&_ol]:my-2.5 [&_p]:my-2.5 [&_ul]:my-2.5"
              />
            ) : (
              <p className="text-sm italic text-muted-foreground/70">
                No written content for this day.
              </p>
            )}
          </div>

          {shown.gratitude && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-500/5 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
              <Heart
                className="mt-0.5 size-4 shrink-0 fill-rose-500 text-rose-500"
                aria-hidden="true"
              />
              <span>{shown.gratitude}</span>
            </p>
          )}

          {stats.words > 0 && (
            <p className="mt-4 text-[11px] text-muted-foreground">
              {stats.words} {stats.words === 1 ? "word" : "words"} · {stats.minutes} min read
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-5 py-3 sm:px-8">
          <span className="truncate text-[11px] text-muted-foreground">
            Edited {relativeTime(shown.updatedAt)}
          </span>
          <Button className="h-10 shrink-0 rounded-xl" onClick={() => onEditDay(shown)}>
            <Pencil aria-hidden="true" /> Edit this day
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ────────────────────────────────────────────────

export function DiaryView() {
  const queryClient = useQueryClient();
  const today = todayKey();

  const { data: entries = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["journal"],
    queryFn: () => journalApi.list({ limit: 366 }),
  });

  // Shared settings query (powers the calendar's week start)
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  // ── Editor state ──
  const [date, setDate] = React.useState(today);
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [mood, setMood] = React.useState<Mood | null>(null);
  const [energy, setEnergy] = React.useState(3);
  const [gratitude, setGratitude] = React.useState("");
  const [justSaved, setJustSaved] = React.useState(false);
  const [calOpen, setCalOpen] = React.useState(false);

  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = React.useState<JournalEntry | null>(null);
  const [readerOpen, setReaderOpen] = React.useState(false);
  const [readerEntry, setReaderEntry] = React.useState<JournalEntry | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);

  const contentRef = React.useRef<RichEditorHandle | null>(null);

  const entry = entries.find((e) => e.date === date) ?? null;

  // Load the selected day's entry into the form whenever the day
  // changes or a different server version arrives (e.g. after save).
  const syncedSig = React.useRef("");
  React.useEffect(() => {
    const sig = `${date}:${entry?.updatedAt ?? "-"}`;
    if (syncedSig.current !== sig) {
      syncedSig.current = sig;
      setTitle(entry?.title ?? "");
      setContent(entry?.content ?? "");
      setMood(entry?.mood ?? null);
      setEnergy(entry?.energy ?? 3);
      setGratitude(entry?.gratitude ?? "");
    }
  }, [date, entry]);

  // Auto-hide the "Saved" chip
  React.useEffect(() => {
    if (!justSaved) return;
    const id = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(id);
  }, [justSaved]);

  // ── Mutations ──

  const saveEntry = useMutation({
    mutationFn: () =>
      journalApi.upsert({
        date,
        title: title.trim() || null,
        content,
        mood,
        energy,
        gratitude: gratitude.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      setJustSaved(true);
      toast.success(entry ? "Diary updated" : "Diary saved");
    },
    onError: (e) => toast.error(e.message || "Could not save entry"),
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => journalApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["journal"] });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Entry deleted");
      setEntryToDelete(null);
    },
    onError: (e) => toast.error(e.message || "Could not delete entry"),
  });

  // ── Derived data ──

  const isToday = date === today;
  const nextKey = addDaysToKey(date, 1);
  const nextDisabled = nextKey > today;

  const thisMonthPrefix = today.slice(0, 7);
  const thisMonthCount = entries.filter((e) => e.date.startsWith(thisMonthPrefix)).length;
  const longestStreak = longestStreakOf(entries);

  const timeline = React.useMemo(() => {
    const groups: { month: string; items: JournalEntry[] }[] = [];
    for (const e of [...entries].sort((a, b) => b.date.localeCompare(a.date))) {
      const month = monthLabel(e.date);
      const last = groups[groups.length - 1];
      if (last && last.month === month) last.items.push(e);
      else groups.push({ month, items: [e] });
    }
    return groups;
  }, [entries]);

  // ── Handlers ──

  const save = () => {
    if (
      !entry &&
      !title.trim() &&
      !content.trim() &&
      !gratitude.trim() &&
      mood === null
    ) {
      toast.error("Write something first — even one line counts");
      contentRef.current?.focus();
      return;
    }
    saveEntry.mutate();
  };

  const openDay = (e: JournalEntry) => {
    setDate(e.date);
    setExpandedId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** Clicking a calendar day / “Read entry” opens the read-mode view. */
  const openReadEntry = (e: JournalEntry) => {
    setReaderEntry(e);
    setReaderOpen(true);
  };

  /** “Edit this day” — close the reader, load the day into the editor. */
  const editFromReader = (e: JournalEntry) => {
    setReaderOpen(false);
    openDay(e);
  };

  const focusTodayEditor = () => {
    setDate(today);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Wait for the form to sync to today's entry, then focus.
    setTimeout(() => contentRef.current?.focus(), 120);
  };

  const runExport = async (
    id: string,
    label: string,
    fn: () => Promise<void> | void
  ) => {
    setExporting(id);
    const toastId = toast.loading(`Preparing ${label}…`);
    try {
      await fn();
      toast.success(`${label} ready`, { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${label} failed`, { id: toastId });
    } finally {
      setExporting(null);
    }
  };

  const exportMarkdown = () =>
    runExport("md", "Markdown export", async () => {
      const md = await exportApi.markdown("journal");
      downloadMarkdown(md, "momentum-diary.md");
    });

  const exportPdf = () =>
    runExport("pdf", "PDF export", async () => {
      if (entries.length === 0) {
        toast.error("Nothing to export yet");
        return;
      }
      const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
      const html = sorted
        .map(
          (e) => `
        <div>
          <div style="font-size:17px; font-weight:700; margin:18px 0 4px;">${esc(formatKeyLabel(e.date))}${moodEmojiOf(e.mood) ? ` ${moodEmojiOf(e.mood)}` : ""}${e.title ? ` — ${esc(e.title)}` : ""}</div>
          ${e.energy !== null ? `<div style="font-size:11px; color:#777;">Energy ${e.energy}/5</div>` : ""}
          ${e.gratitude ? `<div style="font-size:13px; color:#0f766e; margin:6px 0;">♥ Grateful for: ${esc(e.gratitude)}</div>` : ""}
          ${miniMarkdownToHtml(e.content)}
          <hr style="border:none; border-top:1px solid #e3e3e3; margin:16px 0 4px;" />
        </div>`
        )
        .join("");
      printHtml("Daily Diary", html);
    });

  const exportBusy = exporting !== null;

  // ── Render ──

  return (
    <div>
      <ViewHeader
        title="Daily Diary"
        subtitle="Reflect, learn, grow"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl"
                aria-label="Export diary"
                disabled={exportBusy}
              >
                {exportBusy ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={exportMarkdown}>
                <FileText aria-hidden="true" /> Export diary (Markdown)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportPdf}>
                <Printer aria-hidden="true" /> Export diary (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {isLoading ? (
        <DiarySkeleton />
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          {entries.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              <StatChip value={entries.length} label="Entries" title="Total diary entries" />
              <StatChip value={thisMonthCount} label="This month" title="Entries written this calendar month" />
              <StatChip
                value={longestStreak}
                label="Best streak"
                title="Longest run of consecutive days with an entry"
              />
            </div>
          )}

          {/* ── Entry editor ── */}
          <Card className="rounded-2xl py-0 shadow-card">
            <CardContent className="p-4 sm:p-6">
              {/* Date navigation */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  onClick={() => setDate(addDaysToKey(date, -1))}
                  aria-label="Previous day"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      aria-label={`Choose a date — currently ${isToday ? "today" : formatKeyLabel(date)}`}
                    >
                      <span className="min-w-0 truncate text-sm font-semibold sm:text-base">
                        <span className="sm:hidden">
                          {isToday ? "Today · " : ""}
                          {formatKeyLabel(date)}
                        </span>
                        <span className="hidden sm:inline">
                          {isToday ? "Today · " : ""}
                          {formatKeyLong(date)}
                        </span>
                      </span>
                      <CalendarIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto rounded-2xl p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={keyToDate(date)}
                      onSelect={(d) => {
                        if (d) {
                          setDate(dateToKey(d));
                          setCalOpen(false);
                        }
                      }}
                      disabled={{ after: new Date() }}
                      weekStartsOn={(settings?.weekStartsOn ?? 1) as Day}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                  onClick={() => setDate(nextKey)}
                  disabled={nextDisabled}
                  aria-label="Next day"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>

              {/* Mood + energy */}
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Mood</Label>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Mood"
                  >
                    {MOODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setMood(mood === m.value ? null : m.value)}
                        aria-pressed={mood === m.value}
                        aria-label={`Mood: ${m.label}`}
                        title={m.label}
                        className={cn(
                          "flex size-11 items-center justify-center rounded-2xl border text-xl transition-all duration-200",
                          mood === m.value
                            ? "scale-110 border-primary bg-primary/10 ring-2 ring-primary/40"
                            : "border-border bg-muted/40 hover:bg-muted"
                        )}
                      >
                        <span aria-hidden="true">{m.emoji}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="entry-energy">Energy</Label>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {energy}/5
                    </span>
                  </div>
                  <div className="px-1 pt-3">
                    <Slider
                      id="entry-energy"
                      value={[energy]}
                      min={1}
                      max={5}
                      step={1}
                      onValueChange={([v]) => setEnergy(v)}
                      aria-label="Energy level"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                </div>
              </div>

              {/* Title / gratitude / content */}
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="entry-title">Headline</Label>
                  <Input
                    id="entry-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="What's the headline of your day?"
                    maxLength={140}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="entry-gratitude">Gratitude</Label>
                  <div className="relative">
                    <Heart
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-rose-500"
                      aria-hidden="true"
                    />
                    <Input
                      id="entry-gratitude"
                      value={gratitude}
                      onChange={(e) => setGratitude(e.target.value)}
                      placeholder="One thing you're grateful for…"
                      maxLength={200}
                      className="h-11 rounded-xl pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="entry-content">Entry</Label>
                  <RichEditor
                    id="entry-content"
                    value={content}
                    onChange={setContent}
                    placeholder="How was your day? What did you learn, feel, accomplish…"
                    minHeight={176}
                    handleRef={contentRef}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Formatting shows live as you type — ⌘B bold · ⌘I italic
                  </p>
                </div>
              </div>

              {/* Save row */}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  onClick={save}
                  disabled={saveEntry.isPending}
                  className="h-11 min-w-32 rounded-xl"
                >
                  {saveEntry.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Save aria-hidden="true" />
                  )}
                  {entry ? "Update" : "Save"} entry
                </Button>
                {entry && !justSaved && (
                  <span className="text-xs text-muted-foreground">
                    Entry exists for this day
                  </span>
                )}
                {justSaved && (
                  <Badge className="gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    <CircleCheck className="size-3.5" aria-hidden="true" /> Saved
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Mood calendar (month heatmap) ── */}
          <MoodCalendarCard
            today={today}
            weekStartsOn={(settings?.weekStartsOn ?? 1) as Day}
            onReadEntry={openReadEntry}
          />

          {/* ── Timeline ── */}
          {entries.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Your story starts today"
              description="Write your first entry above — a mood, a headline, one thing you're grateful for. Future-you will thank you."
              actionLabel="Write today's entry"
              onAction={focusTodayEditor}
            />
          ) : (
            <section aria-label="Past entries">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Past entries
              </h2>
              <div className="stagger-list relative space-y-5">
                {/* Timeline thread — fades out at both ends, peeks through
                    the gaps between rows and beside month labels. */}
                <span
                  aria-hidden="true"
                  className="fade-ends-y absolute bottom-3 left-[30px] top-0 w-px"
                />
                {timeline.map((group) => (
                  <div key={group.month}>
                    <h3 className="mb-2 pl-9 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {group.month}
                    </h3>
                    <div className="space-y-2">
                      {group.items.map((e) => (
                        <TimelineRow
                          key={e.id}
                          entry={e}
                          expanded={expandedId === e.id}
                          isCurrent={e.date === today}
                          onToggle={() =>
                            setExpandedId(expandedId === e.id ? null : e.id)
                          }
                          onOpenDay={openDay}
                          onRead={openReadEntry}
                          onDelete={setEntryToDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <EntryReaderDialog
        open={readerOpen}
        entry={readerEntry}
        today={today}
        onOpenChange={setReaderOpen}
        onEditDay={editFromReader}
      />

      <AlertDialog
        open={entryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setEntryToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Your diary entry for{" "}
              {entryToDelete ? formatKeyLong(entryToDelete.date) : "this day"} will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => entryToDelete && removeEntry.mutate(entryToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
