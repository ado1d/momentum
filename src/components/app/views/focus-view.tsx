"use client";

// ───────────────────────────────────────────────────────────────
// Focus view — a Pomodoro deep-work timer.
//
// The engine is timestamp-based: while running we store `endsAt`
// (epoch ms) and re-derive the remaining time from Date.now() on a
// 250ms tick, so the countdown stays accurate even if the tab is
// throttled. Paused time lives in `pausedRemaining`. The state is
// mirrored to localStorage ("momentum-focus") so a page refresh
// never loses a running session — and one that expired while the
// page was closed is completed (and logged) on restore.
// ───────────────────────────────────────────────────────────────

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudOff,
  Coffee,
  Flame,
  ListChecks,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Timer,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError, focusApi, todosApi } from "@/lib/api";
import { formatTime, todayKey } from "@/lib/dates";
import { useUiStore } from "@/lib/store";
import type { FocusSessionInput, Todo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/shared/empty-state";
import { ViewHeader } from "@/components/app/shared/view-header";
import { cn } from "@/lib/utils";

// ── Modes & constants ─────────────────────────────────────────

type Mode = "focus" | "short" | "long";

const MODES: { value: Mode; label: string; tabShort: string }[] = [
  { value: "focus", label: "Focus", tabShort: "Focus" },
  { value: "short", label: "Short break", tabShort: "Short" },
  { value: "long", label: "Long break", tabShort: "Long" },
];

const MODE_LABEL: Record<Mode, string> = {
  focus: "Focus",
  short: "Short break",
  long: "Long break",
};

/** Active pill styles for the segmented control (emerald / amber / teal gradients). */
const MODE_TAB_ACTIVE: Record<Mode, string> = {
  focus:
    "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm dark:from-emerald-400 dark:to-teal-400 dark:text-teal-950",
  short:
    "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm dark:from-amber-400 dark:to-orange-400 dark:text-amber-950",
  long: "bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-sm dark:from-teal-400 dark:to-emerald-400 dark:text-teal-950",
};

const DEFAULT_DURATIONS: Record<Mode, number> = { focus: 25, short: 5, long: 15 };
const DURATION_PRESETS = [5, 10, 15, 25, 30, 45, 60];

const FOCUS_STORAGE_KEY = "momentum-focus";

const RING_SIZE = 264;
const RING_STROKE = 14;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const HOW_IT_WORKS: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: Timer,
    title: "Pick a task and set 25 minutes",
    desc: "Choose a task below — or a custom focus — and press Start.",
  },
  {
    icon: Brain,
    title: "Work with full focus — no distractions",
    desc: "One thing at a time until the chime rings.",
  },
  {
    icon: Coffee,
    title: "Take a short break and repeat",
    desc: "Five minutes off, then go again. Long break after four.",
  },
];

// ── Persistence ────────────────────────────────────────────────

interface PersistedFocus {
  v: 1;
  mode: Mode;
  durations: Record<Mode, number>;
  running: boolean;
  endsAt: number | null;
  remainingMs: number;
  startedAt: number | null;
  taskId: string | null;
  label: string | null;
  completedToday: number;
  dayKey: string;
  sound: boolean;
}

function isMode(v: unknown): v is Mode {
  return v === "focus" || v === "short" || v === "long";
}

function clampMinutes(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(240, Math.round(n)));
}

function readPersisted(): PersistedFocus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FOCUS_STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<PersistedFocus> | null;
    if (!d || typeof d !== "object") return null;
    const mode = isMode(d.mode) ? d.mode : "focus";
    const durations: Record<Mode, number> = {
      focus: clampMinutes(d.durations?.focus, DEFAULT_DURATIONS.focus),
      short: clampMinutes(d.durations?.short, DEFAULT_DURATIONS.short),
      long: clampMinutes(d.durations?.long, DEFAULT_DURATIONS.long),
    };
    return {
      v: 1,
      mode,
      durations,
      running: d.running === true && typeof d.endsAt === "number",
      endsAt: typeof d.endsAt === "number" ? d.endsAt : null,
      remainingMs: Number.isFinite(d.remainingMs)
        ? Number(d.remainingMs)
        : durations[mode] * 60_000,
      startedAt: typeof d.startedAt === "number" ? d.startedAt : null,
      taskId: typeof d.taskId === "string" ? d.taskId : null,
      label:
        typeof d.label === "string" && d.label.trim().length > 0 ? d.label : null,
      completedToday:
        typeof d.completedToday === "number" && d.completedToday >= 0
          ? Math.floor(d.completedToday)
          : 0,
      dayKey: typeof d.dayKey === "string" ? d.dayKey : todayKey(),
      sound: typeof d.sound === "boolean" ? d.sound : true,
    };
  } catch {
    return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Soft two-tone completion chime via the Web Audio API. */
function playChime() {
  try {
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? w.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    const tone = (freq: number, delay: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const t0 = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    };
    tone(880, 0, 0.3); // A5
    tone(1174.66, 0.18, 0.5); // D6
    window.setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 1400);
  } catch {
    /* Audio unavailable — chime is best-effort */
  }
}

/** MM:SS countdown display (ceil, so a fresh timer shows exactly 25:00). */
function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Light mount-only fade/slide so sections stagger in. */
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

// ── Small presentational pieces ────────────────────────────────

function SessionDots({ completed }: { completed: number }) {
  const filled = Math.min(4, completed);
  return (
    <div
      className="flex items-center gap-2.5"
      aria-label={`${completed} focus ${completed === 1 ? "session" : "sessions"} completed today — long break after four`}
      title="Focus sessions completed today (long break after four)"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Sessions
      </span>
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-2.5 rounded-full transition-all duration-500",
              i < filled
                ? cn(
                    "bg-primary",
                    i === filled - 1 &&
                      "animate-in zoom-in-75 duration-300"
                  )
                : "bg-muted-foreground/25"
            )}
            style={
              i < filled
                ? {
                    boxShadow:
                      "0 0 6px color-mix(in oklch, var(--primary) 45%, transparent)",
                  }
                : undefined
            }
          />
        ))}
        {completed > 4 && (
          <span className="text-xs font-bold tabular-nums text-primary">
            +{completed - 4}
          </span>
        )}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  sub,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: number;
  unit?: string;
  sub?: React.ReactNode;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <Card className="gap-2.5 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
        <Icon
          className={cn("size-4 shrink-0", iconClassName ?? "text-primary/70")}
          aria-hidden="true"
        />
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums">
        {value}
        {unit && (
          <span className="ml-1 text-sm font-semibold text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
      {sub && <p className="text-xs leading-snug text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function TaskChip({
  todo,
  selected,
  onSelect,
}: {
  todo: Todo;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Focus on task: ${todo.title}`}
      onClick={() => onSelect(todo.id)}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/35 hover:text-foreground"
      )}
    >
      {selected && <Check className="size-3.5 shrink-0" strokeWidth={3} aria-hidden="true" />}
      <span className="max-w-44 truncate">{todo.title}</span>
    </button>
  );
}

// ── Main view ──────────────────────────────────────────────────

export function FocusView() {
  const queryClient = useQueryClient();
  const setView = useUiStore((s) => s.setView);
  const { resolvedTheme } = useTheme();
  const reduceMotion = useReducedMotion();

  const statsQuery = useQuery({
    queryKey: ["focus", "stats"],
    queryFn: focusApi.stats,
  });
  const todosQuery = useQuery({
    queryKey: ["todos", "active"],
    queryFn: () => todosApi.list({ status: "active" }),
  });
  const todos = todosQuery.data ?? [];

  // ── Timer state ──────────────────────────────────────────────
  const [initial] = React.useState(readPersisted);
  const [mode, setMode] = React.useState<Mode>(initial?.mode ?? "focus");
  const [durations, setDurations] = React.useState<Record<Mode, number>>(
    initial?.durations ?? DEFAULT_DURATIONS
  );
  const [running, setRunning] = React.useState(false);
  const [endsAt, setEndsAt] = React.useState<number | null>(null);
  const [pausedRemaining, setPausedRemaining] = React.useState<number>(() => {
    if (!initial) return DEFAULT_DURATIONS.focus * 60_000;
    const full = initial.durations[initial.mode] * 60_000;
    if (initial.running && initial.endsAt !== null) {
      return Math.min(full, Math.max(0, initial.endsAt - Date.now()));
    }
    return Math.min(full, Math.max(0, initial.remainingMs));
  });
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [taskId, setTaskId] = React.useState<string | null>(initial?.taskId ?? null);
  const [label, setLabel] = React.useState<string | null>(initial?.label ?? null);
  const [completedToday, setCompletedToday] = React.useState<number>(
    initial && initial.dayKey === todayKey() ? initial.completedToday : 0
  );
  const [sound, setSound] = React.useState(initial?.sound ?? true);
  const [now, setNow] = React.useState<number>(() => Date.now());

  // Task picker / duration picker UI state
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customValue, setCustomValue] = React.useState("");
  const [durationOpen, setDurationOpen] = React.useState(false);
  const [customMinutes, setCustomMinutes] = React.useState("");

  const completingRef = React.useRef(false);
  const customInputRef = React.useRef<HTMLInputElement>(null);

  // ── Session logging ──────────────────────────────────────────
  const logMutation = useMutation({
    mutationFn: (input: FocusSessionInput) => focusApi.log(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["focus"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err, input) => {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 404 && input.taskId) {
        // The linked task was deleted — save the session with its
        // title as the label instead of losing it.
        const title = todos.find((t) => t.id === input.taskId)?.title;
        focusApi
          .log({ ...input, taskId: null, label: title ?? input.label ?? "Focus session" })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["focus"] });
            queryClient.invalidateQueries({ queryKey: ["stats"] });
          })
          .catch(() => toast.error("Couldn't save your focus session"));
        return;
      }
      toast.error("Couldn't save your focus session");
    },
  });

  const logSession = React.useCallback(
    (
      minutes: number,
      started: number | null,
      ended: number,
      tId: string | null,
      lbl: string | null
    ) => {
      const input: FocusSessionInput = {
        minutes,
        taskId: tId,
        label: lbl,
        endedAt: new Date(ended).toISOString(),
      };
      if (started !== null) input.startedAt = new Date(started).toISOString();
      logMutation.mutate(input);
    },
    [logMutation]
  );

  // ── Derived values ───────────────────────────────────────────
  const totalMs = durations[mode] * 60_000;
  const remainingMs =
    running && endsAt !== null ? Math.max(0, endsAt - now) : pausedRemaining;
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const sessionActive = running || pausedRemaining < totalMs || startedAt !== null;
  const minutesLeft = Math.max(0, Math.ceil(remainingMs / 60_000));
  const selectedTodo = taskId ? todos.find((t) => t.id === taskId) ?? null : null;
  const subject = selectedTodo ? selectedTodo.title : label;
  const stats = statsQuery.data;

  const isDark = resolvedTheme === "dark";
  const ringColor =
    mode === "focus"
      ? "var(--primary)"
      : mode === "short"
        ? isDark
          ? "#fbbf24"
          : "#f59e0b"
        : isDark
          ? "#2dd4bf"
          : "#14b8a6";

  // ── Timer engine ─────────────────────────────────────────────

  /** Natural completion: chime, toast, log, dots, auto-switch to break. */
  const finishNatural = () => {
    const endedAtMs = endsAt ?? Date.now();
    const started = startedAt;
    const tId = taskId;
    const lbl = label;
    const currentMode = mode;
    const currentDurations = durations;
    if (sound) playChime();
    setRunning(false);
    setEndsAt(null);
    setStartedAt(null);
    if (currentMode === "focus") {
      const minutes = Math.max(1, Math.round(totalMs / 60_000));
      const nextCount = completedToday + 1;
      setCompletedToday(nextCount);
      toast.success("Focus session complete — take a break! 🎉");
      logSession(minutes, started, endedAtMs, tId, lbl);
      const next: Mode = nextCount > 0 && nextCount % 4 === 0 ? "long" : "short";
      setMode(next);
      setPausedRemaining(currentDurations[next] * 60_000);
    } else {
      toast("Break's over — ready for another round? ☕");
      setMode("focus");
      setPausedRemaining(currentDurations.focus * 60_000);
    }
    completingRef.current = false;
  };

  // Keep a ref to the latest completion handler so the interval
  // callback never fires a stale closure (e.g. pre-task-selection).
  const finishRef = React.useRef(finishNatural);
  React.useEffect(() => {
    finishRef.current = finishNatural;
  });

  React.useEffect(() => {
    if (!running || endsAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt && !completingRef.current) {
        completingRef.current = true;
        finishRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [running, endsAt]);

  // ── Restore on mount ─────────────────────────────────────────
  React.useEffect(() => {
    if (!initial || !initial.running || initial.endsAt === null) return;
    if (initial.endsAt > Date.now()) {
      // Resume the running session right where it left off.
      setRunning(true);
      setEndsAt(initial.endsAt);
      setStartedAt(
        initial.startedAt ??
          initial.endsAt - initial.durations[initial.mode] * 60_000
      );
      setNow(Date.now());
      return;
    }
    // The session expired while the page was closed — complete it.
    const m = initial.mode;
    const minutes = initial.durations[m];
    const ended = initial.endsAt;
    const baseCount = initial.dayKey === todayKey() ? initial.completedToday : 0;
    if (m === "focus") {
      const nextCount = baseCount + 1;
      setCompletedToday(nextCount);
      toast.success("Focus session complete — take a break! 🎉");
      logSession(minutes, initial.startedAt, ended, initial.taskId, initial.label);
      const next: Mode = nextCount > 0 && nextCount % 4 === 0 ? "long" : "short";
      setMode(next);
      setPausedRemaining(initial.durations[next] * 60_000);
    } else {
      toast("Break's over — ready for another round? ☕");
      setMode("focus");
      setPausedRemaining(initial.durations.focus * 60_000);
    }
    setRunning(false);
    setEndsAt(null);
    setStartedAt(null);
  }, []);

  // ── Persist to localStorage ──────────────────────────────────
  React.useEffect(() => {
    try {
      const data: PersistedFocus = {
        v: 1,
        mode,
        durations,
        running,
        endsAt,
        remainingMs:
          running && endsAt !== null
            ? Math.max(0, endsAt - Date.now())
            : pausedRemaining,
        startedAt,
        taskId,
        label,
        completedToday,
        dayKey: todayKey(),
        sound,
      };
      window.localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage unavailable */
    }
  }, [mode, durations, running, endsAt, pausedRemaining, startedAt, taskId, label, completedToday, sound]);

  // ── Sync session dots with server stats ──────────────────────
  React.useEffect(() => {
    if (statsQuery.data) setCompletedToday(statsQuery.data.todaySessions);
  }, [statsQuery.data]);

  // ── Controls ─────────────────────────────────────────────────

  const toggleTimer = () => {
    if (running) {
      setPausedRemaining(Math.max(0, (endsAt ?? Date.now()) - Date.now()));
      setRunning(false);
    } else {
      const rem = pausedRemaining > 0 ? pausedRemaining : totalMs;
      setEndsAt(Date.now() + rem);
      setStartedAt((s) => s ?? Date.now());
      completingRef.current = false;
      setNow(Date.now());
      setRunning(true);
    }
  };

  const resetTimer = () => {
    setRunning(false);
    setEndsAt(null);
    setStartedAt(null);
    setPausedRemaining(totalMs);
    completingRef.current = false;
  };

  /** Log the in-progress focus session (≥1 min) and return the new count. */
  const endActiveFocus = (endedAtMs: number): number => {
    if (mode !== "focus") return completedToday;
    const rem = running && endsAt !== null ? Math.max(0, endsAt - Date.now()) : pausedRemaining;
    const minutes = Math.floor((totalMs - rem) / 60_000);
    if (minutes < 1) return completedToday;
    const nextCount = completedToday + 1;
    setCompletedToday(nextCount);
    logSession(minutes, startedAt, endedAtMs, taskId, label);
    toast.success(`Logged ${minutes} min of focus — nice work.`);
    return nextCount;
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    if (mode === "focus") endActiveFocus(Date.now());
    setMode(m);
    setRunning(false);
    setEndsAt(null);
    setStartedAt(null);
    setPausedRemaining(durations[m] * 60_000);
    completingRef.current = false;
  };

  const skipSession = () => {
    if (mode === "focus" && !sessionActive) return;
    const count = endActiveFocus(Date.now());
    setRunning(false);
    setEndsAt(null);
    setStartedAt(null);
    completingRef.current = false;
    if (mode === "focus") {
      const next: Mode = count > 0 && count % 4 === 0 ? "long" : "short";
      setMode(next);
      setPausedRemaining(durations[next] * 60_000);
    } else {
      setMode("focus");
      setPausedRemaining(durations.focus * 60_000);
    }
  };

  const applyDuration = (minutes: number) => {
    const m = clampMinutes(minutes, durations[mode]);
    setDurations((d) => ({ ...d, [mode]: m }));
    setRunning(false);
    setEndsAt(null);
    setStartedAt(null);
    setPausedRemaining(m * 60_000);
    completingRef.current = false;
    setDurationOpen(false);
    setCustomMinutes("");
  };

  // ── Task picker ──────────────────────────────────────────────

  const selectTask = (id: string) => {
    setTaskId((cur) => (cur === id ? null : id));
    setLabel(null);
  };

  const clearSubject = () => {
    setTaskId(null);
    setLabel(null);
    setCustomValue("");
  };

  const submitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const v = customValue.trim();
    setLabel(v.length > 0 ? v : null);
    setTaskId(null);
    setCustomOpen(false);
  };

  React.useEffect(() => {
    if (customOpen) customInputRef.current?.focus();
  }, [customOpen]);

  // ── Render ───────────────────────────────────────────────────

  const clock = formatClock(remainingMs);
  const startLabel = running ? "Pause" : sessionActive ? "Resume" : "Start";

  let weekSub: React.ReactNode;
  if (stats) {
    const diff = stats.weekMinutes - stats.lastWeekMinutes;
    if (diff > 0) {
      weekSub = (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
          <ChevronUp className="size-3" aria-hidden="true" />+{diff} min vs last week
        </span>
      );
    } else if (diff < 0) {
      weekSub = (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          <ChevronDown className="size-3" aria-hidden="true" />
          {diff} min vs last week
        </span>
      );
    } else {
      weekSub = <span>Same as last week</span>;
    }
  }

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Focus"
        subtitle="Pomodoro deep-work sessions with built-in breaks"
        actions={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            onClick={() => setSound((s) => !s)}
            aria-label={
              sound ? "Turn off completion chime" : "Turn on completion chime"
            }
            aria-pressed={sound}
            title={sound ? "Chime on" : "Chime off"}
          >
            {sound ? (
              <Volume2 className="size-5" aria-hidden="true" />
            ) : (
              <VolumeX className="size-5" aria-hidden="true" />
            )}
          </Button>
        }
      />

      {/* ── Hero: the timer ─────────────────────────────────── */}
      <FadeIn>
        <Card
          className={cn("relative overflow-hidden rounded-3xl p-5 sm:p-8")}
          style={{ "--focus-ring": ringColor } as React.CSSProperties}
        >
          {/* Decorative gradient blobs */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -right-20 -top-24 size-64 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
            <div className="absolute -bottom-28 -left-20 size-64 rounded-full bg-teal-400/10 blur-3xl dark:bg-teal-500/10" />
            <div className="absolute -bottom-16 right-12 size-44 rounded-full bg-amber-300/10 blur-3xl dark:bg-amber-400/10" />
          </div>

          <div className="relative flex flex-col items-center gap-4 sm:gap-5">
            {/* Mode segmented control */}
            <div
              role="tablist"
              aria-label="Timer mode"
              className="flex w-full max-w-sm items-center gap-1 rounded-full border bg-muted/50 p-1"
            >
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.value}
                  onClick={() => switchMode(m.value)}
                  className={cn(
                    "h-11 flex-1 rounded-full px-2 text-xs font-semibold transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:text-sm",
                    mode === m.value
                      ? MODE_TAB_ACTIVE[m.value]
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span className="whitespace-nowrap">{m.label}</span>
                </button>
              ))}
            </div>

            {/* Duration picker */}
            <Popover open={durationOpen} onOpenChange={setDurationOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed px-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  aria-label={`Change ${MODE_LABEL[mode].toLowerCase()} duration, currently ${durations[mode]} minutes`}
                >
                  <Clock className="size-3.5" aria-hidden="true" />
                  <span className="tabular-nums">{durations[mode]} min</span>
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="center" className="w-64 p-4">
                <p className="text-sm font-semibold">{MODE_LABEL[mode]} duration</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Pick a preset or enter your own.
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2">
                  {DURATION_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyDuration(p)}
                      aria-pressed={durations[mode] === p}
                      className={cn(
                        "flex h-11 items-center justify-center rounded-xl border text-sm font-semibold tabular-nums transition-all active:scale-[0.96]",
                        durations[mode] === p
                          ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-muted"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = Number.parseInt(customMinutes, 10);
                    if (Number.isFinite(v)) applyDuration(v);
                  }}
                  className="mt-3 flex items-center gap-2"
                >
                  <Input
                    type="number"
                    min={1}
                    max={240}
                    inputMode="numeric"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    placeholder="Custom"
                    aria-label="Custom duration in minutes, 1 to 240"
                    className="h-11 flex-1 rounded-xl tabular-nums"
                  />
                  <span className="text-xs font-medium text-muted-foreground">min</span>
                  <Button
                    type="submit"
                    variant="secondary"
                    className="h-11 rounded-xl px-4"
                    disabled={customMinutes.trim().length === 0}
                  >
                    Apply
                  </Button>
                </form>
              </PopoverContent>
            </Popover>

            {/* The ring */}
            <motion.div
              className="relative my-1"
              animate={
                running && !reduceMotion ? { scale: [1, 1.015, 1] } : undefined
              }
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div
                className="relative"
                style={{ width: RING_SIZE, height: RING_SIZE }}
                role="img"
                aria-label={`${MODE_LABEL[mode]} timer, ${clock} remaining`}
              >
                {/* Ambient glow behind the ring — appears (and gently
                    breathes) only while the timer is running. */}
                <div
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute -inset-5 rounded-full blur-2xl transition-opacity duration-700",
                    running ? "glow-pulse opacity-100" : "opacity-0"
                  )}
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in oklch, var(--focus-ring) 26%, transparent) 0%, transparent 68%)",
                  }}
                />
                <svg
                  width={RING_SIZE}
                  height={RING_SIZE}
                  viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                  className="relative -rotate-90"
                >
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    strokeWidth={RING_STROKE}
                    className="stroke-muted"
                  />
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                    style={{
                      stroke: "var(--focus-ring)",
                      filter:
                        "drop-shadow(0 0 12px color-mix(in oklch, var(--focus-ring) 35%, transparent))",
                    }}
                    className="transition-[stroke-dashoffset,stroke] duration-300 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.22em] transition-colors duration-300"
                    style={{ color: "var(--focus-ring)" }}
                  >
                    {MODE_LABEL[mode]}
                  </span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-5xl font-bold tabular-nums tracking-tight sm:text-6xl"
                  >
                    {clock}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {running && endsAt !== null
                      ? `Ends at ${formatTime(new Date(endsAt).toISOString())}`
                      : sessionActive
                        ? "Paused"
                        : `${durations[mode]} min ${mode === "focus" ? "session" : "break"}`}
                  </span>
                  {/* Minute-level announcements for screen readers */}
                  <span className="sr-only" aria-live="polite">
                    {running
                      ? `${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} remaining`
                      : ""}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Selected focus subject */}
            <div className="flex min-h-8 w-full items-center justify-center">
              {subject && (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 py-1 pl-3 pr-1.5 text-xs font-medium text-muted-foreground">
                  <span
                    className="size-1.5 shrink-0 rounded-full transition-colors duration-300"
                    style={{ backgroundColor: "var(--focus-ring)" }}
                    aria-hidden="true"
                  />
                  <span className="truncate">{subject}</span>
                  <button
                    type="button"
                    onClick={clearSubject}
                    aria-label="Clear focus subject"
                    className="relative flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    <span className="absolute -inset-1.5" aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 rounded-full"
                onClick={resetTimer}
                disabled={!sessionActive}
                aria-label="Reset timer"
              >
                <RotateCcw className="size-5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                onClick={toggleTimer}
                className="h-12 min-w-36 rounded-full px-8 text-base font-semibold shadow-md transition-all active:scale-[0.98]"
              >
                {running ? (
                  <Pause className="size-5 fill-current" aria-hidden="true" />
                ) : (
                  <Play className="size-5 fill-current" aria-hidden="true" />
                )}
                {startLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12 rounded-full"
                onClick={skipSession}
                disabled={mode === "focus" && !sessionActive}
                aria-label="Skip to the next session"
              >
                <SkipForward className="size-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Session dots */}
            <SessionDots completed={completedToday} />

            {/* Task picker */}
            <div className="w-full border-t pt-5">
              <p className="mb-3 text-sm font-semibold">
                What are you focusing on?
              </p>
              {customOpen ? (
                <form onSubmit={submitCustom} className="flex gap-2">
                  <Input
                    ref={customInputRef}
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="e.g. Write project proposal"
                    maxLength={80}
                    aria-label="Custom focus label"
                    className="h-11 flex-1 rounded-xl"
                  />
                  <Button type="submit" className="h-11 rounded-xl px-4">
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-11 rounded-xl px-0"
                    aria-label="Cancel custom focus"
                    onClick={() => setCustomOpen(false)}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </form>
              ) : (
                <div className="fade-edges -mx-3 flex gap-2 overflow-x-auto px-3 pb-1.5 no-scrollbar">
                  {todosQuery.isLoading ? (
                    <>
                      <Skeleton className="h-11 w-32 shrink-0 rounded-full" />
                      <Skeleton className="h-11 w-24 shrink-0 rounded-full" />
                      <Skeleton className="h-11 w-28 shrink-0 rounded-full" />
                    </>
                  ) : todos.length === 0 ? (
                    <button
                      type="button"
                      onClick={() => setView("tasks")}
                      className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 text-sm font-semibold text-primary transition-all hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      Create a task first
                    </button>
                  ) : (
                    todos.map((t) => (
                      <TaskChip
                        key={t.id}
                        todo={t}
                        selected={taskId === t.id}
                        onSelect={selectTask}
                      />
                    ))
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setCustomValue(label ?? "");
                      setCustomOpen(true);
                    }}
                    aria-pressed={!taskId && !!label}
                    className={cn(
                      "flex h-11 shrink-0 items-center gap-2 rounded-full border border-dashed px-4 text-sm font-medium transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
                      !taskId && label
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"
                    )}
                  >
                    <PenLine className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="max-w-44 truncate">
                      {!taskId && label ? label : "Custom focus…"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* ── Stats strip ─────────────────────────────────────── */}
      <FadeIn delay={0.06}>
        <section
          aria-label="Focus statistics"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {statsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[118px] rounded-2xl" />
            ))
          ) : statsQuery.isError || !stats ? (
            <div className="col-span-2 sm:col-span-4">
              <EmptyState
                icon={CloudOff}
                title="Couldn't load your focus stats"
                description="Something went wrong while fetching your sessions. Check your connection and try again."
                actionLabel="Try again"
                onAction={() => statsQuery.refetch()}
                className="py-8"
              />
            </div>
          ) : (
            <>
              <StatCard
                label="Today"
                value={stats.todayMinutes}
                unit="min"
                icon={Timer}
                sub="of deep work"
              />
              <StatCard
                label="This week"
                value={stats.weekMinutes}
                unit="min"
                icon={TrendingUp}
                sub={weekSub}
              />
              <StatCard
                label="Sessions today"
                value={stats.todaySessions}
                icon={Flame}
                iconClassName={
                  stats.todaySessions > 0 ? "text-orange-500" : "text-muted-foreground/40"
                }
                sub="focus blocks"
              />
              <StatCard
                label="All-time"
                value={stats.totalSessions}
                icon={ListChecks}
                sub="sessions logged"
              />
            </>
          )}
        </section>
      </FadeIn>

      {/* ── Onboarding ──────────────────────────────────────── */}
      {stats && stats.totalSessions === 0 && (
        <FadeIn delay={0.1}>
          <Card className="rounded-2xl p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Timer className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <CardTitle className="text-base">How it works</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  The classic Pomodoro rhythm — simple, effective, repeatable.
                </p>
              </div>
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, i) => (
                <li
                  key={step.title}
                  className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-4"
                >
                  <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="size-5" aria-hidden="true" />
                    <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {i + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
