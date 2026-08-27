"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Clock,
  Ellipsis,
  Flame,
  Moon,
  Pencil,
  Plus,
  Repeat,
  Sun,
  Sunrise,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmptyState } from "@/components/app/shared/empty-state";
import { ViewHeader } from "@/components/app/shared/view-header";
import { ProgressBar, ProgressRing } from "@/components/app/shared/progress";
import { habitDotStyles, habitRingStyles } from "@/components/app/shared/badges";
import { WeekDots } from "@/components/app/shared/week-dots";
import { habitsApi, routineApi } from "@/lib/api";
import { formatKeyLabel, lastNDays, todayKey, weekdayOfKey } from "@/lib/dates";
import {
  HABIT_COLORS,
  TIME_OF_DAY,
  type Habit,
  type HabitColor,
  type HabitInput,
  type RoutineTask,
  type RoutineTaskInput,
  type TimeOfDay,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────

const HABIT_EMOJIS = [
  "💧", "📚", "🏃", "🧘", "🍎", "✍️",
  "💻", "🎧", "🌱", "🛏️", "🦷", "🚶",
  "💪", "🧠", "☕", "🎯", "📖", "🧹",
  "💰", "📵", "🎸", "🧺", "⏰", "🥗",
];

/** Letters for ISO weekdays 1..7 (Mon..Sun) */
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;

const TIME_ORDER: TimeOfDay[] = ["morning", "afternoon", "evening", "anytime"];

/** Section headers use tinted icon chips (no indigo/blue hues). */
const SECTION_META: Record<
  TimeOfDay,
  { label: string; icon: LucideIcon; tint: string }
> = {
  morning: {
    label: "Morning",
    icon: Sunrise,
    tint: "bg-amber-300/20 text-amber-600 dark:text-amber-300",
  },
  afternoon: {
    label: "Afternoon",
    icon: Sun,
    tint: "bg-orange-400/15 text-orange-600 dark:text-orange-300",
  },
  evening: {
    label: "Evening",
    icon: Moon,
    tint: "bg-teal-400/15 text-teal-600 dark:text-teal-300",
  },
  anytime: {
    label: "Anytime",
    icon: Clock,
    tint: "bg-primary/10 text-primary",
  },
};

const STARTER_HABITS: HabitInput[] = [
  { name: "Drink 8 glasses of water", emoji: "💧", color: "teal", timeOfDay: "anytime" },
  { name: "Read 20 minutes", emoji: "📚", color: "amber", timeOfDay: "evening" },
  { name: "Move your body", emoji: "🏃", color: "rose", timeOfDay: "morning" },
];

function parseDays(csv: string): number[] {
  return csv
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

// ── Small shared pieces ──────────────────────────────────────

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We could not load your routine. Try again in a moment.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-24 rounded-2xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[5.25rem] rounded-2xl" />
      ))}
    </div>
  );
}

// ── Habits tab ───────────────────────────────────────────────

function TodayBanner({ habits }: { habits: Habit[] }) {
  const total = habits.length;
  const done = habits.filter((h) => h.doneToday).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;
  const remaining = total - done;

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-card">
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <ProgressRing
          value={pct}
          size={64}
          strokeWidth={7}
          label={String(done)}
          sublabel={`of ${total}`}
          className="shrink-0 glow-ring"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold sm:text-base">
            <span className="tabular-nums">{done}</span> of{" "}
            <span className="tabular-nums">{total}</span> habits done today
          </p>
          <ProgressBar value={pct} className="mt-2 h-2.5" />
          <p className="mt-2 text-xs text-muted-foreground">
            {allDone ? (
              <span className="gradient-text text-sm font-semibold">
                Perfect day! 🎉
              </span>
            ) : remaining === 1 ? (
              "Just one more — you are almost there."
            ) : (
              `${remaining} to go. Keep the momentum!`
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface HabitCardProps {
  habit: Habit;
  today: string;
  toggling: boolean;
  onToggle: (habit: Habit) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

function HabitCard({ habit, today, toggling, onToggle, onEdit, onDelete }: HabitCardProps) {
  const doneMap: Record<string, boolean> = {};
  for (const log of habit.logs) doneMap[log.date] = true;
  const last7 = lastNDays(7, today);

  return (
    <Card
      className={cn(
        "rounded-2xl py-0 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 press",
        habit.doneToday ? "border-primary/30 bg-primary/[0.03]" : "shadow-card"
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-lg",
            habitRingStyles[habit.color]
          )}
          aria-hidden="true"
        >
          {habit.emoji}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">{habit.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {habit.streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                🔥 {habit.streak} day streak
              </span>
            )}
            {habit.reminderTime && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                <Clock className="size-3" aria-hidden="true" />
                {habit.reminderTime}
              </span>
            )}
          </div>
          <WeekDots days={last7} doneMap={doneMap} className="mt-2.5" />
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Options for ${habit.name}`}
              >
                <Ellipsis className="size-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onEdit(habit)}>
                <Pencil aria-hidden="true" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(habit)}>
                <Trash2 aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => onToggle(habit)}
            disabled={toggling}
            aria-pressed={habit.doneToday}
            aria-label={
              habit.doneToday ? `Undo ${habit.name} for today` : `Mark ${habit.name} done today`
            }
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              habit.doneToday
                ? cn(
                    habitDotStyles[habit.color],
                    "check-pulse border-transparent text-white shadow-sm"
                  )
                : "border-muted-foreground/25 text-transparent hover:border-muted-foreground/50 hover:bg-muted/50"
            )}
          >
            {habit.doneToday && (
              <Check key="done" className="size-5 animate-in zoom-in-75 duration-200" aria-hidden="true" />
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Habit form dialog ────────────────────────────────────────

interface HabitFormValues {
  name: string;
  emoji: string;
  color: HabitColor;
  timeOfDay: TimeOfDay;
  reminderTime: string;
}

const EMPTY_HABIT: HabitFormValues = {
  name: "",
  emoji: "💧",
  color: "teal",
  timeOfDay: "anytime",
  reminderTime: "",
};

interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  submitting: boolean;
  onSubmit: (values: HabitFormValues) => void;
}

function HabitFormDialog({ open, onOpenChange, habit, submitting, onSubmit }: HabitFormDialogProps) {
  const [values, setValues] = React.useState<HabitFormValues>(EMPTY_HABIT);

  React.useEffect(() => {
    if (open) {
      setValues(
        habit
          ? {
              name: habit.name,
              emoji: habit.emoji,
              color: habit.color,
              timeOfDay: habit.timeOfDay,
              reminderTime: habit.reminderTime ?? "",
            }
          : EMPTY_HABIT
      );
    }
  }, [open, habit]);

  const set = <K extends keyof HabitFormValues>(key: K, value: HabitFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Give your habit a name");
      return;
    }
    onSubmit({
      ...values,
      name: values.name.trim(),
      emoji: values.emoji.trim() || "✨",
      reminderTime: values.reminderTime.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{habit ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            {habit
              ? "Update the details of this habit."
              : "Pick something small enough to do every day."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Drink more water"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {HABIT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => set("emoji", emoji)}
                  aria-label={`Icon ${emoji}`}
                  aria-pressed={values.emoji === emoji}
                  className={cn(
                    "flex h-11 items-center justify-center rounded-xl border text-lg transition-all active:scale-90",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    values.emoji === emoji
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-transparent bg-muted/50 hover:bg-muted"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2.5">
              {HABIT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => set("color", color)}
                  aria-label={`Color ${color}`}
                  aria-pressed={values.color === color}
                  className={cn(
                    "size-11 rounded-full transition-all active:scale-90",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    habitDotStyles[color],
                    values.color === color
                      ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                      : "opacity-70 hover:opacity-100"
                  )}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Time of day</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TIME_OF_DAY.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => set("timeOfDay", option.value)}
                  aria-pressed={values.timeOfDay === option.value}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl border text-xs font-medium transition-all active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    values.timeOfDay === option.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-base leading-none" aria-hidden="true">
                    {option.emoji}
                  </span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="habit-reminder">
              Reminder time{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="habit-reminder"
              type="time"
              value={values.reminderTime}
              onChange={(e) => set("reminderTime", e.target.value)}
            />
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {habit ? "Save changes" : "Create habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Schedule tab ─────────────────────────────────────────────

interface TaskRowProps {
  task: RoutineTask;
  toggling: boolean;
  onToggle: (task: RoutineTask) => void;
  onEdit: (task: RoutineTask) => void;
  onDelete: (task: RoutineTask) => void;
}

function RoutineTaskRow({ task, toggling, onToggle, onEdit, onDelete }: TaskRowProps) {
  const days = parseDays(task.days);

  return (
    <li className="flex items-center gap-3 rounded-xl py-1 transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={() => onToggle(task)}
        disabled={toggling}
        aria-pressed={task.doneToday}
        aria-label={
          task.doneToday ? `Undo ${task.name} for today` : `Mark ${task.name} done today`
        }
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border-2 transition-all duration-200 active:scale-90",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          task.doneToday
            ? "check-pulse border-transparent bg-primary text-primary-foreground shadow-sm"
            : "border-muted-foreground/25 text-transparent hover:border-muted-foreground/50 hover:bg-muted/50"
        )}
      >
        {task.doneToday && (
          <Check key="done" className="size-5 animate-in zoom-in-75 duration-200" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-base leading-none" aria-hidden="true">
            {task.emoji}
          </span>
          <p
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              task.doneToday && "text-muted-foreground line-through decoration-muted-foreground/40"
            )}
          >
            {task.name}
          </p>
          {task.streak > 1 && (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400"
              title={`${task.streak} day streak`}
            >
              <Flame className="size-3.5" aria-hidden="true" />
              {task.streak}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {task.time && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <Clock className="size-3" aria-hidden="true" />
              {task.time}
            </span>
          )}
          <div className="flex items-center gap-0.5" aria-hidden="true">
            {WEEKDAY_LETTERS.map((letter, i) => (
              <span
                key={`${letter}-${i}`}
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[10px] font-semibold",
                  days.includes(i + 1)
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground/30"
                )}
              >
                {letter}
              </span>
            ))}
          </div>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label={`Options for ${task.name}`}
          >
            <Ellipsis className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => onEdit(task)}>
            <Pencil aria-hidden="true" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task)}>
            <Trash2 aria-hidden="true" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

// ── Routine task form dialog ─────────────────────────────────

interface TaskFormValues {
  name: string;
  emoji: string;
  section: TimeOfDay;
  time: string;
  days: number[];
}

const EMPTY_TASK: TaskFormValues = {
  name: "",
  emoji: "🌅",
  section: "morning",
  time: "",
  days: [1, 2, 3, 4, 5, 6, 7],
};

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: RoutineTask | null;
  submitting: boolean;
  onSubmit: (values: TaskFormValues) => void;
}

function TaskFormDialog({ open, onOpenChange, task, submitting, onSubmit }: TaskFormDialogProps) {
  const [values, setValues] = React.useState<TaskFormValues>(EMPTY_TASK);

  React.useEffect(() => {
    if (open) {
      setValues(
        task
          ? {
              name: task.name,
              emoji: task.emoji,
              section: task.section,
              time: task.time ?? "",
              days: parseDays(task.days),
            }
          : EMPTY_TASK
      );
    }
  }, [open, task]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: number) =>
    setValues((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day].sort((a, b) => a - b),
    }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) {
      toast.error("Give this block a name");
      return;
    }
    if (values.days.length === 0) {
      toast.error("Pick at least one day");
      return;
    }
    onSubmit({
      ...values,
      name: values.name.trim(),
      emoji: values.emoji.trim() || "🌅",
      time: values.time.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit routine block" : "New routine block"}</DialogTitle>
          <DialogDescription>
            A block repeats on the weekdays you choose.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Morning workout"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-emoji">Emoji</Label>
            <div className="flex items-center gap-2">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xl"
                aria-hidden="true"
              >
                {values.emoji || "?"}
              </span>
              <Input
                id="task-emoji"
                value={values.emoji}
                onChange={(e) => set("emoji", e.target.value)}
                placeholder="🌅"
                maxLength={8}
                className="max-w-32"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select value={values.section} onValueChange={(v) => set("section", v as TimeOfDay)}>
                <SelectTrigger className="h-11 w-full rounded-xl" aria-label="Section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OF_DAY.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.emoji} {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-time">
                Time <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="task-time"
                type="time"
                value={values.time}
                onChange={(e) => set("time", e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Repeats on</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LETTERS.map((letter, i) => {
                const day = i + 1;
                const active = values.days.includes(day);
                return (
                  <button
                    key={`${letter}-${i}`}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={active}
                    aria-label={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i]}
                    className={cn(
                      "size-11 rounded-xl border text-sm font-semibold transition-all active:scale-90",
                      "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                      active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {values.days.length === 7
                ? "Every day"
                : values.days.length === 0
                  ? "Pick at least one day"
                  : `${values.days.length} day${values.days.length === 1 ? "" : "s"} a week`}
            </p>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {task ? "Save changes" : "Add block"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ────────────────────────────────────────────────

type RoutineTab = "habits" | "schedule";

export function RoutineView() {
  const today = todayKey();
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<RoutineTab>("habits");

  const habitsQuery = useQuery({ queryKey: ["habits"], queryFn: habitsApi.list });
  const routineQuery = useQuery({ queryKey: ["routine"], queryFn: routineApi.list });

  const habits = habitsQuery.data ?? [];
  const tasks = routineQuery.data ?? [];

  const [habitDialogOpen, setHabitDialogOpen] = React.useState(false);
  const [editingHabit, setEditingHabit] = React.useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = React.useState<Habit | null>(null);

  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<RoutineTask | null>(null);
  const [taskToDelete, setTaskToDelete] = React.useState<RoutineTask | null>(null);

  const invalidate = (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const openNewHabit = () => {
    setEditingHabit(null);
    setHabitDialogOpen(true);
  };
  const openEditHabit = (habit: Habit) => {
    setEditingHabit(habit);
    setHabitDialogOpen(true);
  };
  const openNewTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };
  const openEditTask = (task: RoutineTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  // ── Mutations: habits ──

  const toggleHabit = useMutation({
    mutationFn: (habit: Habit) => habitsApi.toggle(habit.id, today),
    onMutate: async (habit) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const previous = queryClient.getQueryData<Habit[]>(["habits"]);
      queryClient.setQueryData<Habit[]>(["habits"], (old) =>
        (old ?? []).map((h) =>
          h.id === habit.id
            ? {
                ...h,
                doneToday: !habit.doneToday,
                streak: Math.max(0, h.streak + (habit.doneToday ? -1 : 1)),
                logs: habit.doneToday
                  ? h.logs.filter((l) => l.date !== today)
                  : [...h.logs, { id: `optimistic-${today}`, habitId: h.id, date: today }],
              }
            : h
        )
      );
      return { previous };
    },
    onError: (error, _habit, context) => {
      if (context?.previous) queryClient.setQueryData(["habits"], context.previous);
      toast.error(error.message || "Could not update habit");
    },
    onSuccess: (result, habit) => {
      const streak = result.streak ?? 0;
      if (result.done && streak > habit.streak) {
        toast.success(`🔥 ${streak} day streak!`);
      }
    },
    onSettled: () => invalidate(["habits", "stats"]),
  });

  const saveHabit = useMutation({
    mutationFn: (input: HabitInput & { id?: string }) =>
      input.id ? habitsApi.update(input.id, input) : habitsApi.create(input),
    onSuccess: (_result, input) => {
      invalidate(["habits", "stats"]);
      toast.success(input.id ? "Habit updated" : "Habit created");
      setHabitDialogOpen(false);
    },
    onError: (e) => toast.error(e.message || "Could not save habit"),
  });

  const removeHabit = useMutation({
    mutationFn: (id: string) => habitsApi.remove(id),
    onSuccess: () => {
      invalidate(["habits", "stats"]);
      setHabitToDelete(null);
      toast.success("Habit deleted");
    },
    onError: (e) => toast.error(e.message || "Could not delete habit"),
  });

  const addStarterHabits = useMutation({
    mutationFn: async () => {
      for (const starter of STARTER_HABITS) await habitsApi.create(starter);
    },
    onSuccess: () => {
      invalidate(["habits", "stats"]);
      toast.success("3 starter habits added 🌱");
    },
    onError: (e) => toast.error(e.message || "Could not add starter habits"),
  });

  // ── Mutations: routine tasks ──

  const toggleTask = useMutation({
    mutationFn: (task: RoutineTask) => routineApi.toggle(task.id, today),
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ["routine"] });
      const previous = queryClient.getQueryData<RoutineTask[]>(["routine"]);
      queryClient.setQueryData<RoutineTask[]>(["routine"], (old) =>
        (old ?? []).map((t) =>
          t.id === task.id
            ? {
                ...t,
                doneToday: !task.doneToday,
                streak: Math.max(0, t.streak + (task.doneToday ? -1 : 1)),
              }
            : t
        )
      );
      return { previous };
    },
    onError: (error, _task, context) => {
      if (context?.previous) queryClient.setQueryData(["routine"], context.previous);
      toast.error(error.message || "Could not update block");
    },
    onSettled: () => invalidate(["routine", "stats"]),
  });

  const saveTask = useMutation({
    mutationFn: (input: RoutineTaskInput & { id?: string }) =>
      input.id ? routineApi.update(input.id, input) : routineApi.create(input),
    onSuccess: (_result, input) => {
      invalidate(["routine", "stats"]);
      toast.success(input.id ? "Routine block updated" : "Routine block added");
      setTaskDialogOpen(false);
    },
    onError: (e) => toast.error(e.message || "Could not save block"),
  });

  const removeTask = useMutation({
    mutationFn: (id: string) => routineApi.remove(id),
    onSuccess: () => {
      invalidate(["routine", "stats"]);
      setTaskToDelete(null);
      toast.success("Routine block deleted");
    },
    onError: (e) => toast.error(e.message || "Could not delete block"),
  });

  // ── Derived data ──

  const isoWeekday = weekdayOfKey(today);
  const scheduledTasks = tasks.filter((t) => parseDays(t.days).includes(isoWeekday));
  const hiddenCount = tasks.length - scheduledTasks.length;

  const submitHabit = (values: HabitFormValues) => {
    saveHabit.mutate({
      id: editingHabit?.id,
      name: values.name,
      emoji: values.emoji,
      color: values.color,
      timeOfDay: values.timeOfDay,
      reminderTime: values.reminderTime || null,
    });
  };

  const submitTask = (values: TaskFormValues) => {
    saveTask.mutate({
      id: editingTask?.id,
      name: values.name,
      emoji: values.emoji,
      section: values.section,
      time: values.time || null,
      days: values.days.join(","),
    });
  };

  const openAddForTab = () => (tab === "habits" ? openNewHabit() : openNewTask());

  return (
    <div>
      <ViewHeader
        title="Daily Routine"
        subtitle="Build consistency, one day at a time"
        actions={
          <Button size="sm" className="h-11 rounded-xl" onClick={openAddForTab}>
            <Plus aria-hidden="true" />
            {tab === "habits" ? "New habit" : "New block"}
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as RoutineTab)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-11 rounded-xl p-1">
            <TabsTrigger value="habits" className="px-4 text-sm">
              Habits
            </TabsTrigger>
            <TabsTrigger value="schedule" className="px-4 text-sm">
              Schedule
            </TabsTrigger>
          </TabsList>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatKeyLabel(today)}
          </span>
        </div>

        {/* ── Habits tab ── */}
        <TabsContent value="habits" className="space-y-5">
          {habitsQuery.isLoading ? (
            <ListSkeleton />
          ) : habitsQuery.isError ? (
            <QueryError onRetry={() => habitsQuery.refetch()} />
          ) : habits.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No habits yet"
              description="Small daily actions compound into big results. Start with one habit you can keep."
              actionLabel="Create your first habit"
              onAction={openNewHabit}
              secondaryLabel={
                addStarterHabits.isPending ? "Adding…" : "Add starter habits"
              }
              onSecondary={() => addStarterHabits.mutate()}
            />
          ) : (
            <>
              <TodayBanner habits={habits} />
              {TIME_ORDER.map((group) => {
                const groupHabits = habits.filter((h) => h.timeOfDay === group);
                if (groupHabits.length === 0) return null;
                const GroupIcon = SECTION_META[group].icon;
                return (
                  <section key={group} aria-label={SECTION_META[group].label}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-lg",
                          SECTION_META[group].tint
                        )}
                        aria-hidden="true"
                      >
                        <GroupIcon className="size-3.5" />
                      </span>
                      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {SECTION_META[group].label}
                      </h2>
                      <span className="text-xs tabular-nums text-muted-foreground/60">
                        {groupHabits.length}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-px flex-1 bg-gradient-to-r from-border to-transparent"
                      />
                    </div>
                    <ul className="stagger-list space-y-3">
                      {groupHabits.map((habit) => (
                        <HabitCard
                          key={habit.id}
                          habit={habit}
                          today={today}
                          toggling={
                            toggleHabit.isPending && toggleHabit.variables?.id === habit.id
                          }
                          onToggle={(h) => toggleHabit.mutate(h)}
                          onEdit={openEditHabit}
                          onDelete={setHabitToDelete}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </>
          )}
        </TabsContent>

        {/* ── Schedule tab ── */}
        <TabsContent value="schedule" className="space-y-4">
          {routineQuery.isLoading ? (
            <ListSkeleton rows={2} />
          ) : routineQuery.isError ? (
            <QueryError onRetry={() => routineQuery.refetch()} />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={Sunrise}
              title="Design your ideal day"
              description="Add routine blocks for the parts of your day you want to make automatic."
              actionLabel="Add a routine block"
              onAction={openNewTask}
            />
          ) : (
            <>
              {TIME_ORDER.map((section) => {
                const sectionTasks = scheduledTasks.filter((t) => t.section === section);
                if (sectionTasks.length === 0) return null;
                const done = sectionTasks.filter((t) => t.doneToday).length;
                const SectionIcon = SECTION_META[section].icon;
                return (
                  <Card key={section} className="rounded-2xl shadow-card">
                    <CardContent className="p-4 sm:p-5">
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-lg",
                            SECTION_META[section].tint
                          )}
                          aria-hidden="true"
                        >
                          <SectionIcon className="size-4" />
                        </span>
                        <h3 className="text-sm font-semibold">
                          {SECTION_META[section].label}
                        </h3>
                        <span
                          aria-hidden="true"
                          className="h-px min-w-4 flex-1 bg-gradient-to-r from-border to-transparent"
                        />
                        <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                          {done}/{sectionTasks.length} done
                        </span>
                      </div>
                      <ProgressBar
                        value={sectionTasks.length ? (done / sectionTasks.length) * 100 : 0}
                        className="mb-3 h-1.5"
                      />
                      <ul className="space-y-1">
                        {sectionTasks.map((task) => (
                          <RoutineTaskRow
                            key={task.id}
                            task={task}
                            toggling={
                              toggleTask.isPending && toggleTask.variables?.id === task.id
                            }
                            onToggle={(t) => toggleTask.mutate(t)}
                            onEdit={openEditTask}
                            onDelete={setTaskToDelete}
                          />
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}

              {scheduledTasks.length === 0 && (
                <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-10 text-center">
                  <p className="text-sm font-medium">Nothing scheduled today</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enjoy the rest — or add a block that fits today.
                  </p>
                </div>
              )}

              {hiddenCount > 0 && (
                <p className="px-1 text-center text-xs text-muted-foreground/70">
                  + {hiddenCount} block{hiddenCount === 1 ? "" : "s"} not scheduled today
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ── */}
      <HabitFormDialog
        open={habitDialogOpen}
        onOpenChange={setHabitDialogOpen}
        habit={editingHabit}
        submitting={saveHabit.isPending}
        onSubmit={submitHabit}
      />

      <TaskFormDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        submitting={saveTask.isPending}
        onSubmit={submitTask}
      />

      <AlertDialog
        open={habitToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setHabitToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete habit?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{habitToDelete?.name}&rdquo; and its full history will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => habitToDelete && removeHabit.mutate(habitToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={taskToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setTaskToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete routine block?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{taskToDelete?.name}&rdquo; will be removed from your schedule. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => taskToDelete && removeTask.mutate(taskToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
