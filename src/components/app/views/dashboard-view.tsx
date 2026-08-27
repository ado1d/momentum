"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CloudOff,
  Flame,
  ListTodo,
  Loader2,
  Plus,
  Repeat,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { habitsApi, statsApi, todosApi } from "@/lib/api";
import {
  formatDueLabel,
  formatKeyLabel,
  formatKeyLong,
  friendlyDay,
  greeting,
  isOverdue,
  lastNDays,
  shortDayName,
  todayKey,
} from "@/lib/dates";
import { useUiStore } from "@/lib/store";
import {
  MOODS,
  type DashboardStats,
  type Habit,
  type Priority,
  type Todo,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/shared/empty-state";
import { habitRingStyles } from "@/components/app/shared/badges";
import { ProgressBar, ProgressRing } from "@/components/app/shared/progress";
import { WeekDots } from "@/components/app/shared/week-dots";
import { SectionHeading } from "@/components/app/shared/view-header";
import { cn } from "@/lib/utils";

type TodayStats = DashboardStats["today"];

const priorityDotStyles: Record<Priority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-muted-foreground/40",
};

function ratio(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
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

function SeeAllButton({
  label = "See all",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="h-7 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {label}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="size-10 rounded-full" />
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={CloudOff}
      title="Couldn't load your dashboard"
      description="Something went wrong while fetching your data. Check your connection and try again."
      actionLabel="Try again"
      onAction={onRetry}
      className="mt-8"
    />
  );
}

function DashboardHeader({ score }: { score: number }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-400">
          {greeting()}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {formatKeyLong(todayKey())}
        </p>
      </div>
      <div
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-sm font-bold tabular-nums text-primary shadow-sm"
        title="Your productivity score for today"
      >
        <Zap className="size-4" aria-hidden="true" />
        {score}%
      </div>
    </header>
  );
}

function QuoteCard({ quote }: { quote: { text: string; author: string } }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-400 p-[1.5px] shadow-sm">
      <div className="flex items-start gap-3 rounded-[calc(1rem_-_1.5px)] bg-card p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <blockquote className="text-sm font-medium leading-relaxed text-balance sm:text-base">
            &ldquo;{quote.text}&rdquo;
          </blockquote>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">
            &mdash; {quote.author}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCards({ today }: { today: TodayStats }) {
  return (
    <section
      aria-label="Today at a glance"
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <Card className="items-center justify-center gap-0 rounded-2xl p-4 py-5 text-center">
        <ProgressRing
          value={today.score}
          size={88}
          label={`${today.score}`}
          sublabel="Score"
        />
      </Card>
      <Card className="gap-2.5 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tasks today
          </CardTitle>
          <ListTodo className="size-4 shrink-0 text-emerald-500/80" aria-hidden="true" />
        </div>
        <p className="text-2xl font-bold leading-none tabular-nums">
          {today.todosDone}
          <span className="text-base font-semibold text-muted-foreground/50">
            /{today.todosTotal}
          </span>
        </p>
        <ProgressBar value={ratio(today.todosDone, today.todosTotal)} barClassName="bg-emerald-500" />
      </Card>
      <Card className="gap-2.5 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Habits
          </CardTitle>
          <Repeat className="size-4 shrink-0 text-teal-500/80" aria-hidden="true" />
        </div>
        <p className="text-2xl font-bold leading-none tabular-nums">
          {today.habitsDone}
          <span className="text-base font-semibold text-muted-foreground/50">
            /{today.habitsTotal}
          </span>
        </p>
        <ProgressBar value={ratio(today.habitsDone, today.habitsTotal)} barClassName="bg-teal-500" />
      </Card>
      <Card className="gap-2.5 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Best streak
          </CardTitle>
          <Flame
            className={cn(
              "size-4 shrink-0",
              today.bestStreak > 0
                ? "text-orange-500"
                : "text-muted-foreground/40"
            )}
            aria-hidden="true"
          />
        </div>
        <p className="text-2xl font-bold leading-none tabular-nums">
          {today.bestStreak}
          <span className="ml-1 text-sm font-medium text-muted-foreground">
            day{today.bestStreak === 1 ? "" : "s"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {today.bestStreak > 0 ? "Keep it alive" : "Start one today"}
        </p>
      </Card>
    </section>
  );
}

function WeekCard({ week }: { week: DashboardStats["week"] }) {
  const today = todayKey();
  const avg = Math.round(week.reduce((s, d) => s + d.score, 0) / Math.max(1, week.length));
  return (
    <Card className="gap-3 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold">This week</CardTitle>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span title="Average daily score this week">avg {avg}%</span>
          <span aria-hidden="true">·</span>
          <span>Last 7 days</span>
        </span>
      </div>
      <div>
        <div
          className="relative flex h-24 items-end gap-1.5 sm:gap-2"
          role="img"
          aria-label="Daily scores for the last 7 days"
        >
          {/* average marker line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-primary/30"
            style={{ bottom: `${Math.max(4, avg)}%` }}
          />
          {week.map((d) => {
            const isToday = d.date === today;
            return (
              <div
                key={d.date}
                className="group relative flex h-full flex-1 cursor-default items-end"
                title={`${formatKeyLabel(d.date)} · score ${d.score}% · ${d.todosCompleted} tasks, ${d.habitsCompleted} habits, ${d.routineCompleted} routine`}
              >
                <div
                  className={cn(
                    "w-full rounded-md transition-all duration-500 group-hover:brightness-110",
                    isToday
                      ? "bg-gradient-to-t from-primary to-emerald-400 shadow-sm shadow-primary/30"
                      : d.score > 0
                        ? "bg-primary/30 dark:bg-primary/35"
                        : "bg-muted"
                  )}
                  style={{ height: `${Math.max(4, d.score)}%` }}
                />
                {isToday && (
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 py-px text-[9px] font-bold tabular-nums text-primary-foreground shadow-sm"
                    style={{ bottom: `calc(${Math.max(4, d.score)}% + 6px)` }}
                  >
                    {d.score}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex gap-1.5 sm:gap-2">
          {week.map((d) => (
            <span
              key={d.date}
              className={cn(
                "flex-1 text-center text-[10px] font-semibold uppercase",
                d.date === today ? "text-primary" : "text-muted-foreground/60"
              )}
            >
              {shortDayName(d.date).slice(0, 1)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

function OverdueBanner({
  count,
  onReview,
}: {
  count: number;
  onReview: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3"
    >
      <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm font-medium text-destructive">
        You have {count} overdue {count === 1 ? "task" : "tasks"}
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={onReview}
        className="shrink-0 gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        Review
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function FocusRow({
  todo,
  onToggle,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
}) {
  const overdue = !todo.completed && isOverdue(todo.dueDate);
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.completed}
        aria-label={`Mark "${todo.title}" ${todo.completed ? "incomplete" : "complete"}`}
        onClick={() => onToggle(todo)}
        className={cn(
          "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-90",
          todo.completed
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/10"
        )}
      >
        <Check
          className={cn(
            "size-3.5 transition-all duration-200",
            todo.completed ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
          strokeWidth={3}
          aria-hidden="true"
        />
        <span className="absolute -inset-2" aria-hidden="true" />
      </button>
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          priorityDotStyles[todo.priority] ?? priorityDotStyles.low
        )}
        title={`${todo.priority} priority`}
        aria-hidden="true"
      />
      <p
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium decoration-2 transition-colors duration-300",
          "line-through",
          todo.completed
            ? "text-muted-foreground/70 decoration-muted-foreground/50"
            : "text-foreground decoration-transparent"
        )}
      >
        {todo.title}
      </p>
      {todo.repeat !== "none" && (
        <span
          className="inline-flex shrink-0 items-center text-muted-foreground"
          title={`Repeats ${todo.repeat}`}
        >
          <Repeat className="size-3" aria-hidden="true" />
          <span className="sr-only">Repeats {todo.repeat}</span>
        </span>
      )}
      {todo.dueDate && (
        <span
          className={cn(
            "shrink-0 text-xs font-medium tabular-nums",
            overdue
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
          )}
        >
          {formatDueLabel(todo.dueDate)}
        </span>
      )}
    </div>
  );
}

function HabitChip({
  habit,
  weekDays,
  onToggle,
}: {
  habit: Habit;
  weekDays: string[];
  onToggle: (habit: Habit) => void;
}) {
  const done = habit.doneToday;
  const doneMap: Record<string, boolean> = {};
  for (const log of habit.logs) doneMap[log.date] = true;
  return (
    <button
      type="button"
      onClick={() => onToggle(habit)}
      aria-pressed={done}
      aria-label={`${done ? "Undo" : "Complete"} habit: ${habit.name}`}
      className={cn(
        "flex w-36 shrink-0 flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.97]",
        done
          ? habitRingStyles[habit.color] ?? habitRingStyles.teal
          : "bg-card hover:bg-muted/50"
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="text-lg leading-none" aria-hidden="true">
          {habit.emoji}
        </span>
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30 text-transparent"
          )}
        >
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
      </div>
      <p className="min-h-[2rem] text-xs font-medium leading-snug line-clamp-2">
        {habit.name}
      </p>
      <WeekDots doneMap={doneMap} days={weekDays} />
    </button>
  );
}

function OnboardingCard({
  habitsPending,
  onAddTask,
  onAddHabits,
  onSetGoal,
}: {
  habitsPending: boolean;
  onAddTask: () => void;
  onAddHabits: () => void;
  onSetGoal: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-gradient-to-b from-primary/10 via-card to-card p-6 text-center shadow-card sm:p-8">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
        <Zap className="size-8" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-2xl font-bold tracking-tight">
        Welcome to Momentum 👋
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-balance text-muted-foreground">
        Track tasks, build habits, and grow toward your goals — one small win
        at a time. Add your first task, or let us set you up with a few
        starter habits.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={onAddTask}>
          <Plus className="size-4" aria-hidden="true" />
          Add your first task
        </Button>
        <Button
          variant="outline"
          onClick={onAddHabits}
          disabled={habitsPending}
        >
          {habitsPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Repeat className="size-4" aria-hidden="true" />
          )}
          Add starter habits
        </Button>
        <Button variant="ghost" onClick={onSetGoal}>
          <Target className="size-4" aria-hidden="true" />
          Set a goal
        </Button>
      </div>
    </div>
  );
}

export function DashboardView() {
  const setView = useUiStore((s) => s.setView);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["stats", "dashboard"],
    queryFn: statsApi.dashboard,
  });

  const weekDays = React.useMemo(() => lastNDays(7), []);

  // Toggle a focus todo with an optimistic update so the check feels instant.
  const toggleTodo = useMutation({
    mutationFn: (todo: Todo) =>
      todosApi.update(todo.id, { completed: !todo.completed }),
    onMutate: async (todo) => {
      await queryClient.cancelQueries({ queryKey: ["stats", "dashboard"] });
      const prev = queryClient.getQueryData<DashboardStats>([
        "stats",
        "dashboard",
      ]);
      if (prev) {
        queryClient.setQueryData<DashboardStats>(["stats", "dashboard"], {
          ...prev,
          upcomingTodos: prev.upcomingTodos.map((t) =>
            t.id === todo.id
              ? {
                  ...t,
                  completed: !t.completed,
                  completedAt: !t.completed
                    ? new Date().toISOString()
                    : null,
                }
              : t
          ),
        });
      }
      return { prev };
    },
    onError: (err, _todo, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["stats", "dashboard"], ctx.prev);
      }
      toast.error(
        err instanceof Error ? err.message : "Couldn't update the task"
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  // Toggle a habit for today, optimistically flipping the chip + week dots.
  const toggleHabit = useMutation({
    mutationFn: (habit: Habit) => habitsApi.toggle(habit.id, todayKey()),
    onMutate: async (habit) => {
      await queryClient.cancelQueries({ queryKey: ["stats", "dashboard"] });
      const prev = queryClient.getQueryData<DashboardStats>([
        "stats",
        "dashboard",
      ]);
      const today = todayKey();
      if (prev) {
        queryClient.setQueryData<DashboardStats>(["stats", "dashboard"], {
          ...prev,
          todayHabits: prev.todayHabits.map((h) => {
            if (h.id !== habit.id) return h;
            const done = !h.doneToday;
            const logs = done
              ? [...h.logs, { id: `tmp-${h.id}`, habitId: h.id, date: today }]
              : h.logs.filter((l) => l.date !== today);
            return { ...h, doneToday: done, logs };
          }),
        });
      }
      return { prev };
    },
    onError: (err, _habit, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["stats", "dashboard"], ctx.prev);
      }
      toast.error(
        err instanceof Error ? err.message : "Couldn't toggle the habit"
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  // Onboarding: create three starter habits in one go.
  const addStarterHabits = useMutation({
    mutationFn: async () => {
      await habitsApi.create({
        name: "Drink 8 glasses of water",
        emoji: "💧",
        color: "teal",
        timeOfDay: "anytime",
      });
      await habitsApi.create({
        name: "Read 20 minutes",
        emoji: "📚",
        color: "amber",
        timeOfDay: "evening",
      });
      await habitsApi.create({
        name: "Move your body",
        emoji: "🏃",
        color: "rose",
        timeOfDay: "morning",
      });
    },
    onSuccess: () => {
      toast.success("Starter habits added", {
        description: "Find them under Routine and check them off daily.",
      });
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Couldn't add starter habits"
      ),
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) {
    return <DashboardError onRetry={() => void refetch()} />;
  }

  const { today, week, activeGoals, upcomingTodos, todayHabits, recentJournal, quote } =
    data;
  const isEmpty =
    today.todosTotal === 0 &&
    today.habitsTotal === 0 &&
    activeGoals.length === 0 &&
    today.routineTotal === 0;

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <FadeIn>
          <DashboardHeader score={today.score} />
        </FadeIn>
        <FadeIn delay={0.05}>
          <OnboardingCard
            habitsPending={addStarterHabits.isPending}
            onAddTask={() => setQuickAddOpen(true)}
            onAddHabits={() => addStarterHabits.mutate()}
            onSetGoal={() => setView("goals")}
          />
        </FadeIn>
        <FadeIn delay={0.1}>
          <QuoteCard quote={quote} />
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FadeIn>
        <DashboardHeader score={today.score} />
      </FadeIn>

      <FadeIn delay={0.04}>
        <section aria-label="Quote of the day">
          <QuoteCard quote={quote} />
        </section>
      </FadeIn>

      <FadeIn delay={0.08}>
        <StatCards today={today} />
      </FadeIn>

      <FadeIn delay={0.12}>
        <WeekCard week={week} />
      </FadeIn>

      {today.overdueCount > 0 && (
        <FadeIn delay={0.14}>
          <OverdueBanner
            count={today.overdueCount}
            onReview={() => setView("tasks")}
          />
        </FadeIn>
      )}

      <FadeIn delay={0.16}>
        <section aria-label="Today's focus">
          <SectionHeading
            title="Today's focus"
            action={<SeeAllButton onClick={() => setView("tasks")} />}
          />
          {upcomingTodos.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-balance text-muted-foreground">
              Nothing due in the next week — enjoy the breathing room.
            </p>
          ) : (
            <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-card">
              {upcomingTodos.slice(0, 6).map((todo) => (
                <FocusRow
                  key={todo.id}
                  todo={todo}
                  onToggle={(t) => toggleTodo.mutate(t)}
                />
              ))}
            </div>
          )}
        </section>
      </FadeIn>

      <FadeIn delay={0.2}>
        <section aria-label="Habits today">
          <SectionHeading
            title="Habits today"
            action={<SeeAllButton onClick={() => setView("routine")} />}
          />
          {todayHabits.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-balance text-muted-foreground">
              No habits yet — build momentum with one small daily win.
            </p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 no-scrollbar">
              {todayHabits.map((habit) => (
                <HabitChip
                  key={habit.id}
                  habit={habit}
                  weekDays={weekDays}
                  onToggle={(h) => toggleHabit.mutate(h)}
                />
              ))}
            </div>
          )}
        </section>
      </FadeIn>

      <FadeIn delay={0.24}>
        <section aria-label="Active goals">
          <SectionHeading
            title="Active goals"
            action={<SeeAllButton onClick={() => setView("goals")} />}
          />
          {activeGoals.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-balance text-muted-foreground">
              No active goals — set one to give your days direction.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeGoals.slice(0, 4).map((goal) => {
                const percent = ratio(goal.progress, goal.target);
                return (
                  <button
                    key={goal.id}
                    type="button"
                    onClick={() => setView("goals")}
                    aria-label={`Open goal: ${goal.title}`}
                    className="press rounded-2xl border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-semibold leading-snug line-clamp-1">
                        {goal.title}
                      </p>
                      <Badge
                        variant="outline"
                        className="shrink-0 rounded-full px-2 py-0 text-[10px] font-medium capitalize"
                      >
                        {goal.period}
                      </Badge>
                    </div>
                    <ProgressBar value={percent} className="mt-3" />
                    <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {goal.progress}
                      </span>
                      /{goal.target}
                      {goal.unit ? ` ${goal.unit}` : ""} · {percent}%
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </FadeIn>

      <FadeIn delay={0.28}>
        <section aria-label="Recent journal">
          <SectionHeading
            title="Recent journal"
            action={
              <SeeAllButton
                label="Open diary"
                onClick={() => setView("diary")}
              />
            }
          />
          {recentJournal.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-balance text-muted-foreground">
              No entries yet — tonight is a good night to write.
            </p>
          ) : (
            <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-card">
              {recentJournal.map((entry) => {
                const mood = MOODS.find((m) => m.value === entry.mood);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setView("diary")}
                    aria-label={`Open diary entry from ${friendlyDay(entry.date)}`}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-base"
                      aria-hidden="true"
                    >
                      {mood ? (
                        mood.emoji
                      ) : (
                        <BookOpen className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {entry.title || "Journal entry"}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {friendlyDay(entry.date)}
                        </span>
                      </span>
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {entry.content}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </FadeIn>
    </div>
  );
}
