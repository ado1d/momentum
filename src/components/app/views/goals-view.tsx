"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CircleCheck,
  Ellipsis,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  TriangleAlert,
} from "lucide-react";

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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import { EmptyState } from "@/components/app/shared/empty-state";
import { ViewHeader } from "@/components/app/shared/view-header";
import { ProgressBar } from "@/components/app/shared/progress";
import { goalsApi } from "@/lib/api";
import {
  dateToKey,
  friendlyDay,
  todayKey,
  weekStartKey,
} from "@/lib/dates";
import {
  GOAL_PERIODS,
  type Goal,
  type GoalInput,
  type GoalPeriod,
  type GoalStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: "learning", label: "Learning", emoji: "📚" },
  { value: "fitness", label: "Fitness", emoji: "💪" },
  { value: "career", label: "Career", emoji: "💼" },
  { value: "personal", label: "Personal", emoji: "🌿" },
  { value: "finance", label: "Finance", emoji: "💰" },
  { value: "other", label: "Other", emoji: "✨" },
] as const;

const STATUS_FILTERS: GoalStatus[] = ["active", "completed", "archived"];

const PERIOD_STYLES: Record<GoalPeriod, { badge: string; bar: string }> = {
  daily: {
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  weekly: {
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  monthly: {
    badge: "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    bar: "bg-violet-500",
  },
};

const PERIOD_LABEL: Record<GoalPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function categoryEmojiOf(category: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === category)?.emoji ?? "✨";
}

/** Mirrors the server-side status rules for optimistic updates. */
function applyStatusRules(goal: Goal, patch: GoalPatch): Goal {
  const target = patch.target ?? goal.target;
  const progress =
    patch.progress !== undefined
      ? Math.min(Math.max(patch.progress, 0), target)
      : Math.min(goal.progress, target);
  let status: GoalStatus = goal.status;
  if (progress >= target) status = "completed";
  else if (patch.status !== undefined) status = patch.status as GoalStatus;
  else if (goal.status === "completed") status = "active";
  return { ...goal, ...patch, target, progress, status } as Goal;
}

type GoalPatch = Partial<GoalInput> & { progress?: number; status?: string };

// ── Small shared pieces ──────────────────────────────────────

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We could not load your goals. Try again in a moment.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function StatChip({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div
      className="rounded-2xl border bg-card px-2 py-3 text-center shadow-card"
      title={hint}
    >
      <p className="text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function GoalsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading goals">
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-[4.5rem] rounded-2xl" />
        <Skeleton className="h-[4.5rem] rounded-2xl" />
        <Skeleton className="h-[4.5rem] rounded-2xl" />
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 rounded-2xl" />
      ))}
    </div>
  );
}

// ── Goal card ────────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal;
  today: string;
  changing: boolean;
  onIncrement: (goal: Goal, delta: number) => void;
  onEdit: (goal: Goal) => void;
  onMarkComplete: (goal: Goal) => void;
  onSetStatus: (goal: Goal, status: GoalStatus) => void;
  onDelete: (goal: Goal) => void;
}

function GoalCard({
  goal,
  today,
  changing,
  onIncrement,
  onEdit,
  onMarkComplete,
  onSetStatus,
  onDelete,
}: GoalCardProps) {
  const pct =
    goal.target > 0 ? Math.min(100, Math.round((goal.progress / goal.target) * 100)) : 0;
  const completed = goal.status === "completed";
  const archived = goal.status === "archived";
  const overdue =
    goal.status === "active" && goal.endDate !== null && goal.endDate < today;

  return (
    <Card
      className={cn(
        "press rounded-2xl py-0 shadow-card transition-all duration-300 hover:shadow-md hover:-translate-y-0.5",
        completed && "border-emerald-500/40 bg-emerald-500/[0.05]",
        archived && "opacity-70"
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl text-lg",
              completed ? "bg-emerald-500/15" : "bg-muted"
            )}
            aria-hidden="true"
          >
            {categoryEmojiOf(goal.category)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3
                className={cn(
                  "min-w-0 text-sm font-semibold sm:text-base",
                  goal.progress >= goal.target && "text-emerald-700 dark:text-emerald-300",
                  archived && "text-muted-foreground"
                )}
              >
                {goal.title}
              </h3>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                  PERIOD_STYLES[goal.period].badge
                )}
              >
                {goal.period}
              </Badge>
              {completed && (
                <Badge
                  className={cn(
                    "gap-1 rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide",
                    PERIOD_STYLES[goal.period].badge
                  )}
                >
                  <CircleCheck className="size-3" aria-hidden="true" />
                  Done
                </Badge>
              )}
              {archived && (
                <Badge
                  variant="secondary"
                  className="rounded-full px-2 py-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Archived
                </Badge>
              )}
            </div>
            {goal.description && (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                {goal.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Options for ${goal.title}`}
              >
                <Ellipsis className="size-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => onEdit(goal)}>
                <Pencil aria-hidden="true" /> Edit
              </DropdownMenuItem>
              {!completed && (
                <DropdownMenuItem onSelect={() => onMarkComplete(goal)}>
                  <CircleCheck aria-hidden="true" /> Mark complete
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => onSetStatus(goal, archived ? "active" : "archived")}
              >
                {archived ? (
                  <>
                    <ArchiveRestore aria-hidden="true" /> Unarchive
                  </>
                ) : (
                  <>
                    <Archive aria-hidden="true" /> Archive
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(goal)}>
                <Trash2 aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4">
          <ProgressBar
            value={pct}
            className="h-2.5"
            barClassName={PERIOD_STYLES[goal.period].bar}
          />
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold tabular-nums text-foreground">
                  {goal.progress}
                </span>
                <span className="tabular-nums"> / {goal.target}</span>
                {goal.unit ? ` ${goal.unit}` : ""}
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                <span className="tabular-nums">{pct}%</span>
              </p>
              {goal.endDate && (
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center gap-1",
                    overdue && "font-medium text-destructive"
                  )}
                >
                  <CalendarDays className="size-3.5" aria-hidden="true" />
                  Due {friendlyDay(goal.endDate)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                disabled={changing || goal.progress <= 0}
                onClick={() => onIncrement(goal, -1)}
                aria-label={`Decrease progress for ${goal.title}`}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-full"
                disabled={changing || goal.progress >= goal.target}
                onClick={() => onIncrement(goal, 1)}
                aria-label={`Increase progress for ${goal.title}`}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Goal form dialog ─────────────────────────────────────────

interface GoalFormValues {
  title: string;
  description: string;
  category: string;
  period: GoalPeriod;
  target: string;
  unit: string;
  startDate: string;
  endDate: string;
}

function emptyGoalForm(): GoalFormValues {
  return {
    title: "",
    description: "",
    category: "learning",
    period: "daily",
    target: "10",
    unit: "",
    startDate: todayKey(),
    endDate: "",
  };
}

function goalToForm(goal: Goal): GoalFormValues {
  return {
    title: goal.title,
    description: goal.description ?? "",
    category: goal.category,
    period: goal.period,
    target: String(goal.target),
    unit: goal.unit ?? "",
    startDate: goal.startDate,
    endDate: goal.endDate ?? "",
  };
}

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  submitting: boolean;
  onSubmit: (values: GoalFormValues) => void;
}

function GoalFormDialog({ open, onOpenChange, goal, submitting, onSubmit }: GoalFormDialogProps) {
  const [values, setValues] = React.useState<GoalFormValues>(emptyGoalForm);

  React.useEffect(() => {
    if (open) setValues(goal ? goalToForm(goal) : emptyGoalForm());
  }, [open, goal]);

  const set = <K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.title.trim()) {
      toast.error("Give your goal a title");
      return;
    }
    const target = Number.parseInt(values.target, 10);
    if (!Number.isInteger(target) || target < 1) {
      toast.error("Target must be at least 1");
      return;
    }
    onSubmit({ ...values, title: values.title.trim(), target: String(target) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            {goal
              ? "Adjust the target, dates, or details."
              : "Choose a period and a target you can actually hit."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Read 10 pages daily"
              maxLength={120}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="goal-description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Why does this goal matter to you?"
              rows={2}
              maxLength={400}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={values.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="h-11 w-full rounded-xl" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <div className="grid grid-cols-3 gap-2">
              {GOAL_PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("period", p.value)}
                  aria-pressed={values.period === p.value}
                  className={cn(
                    "flex h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-center transition-all active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    values.period === p.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span
                    className={cn(
                      "text-[10px] leading-tight",
                      values.period === p.value ? "text-primary/80" : "text-muted-foreground/70"
                    )}
                  >
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={values.target}
                onChange={(e) => set("target", e.target.value)}
                className="h-11 rounded-xl tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-unit">
                Unit <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="goal-unit"
                value={values.unit}
                onChange={(e) => set("unit", e.target.value)}
                placeholder="pages, minutes…"
                maxLength={24}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-start">Start date</Label>
              <Input
                id="goal-start"
                type="date"
                value={values.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-end">
                End date <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="goal-end"
                type="date"
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                min={values.startDate || undefined}
                className="h-11 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {goal ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ────────────────────────────────────────────────

type PeriodTab = "all" | GoalPeriod;
type StatusFilter = GoalStatus | "all";

export function GoalsView() {
  const today = todayKey();
  const queryClient = useQueryClient();

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => goalsApi.list({ status: "all" }),
  });
  const goals = goalsQuery.data ?? [];

  const [periodTab, setPeriodTab] = React.useState<PeriodTab>("all");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("active");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | null>(null);
  const [goalToDelete, setGoalToDelete] = React.useState<Goal | null>(null);
  const [resetConfirm, setResetConfirm] = React.useState<GoalPeriod | null>(null);

  const invalidate = (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  // ── Mutations ──

  const incrementGoal = useMutation({
    mutationFn: ({ goal, delta }: { goal: Goal; delta: number }) =>
      goalsApi.increment(goal.id, delta),
    onMutate: async ({ goal, delta }) => {
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const previous = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) =>
        (old ?? []).map((g) =>
          g.id === goal.id
            ? applyStatusRules(g, {
                progress: Math.min(Math.max(g.progress + delta, 0), g.target),
              })
            : g
        )
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["goals"], context.previous);
      toast.error(error.message || "Could not update progress");
    },
    onSuccess: (updated, { goal }) => {
      if (updated.progress >= updated.target && goal.progress < goal.target) {
        toast.success("🎉 Goal completed!");
      }
    },
    onSettled: () => invalidate(["goals", "stats"]),
  });

  const patchGoal = useMutation({
    mutationFn: (vars: { goal: Goal; patch: GoalPatch; successToast?: string }) =>
      goalsApi.update(vars.goal.id, vars.patch),
    onMutate: async ({ goal, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const previous = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) =>
        (old ?? []).map((g) => (g.id === goal.id ? applyStatusRules(g, patch) : g))
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["goals"], context.previous);
      toast.error(error.message || "Could not update goal");
    },
    onSuccess: (_updated, vars) => {
      if (vars.successToast) toast.success(vars.successToast);
    },
    onSettled: () => invalidate(["goals", "stats"]),
  });

  const saveGoal = useMutation({
    mutationFn: (vars: { id?: string; input: GoalInput }) =>
      vars.id ? goalsApi.update(vars.id, vars.input) : goalsApi.create(vars.input),
    onSuccess: (_result, vars) => {
      invalidate(["goals", "stats"]);
      toast.success(vars.id ? "Goal updated" : "Goal created");
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message || "Could not save goal"),
  });

  const removeGoal = useMutation({
    mutationFn: (id: string) => goalsApi.remove(id),
    onSuccess: () => {
      invalidate(["goals", "stats"]);
      setGoalToDelete(null);
      toast.success("Goal deleted");
    },
    onError: (e) => toast.error(e.message || "Could not delete goal"),
  });

  const resetPeriodProgress = useMutation({
    mutationFn: async (period: GoalPeriod) => {
      const targets = goals.filter(
        (g) => g.period === period && g.status !== "archived" && g.progress > 0
      );
      await Promise.all(targets.map((g) => goalsApi.update(g.id, { progress: 0 })));
      return targets.length;
    },
    onMutate: async (period) => {
      await queryClient.cancelQueries({ queryKey: ["goals"] });
      const previous = queryClient.getQueryData<Goal[]>(["goals"]);
      queryClient.setQueryData<Goal[]>(["goals"], (old) =>
        (old ?? []).map((g) =>
          g.period === period && g.status !== "archived"
            ? { ...g, progress: 0, status: "active" }
            : g
        )
      );
      return { previous };
    },
    onError: (error, _period, context) => {
      if (context?.previous) queryClient.setQueryData(["goals"], context.previous);
      toast.error(error.message || "Could not reset progress");
    },
    onSuccess: (count, period) => {
      invalidate(["goals", "stats"]);
      toast.success(
        count === 0
          ? `No ${PERIOD_LABEL[period].toLowerCase()} goals to reset`
          : `${PERIOD_LABEL[period]} progress reset — ${count} goal${count === 1 ? "" : "s"} back to zero`
      );
    },
  });

  const addSampleGoals = useMutation({
    mutationFn: async () => {
      await goalsApi.create({
        title: "Read 10 pages daily",
        category: "learning",
        period: "daily",
        target: 10,
        unit: "pages",
        startDate: todayKey(),
      });
      await goalsApi.create({
        title: "Complete 1 online course module",
        category: "learning",
        period: "weekly",
        target: 3,
        unit: "modules",
        startDate: todayKey(),
      });
    },
    onSuccess: () => {
      invalidate(["goals", "stats"]);
      toast.success("Sample goals added 🎯");
    },
    onError: (e) => toast.error(e.message || "Could not add sample goals"),
  });

  // ── Derived data ──

  const activeCount = goals.filter((g) => g.status === "active").length;
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const weekStart = weekStartKey(today);
  const completedThisWeek = goals.filter(
    (g) => g.status === "completed" && dateToKey(new Date(g.updatedAt)) >= weekStart
  ).length;

  const filtered = goals.filter(
    (g) =>
      (periodTab === "all" || g.period === periodTab) &&
      (statusFilter === "all" || g.status === statusFilter)
  );

  const openNewGoal = () => {
    setEditingGoal(null);
    setDialogOpen(true);
  };
  const openEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setDialogOpen(true);
  };

  const submitGoal = (values: GoalFormValues) => {
    saveGoal.mutate({
      id: editingGoal?.id,
      input: {
        title: values.title,
        description: values.description.trim() || null,
        category: values.category,
        period: values.period,
        target: Number.parseInt(values.target, 10),
        unit: values.unit.trim() || null,
        startDate: values.startDate || todayKey(),
        endDate: values.endDate || null,
      },
    });
  };

  const changingId =
    incrementGoal.isPending ? incrementGoal.variables?.goal.id : undefined;

  return (
    <div>
      <ViewHeader
        title="Goals"
        subtitle="Daily learning goals, weekly targets, monthly ambitions"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 rounded-xl"
                  aria-label="Reset progress"
                >
                  <RotateCcw aria-hidden="true" />
                  Reset
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Set progress back to zero</DropdownMenuLabel>
                {GOAL_PERIODS.map((p) => (
                  <DropdownMenuItem key={p.value} onSelect={() => setResetConfirm(p.value)}>
                    <RotateCcw aria-hidden="true" /> Reset {p.label.toLowerCase()} progress
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" className="h-11 rounded-xl" onClick={openNewGoal}>
              <Plus aria-hidden="true" />
              New goal
            </Button>
          </>
        }
      />

      {goalsQuery.isLoading ? (
        <GoalsSkeleton />
      ) : goalsQuery.isError ? (
        <QueryError onRetry={() => goalsQuery.refetch()} />
      ) : (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatChip label="Active" value={activeCount} hint="Goals currently in progress" />
            <StatChip label="Completed" value={completedCount} hint="Completed all time" />
            <StatChip
              label="This week"
              value={completedThisWeek}
              hint="Completed this calendar week"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={periodTab}
              onValueChange={(v) => setPeriodTab(v as PeriodTab)}
            >
              <TabsList className="h-11 rounded-xl p-1">
                <TabsTrigger value="all" className="px-3 text-sm">
                  All
                </TabsTrigger>
                {GOAL_PERIODS.map((p) => (
                  <TabsTrigger key={p.value} value={p.value} className="px-3 text-sm">
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div
              className="flex items-center gap-1.5"
              role="group"
              aria-label="Filter goals by status"
            >
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setStatusFilter((current) => (current === status ? "all" : status))
                  }
                  aria-pressed={statusFilter === status}
                  className={cn(
                    "h-11 rounded-full border px-3.5 text-xs font-medium capitalize transition-all active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    statusFilter === status
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Goal list */}
          {goals.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No goals yet"
              description="Set a daily, weekly, or monthly target and watch the progress add up."
              actionLabel="Set a goal"
              onAction={openNewGoal}
              secondaryLabel={addSampleGoals.isPending ? "Adding…" : "Add sample learning goals"}
              onSecondary={() => addSampleGoals.mutate()}
            />
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 px-6 py-10 text-center">
              <p className="text-sm font-medium">No goals match these filters</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a different period or status.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setPeriodTab("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="stagger-list space-y-3">
              {filtered.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  today={today}
                  changing={changingId === goal.id}
                  onIncrement={(g, delta) => incrementGoal.mutate({ goal: g, delta })}
                  onEdit={openEditGoal}
                  onMarkComplete={(g) =>
                    patchGoal.mutate({
                      goal: g,
                      patch: { progress: g.target },
                      successToast: "🎉 Goal completed!",
                    })
                  }
                  onSetStatus={(g, status) =>
                    patchGoal.mutate({
                      goal: g,
                      patch: { status },
                      successToast: status === "archived" ? "Goal archived" : "Goal restored",
                    })
                  }
                  onDelete={setGoalToDelete}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Dialogs ── */}
      <GoalFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        goal={editingGoal}
        submitting={saveGoal.isPending}
        onSubmit={submitGoal}
      />

      <AlertDialog
        open={resetConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setResetConfirm(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reset {resetConfirm ? PERIOD_LABEL[resetConfirm].toLowerCase() : ""} progress?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Progress for every {resetConfirm ? PERIOD_LABEL[resetConfirm].toLowerCase() : ""}{" "}
              goal goes back to zero, including completed ones. Nothing is deleted and the
              targets stay the same.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetConfirm && resetPeriodProgress.mutate(resetConfirm)}
            >
              Reset progress
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={goalToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setGoalToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete goal?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{goalToDelete?.title}&rdquo; and its progress will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => goalToDelete && removeGoal.mutate(goalToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
