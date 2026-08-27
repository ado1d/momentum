"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CloudOff,
  FileText,
  GripVertical,
  ListChecks,
  ListTodo,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { subtasksApi, todosApi } from "@/lib/api";
import { arrayMove, useDragList, type DragItemState } from "@/lib/use-drag-list";
import {
  addDaysToKey,
  dateToKey,
  formatDueLabel,
  hasTime,
  isOverdue,
  todayKey,
} from "@/lib/dates";
import {
  PRIORITIES,
  REPEAT_OPTIONS,
  TODO_CATEGORIES,
  type Priority,
  type RepeatKind,
  type Subtask,
  type Todo,
  type TodoInput,
} from "@/lib/types";
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
import { Button } from "@/components/ui/button";
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
import {
  CategoryBadge,
  PriorityBadge,
  RepeatBadge,
  repeatOptionLabel,
} from "@/components/app/shared/badges";
import { EmptyState } from "@/components/app/shared/empty-state";
import { ViewHeader } from "@/components/app/shared/view-header";
import { cn } from "@/lib/utils";

type TabValue = "all" | "today" | "upcoming" | "overdue" | "completed";
type DueChoice = "none" | "today" | "tomorrow";

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

const PRIORITY_CYCLE: Priority[] = ["low", "medium", "high", "urgent"];
const DUE_CYCLE: DueChoice[] = ["none", "today", "tomorrow"];
const REPEAT_CYCLE: RepeatKind[] = ["none", "daily", "weekdays", "weekly", "monthly"];

/** Toast copy for completing a recurring todo, e.g. "Repeats daily — next occurrence created." */
function repeatCompletionDescription(repeat: RepeatKind): string {
  const option = REPEAT_OPTIONS.find((o) => o.value === repeat);
  const label = (option?.label ?? repeat).toLowerCase();
  return `Repeats ${label} — next occurrence created.`;
}

const priorityChipStyles: Record<Priority, string> = {
  low: "border-border bg-muted/50 text-muted-foreground",
  medium:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  urgent: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

const EMPTY_BY_TAB: Record<
  TabValue,
  { icon: LucideIcon; title: string; description: string }
> = {
  all: {
    icon: ListTodo,
    title: "No tasks yet",
    description: "Capture what's on your mind — small steps count double.",
  },
  today: {
    icon: CalendarCheck,
    title: "Nothing due today",
    description: "Your slate is clear. Add a task for today or plan ahead.",
  },
  upcoming: {
    icon: CalendarClock,
    title: "Nothing upcoming",
    description: "No tasks scheduled for the days ahead. Enjoy the calm.",
  },
  overdue: {
    icon: CheckCircle2,
    title: "Nothing overdue",
    description: "You're all caught up — great job staying on top of things.",
  },
  completed: {
    icon: CheckCircle2,
    title: "Nothing completed yet",
    description: "Check off your first task and it will show up here.",
  },
};

/** Local calendar-day key of a due/completed ISO timestamp (null when unset). */
function isoDayKey(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateToKey(d);
}

function dueDayKey(todo: Todo): string | null {
  return isoDayKey(todo.dueDate);
}

/** Turn a local day key (+ optional "HH:MM") into a real ISO instant. */
function localDateKeyToIso(key: string, time = "00:00"): string {
  const [y, mo, d] = key.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, (mo ?? 1) - 1, d ?? 1, h ?? 0, mi ?? 0).toISOString();
}

function toTimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO instant -> "YYYY-MM-DDTHH:MM" (local) for datetime-local inputs. */
function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function matchesTab(todo: Todo, tab: TabValue, today: string): boolean {
  const key = dueDayKey(todo);
  switch (tab) {
    case "all":
      return true;
    case "today":
      return todo.completed
        ? isoDayKey(todo.completedAt) === today
        : key === today;
    case "upcoming":
      return !todo.completed && !!key && key > today;
    case "overdue":
      return !todo.completed && !!key && key < today;
    case "completed":
      return todo.completed;
  }
}

function TasksSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading tasks">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-8 w-64 rounded-full" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function GroupLabel({
  label,
  count,
  danger,
}: {
  label: string;
  count: number;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-16 z-10 flex items-center justify-between gap-2 border-b px-3 py-1 backdrop-blur sm:px-4 lg:top-0",
        danger
          ? "border-destructive/20 bg-destructive/[0.06]"
          : "border-border/70 bg-card/95"
      )}
    >
      <h3
        className={cn(
          "py-0.5 text-xs font-semibold uppercase tracking-wider",
          danger ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {label}
      </h3>
      <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
        {count}
      </span>
    </div>
  );
}

/** One checklist row inside an expanded task: checkbox + title + hover delete. */
function SubtaskItem({
  subtask,
  drag,
  onToggle,
  onDelete,
}: {
  subtask: Subtask;
  /** Drag-to-reorder state for this step. */
  drag?: DragItemState;
  onToggle: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
}) {
  return (
    <div
      data-drag-item=""
      style={drag?.style}
      className={cn(
        "group/sub flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/70",
        drag?.isDragging && "select-none",
        drag?.indicator === "above" &&
          "relative after:absolute after:inset-x-0 after:top-0 after:h-0.5 after:rounded-full after:bg-emerald-500/80 after:content-['']",
        drag?.indicator === "below" &&
          "relative after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-emerald-500/80 after:content-['']"
      )}
    >
      {drag && (
        <button
          type="button"
          onPointerDown={drag.onPointerDown}
          aria-label={`Reorder step: ${subtask.title}`}
          title="Drag to reorder"
          className={cn(
            "flex size-6 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground/40",
            "transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
          )}
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={subtask.completed}
        aria-label={`${subtask.completed ? "Undo" : "Complete"} step: ${subtask.title}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(subtask);
        }}
        className={cn(
          "relative flex size-4 shrink-0 items-center justify-center rounded-[5px] border-2 transition-all duration-200 active:scale-75",
          subtask.completed
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/30 hover:border-primary/60 hover:bg-primary/10"
        )}
      >
        <Check
          className={cn(
            "size-2.5 transition-all duration-200",
            subtask.completed ? "scale-100 opacity-100" : "scale-50 opacity-0"
          )}
          strokeWidth={4}
          aria-hidden="true"
        />
        <span className="absolute -inset-1.5" aria-hidden="true" />
      </button>
      <span
        className={cn(
          "min-w-0 flex-1 break-words text-xs leading-snug transition-colors duration-200",
          subtask.completed
            ? "text-muted-foreground/70 line-through decoration-muted-foreground/50"
            : "text-foreground/90"
        )}
      >
        {subtask.title}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(subtask);
        }}
        aria-label={`Delete step: ${subtask.title}`}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 opacity-60 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/sub:opacity-100 [@media(hover:hover)]:opacity-0"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Inline checklist panel shown under a task row: steps + "Add a step" input. */
function SubtaskChecklist({
  todo,
  onAdd,
  onToggle,
  onDelete,
  onReorder,
}: {
  todo: Todo;
  onAdd: (todoId: string, title: string) => void;
  onToggle: (subtask: Subtask) => void;
  onDelete: (subtask: Subtask) => void;
  onReorder: (todoId: string, from: number, to: number) => void;
}) {
  const [title, setTitle] = React.useState("");
  const drag = useDragList({
    count: todo.subtasks.length,
    onReorder: (from, to) => onReorder(todo.id, from, to),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(todo.id, trimmed);
    setTitle("");
  };

  return (
    <div
      data-drag-list=""
      className={cn(
        "mt-2 animate-in fade-in slide-in-from-top-1 space-y-0.5 rounded-xl border border-border/70 bg-muted/30 p-1.5 duration-200",
        todo.completed && "opacity-60"
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {todo.subtasks.map((s, i) => (
        <SubtaskItem
          key={s.id}
          subtask={s}
          drag={drag.itemState(i)}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
      <form
        onSubmit={submit}
        className="flex items-center gap-1.5 rounded-lg px-1 py-0.5"
      >
        <Plus
          className="size-3 shrink-0 text-muted-foreground/70"
          aria-hidden="true"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a step…"
          aria-label={`Add a step to "${todo.title}"`}
          className="h-7 flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0 dark:bg-transparent dark:border-0"
        />
      </form>
    </div>
  );
}

function TodoRow({
  todo,
  onToggle,
  onEdit,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onReorderSubtask,
}: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onAddSubtask: (todoId: string, title: string) => void;
  onToggleSubtask: (subtask: Subtask) => void;
  onDeleteSubtask: (subtask: Subtask) => void;
  onReorderSubtask: (todoId: string, from: number, to: number) => void;
}) {
  const today = todayKey();
  const key = dueDayKey(todo);
  const overdue = !todo.completed && !!key && key < today;
  const dueToday = !todo.completed && key === today;
  // Checklist expansion is local per row (rows are keyed by todo id, so it
  // survives refetches while the row stays mounted).
  const [expanded, setExpanded] = React.useState(false);
  const subtaskTotal = todo.subtasks.length;
  const subtaskDone = todo.subtasks.filter((s) => s.completed).length;
  const allSubtasksDone = subtaskTotal > 0 && subtaskDone === subtaskTotal;
  const toggleExpanded = () => setExpanded((v) => !v);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3",
        overdue && "bg-destructive/[0.03]"
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.completed}
        aria-label={`${todo.completed ? "Mark" : "Complete"} "${todo.title}"`}
        onClick={() => onToggle(todo)}
        className={cn(
          "relative mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 active:scale-75",
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
        <span className="absolute -inset-2.5" aria-hidden="true" />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "break-words text-sm font-medium leading-snug decoration-2 transition-colors duration-300",
            "line-through",
            todo.completed
              ? "text-muted-foreground/70 decoration-muted-foreground/50"
              : "text-foreground decoration-transparent"
          )}
        >
          {todo.title}
        </p>
        {todo.notes && (
          <p className="mt-0.5 flex items-start gap-1 text-xs leading-snug text-muted-foreground/80">
            <FileText className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{todo.notes}</span>
          </p>
        )}
        <div
          className={cn(
            "mt-1.5 flex flex-wrap items-center gap-1.5",
            todo.completed && "opacity-60"
          )}
        >
          <PriorityBadge priority={todo.priority} />
          <CategoryBadge category={todo.category} />
          {subtaskTotal > 0 ? (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-label={`Checklist: ${subtaskDone} of ${subtaskTotal} ${subtaskTotal === 1 ? "step" : "steps"} done`}
              title={`Checklist progress: ${subtaskDone}/${subtaskTotal}`}
              className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[10px] font-medium tabular-nums transition-colors",
                allSubtasksDone
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 shadow-sm dark:text-emerald-300"
                  : "border-border bg-muted/50 text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300"
              )}
            >
              <ListChecks className="size-3 shrink-0" aria-hidden="true" />
              <span>
                {subtaskDone}/{subtaskTotal}
              </span>
              <span
                className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-muted-foreground/15"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{
                    width: `${(subtaskDone / subtaskTotal) * 100}%`,
                  }}
                />
              </span>
              <ChevronDown
                className={cn(
                  "size-3 shrink-0 text-muted-foreground/70 transition-transform duration-200",
                  !expanded && "-rotate-90"
                )}
                aria-hidden="true"
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={expanded}
              aria-label={`Add a step to "${todo.title}"`}
              title="Add a step"
              className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-medium transition-colors",
                expanded
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "text-muted-foreground/50 hover:bg-muted/60 hover:text-muted-foreground"
              )}
            >
              <ListChecks className="size-3" aria-hidden="true" />
            </button>
          )}
          {todo.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums",
                overdue
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  : dueToday
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-border bg-muted/50 text-muted-foreground"
              )}
            >
              <Clock className="size-3" aria-hidden="true" />
              {formatDueLabel(todo.dueDate)}
            </span>
          )}
          {todo.repeat !== "none" && <RepeatBadge repeat={todo.repeat} />}
          {todo.reminderAt && (
            <span
              className="inline-flex items-center gap-1 text-muted-foreground/70"
              title={`Reminder: ${formatDueLabel(todo.reminderAt)}`}
            >
              <Bell className="size-3" aria-hidden="true" />
              <span className="sr-only">Reminder set</span>
            </span>
          )}
        </div>
        {expanded && (
          <SubtaskChecklist
            todo={todo}
            onAdd={onAddSubtask}
            onToggle={onToggleSubtask}
            onDelete={onDeleteSubtask}
            onReorder={onReorderSubtask}
          />
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${todo.title}`}
            className="-my-2 size-11 shrink-0 rounded-xl text-muted-foreground hover:text-foreground sm:-mr-2"
          >
            <MoreVertical className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => onEdit(todo)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDelete(todo)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EditTaskDialog({
  todo,
  saving,
  onCancel,
  onSave,
}: {
  todo: Todo;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<TodoInput>) => void;
}) {
  const [title, setTitle] = React.useState(todo.title);
  const [notes, setNotes] = React.useState(todo.notes ?? "");
  const [priority, setPriority] = React.useState<Priority>(todo.priority);
  const [category, setCategory] = React.useState(todo.category);
  const [repeat, setRepeat] = React.useState<RepeatKind>(todo.repeat);
  const [dueDate, setDueDate] = React.useState(() => {
    if (!todo.dueDate) return "";
    const d = new Date(todo.dueDate);
    return Number.isNaN(d.getTime()) ? "" : dateToKey(d);
  });
  const [dueTime, setDueTime] = React.useState(() => {
    if (!todo.dueDate || !hasTime(todo.dueDate)) return "";
    const d = new Date(todo.dueDate);
    return Number.isNaN(d.getTime()) ? "" : toTimeInputValue(d);
  });
  const [reminder, setReminder] = React.useState(() =>
    todo.reminderAt ? isoToLocalInputValue(todo.reminderAt) : ""
  );

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Give the task a title");
      return;
    }
    const dueIso = dueDate
      ? localDateKeyToIso(dueDate, dueTime || "00:00")
      : null;
    const reminderIso = reminder ? new Date(reminder).toISOString() : null;
    onSave({
      title: trimmed,
      notes: notes.trim() || null,
      priority,
      category,
      dueDate: dueIso,
      reminderAt: reminderIso,
      repeat,
    });
  };

  const labelClass = "text-xs font-medium text-muted-foreground";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
          <DialogDescription>
            Update the details of your task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-title" className={labelClass}>
              Title
            </label>
            <Input
              id="edit-title"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-notes" className={labelClass}>
              Notes
            </label>
            <Textarea
              id="edit-notes"
              rows={3}
              placeholder="Add notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-priority" className={labelClass}>
                Priority
              </label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger id="edit-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-category" className={labelClass}>
                Category
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="edit-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TODO_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.emoji} {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-due-date" className={labelClass}>
                Due date
              </label>
              <Input
                id="edit-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-due-time" className={labelClass}>
                Time (optional)
              </label>
              <Input
                id="edit-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-repeat" className={labelClass}>
              Repeat
            </label>
            <Select
              value={repeat}
              onValueChange={(v) => setRepeat(v as RepeatKind)}
            >
              <SelectTrigger id="edit-repeat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPEAT_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {repeatOptionLabel(r.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/70">
              {REPEAT_OPTIONS.find((r) => r.value === repeat)?.hint ?? ""}
              {repeat !== "none" &&
                " — a fresh copy appears when you complete this task."}
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-reminder" className={labelClass}>
              Reminder
            </label>
            <Input
              id="edit-reminder"
              type="datetime-local"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground/70">
              Clear the fields to remove the due date or reminder.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TasksView() {
  const queryClient = useQueryClient();
  const quickAddRef = React.useRef<HTMLInputElement>(null);

  // Full list (active + completed) fetched once; filtering happens client-side.
  // Note: api.ts strips status "all" (no param), and the backend then defaults
  // to active-only — so we explicitly fetch both halves and merge them.
  // Key is ["todos", "full"] because ["todos", "all"] is owned by the
  // notification engine / bell menu (status "active").
  const { data: todos = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["todos", "full"],
    queryFn: async () => {
      const [active, completed] = await Promise.all([
        todosApi.list({ status: "active" }),
        todosApi.list({ status: "completed" }),
      ]);
      return [...active, ...completed];
    },
  });

  const [tab, setTab] = React.useState<TabValue>("all");
  const [category, setCategory] = React.useState<string>("all");
  const [quickTitle, setQuickTitle] = React.useState("");
  const [quickPriority, setQuickPriority] = React.useState<Priority>("medium");
  const [quickDue, setQuickDue] = React.useState<DueChoice>("today");
  const [quickRepeat, setQuickRepeat] = React.useState<RepeatKind>("none");
  const [editing, setEditing] = React.useState<Todo | null>(null);
  const [deleting, setDeleting] = React.useState<Todo | null>(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [completedOpen, setCompletedOpen] = React.useState(false);

  const invalidate = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["todos"] });
    void queryClient.invalidateQueries({ queryKey: ["stats"] });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (input: TodoInput) => todosApi.create(input),
    onSuccess: () => {
      invalidate();
      toast.success("Task added");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't add the task"),
  });

  const toggleMutation = useMutation({
    mutationFn: (todo: Todo) =>
      todosApi.update(todo.id, { completed: !todo.completed }),
    onMutate: async (todo) => {
      await queryClient.cancelQueries({ queryKey: ["todos", "full"] });
      const prev = queryClient.getQueryData<Todo[]>(["todos", "full"]);
      if (prev) {
        queryClient.setQueryData<Todo[]>(
          ["todos", "full"],
          prev.map((t) =>
            t.id === todo.id
              ? {
                  ...t,
                  completed: !t.completed,
                  completedAt: !todo.completed
                    ? new Date().toISOString()
                    : null,
                }
              : t
          )
        );
      }
      return { prev };
    },
    onSuccess: (_updated, todo) => {
      // Completing a recurring todo spawns the next occurrence server-side.
      if (!todo.completed && todo.repeat !== "none") {
        toast.success("Task completed", {
          description: repeatCompletionDescription(todo.repeat),
        });
      }
    },
    onError: (_e, _todo, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["todos", "full"], ctx.prev);
      }
      toast.error("Couldn't update the task");
    },
    onSettled: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; patch: Partial<TodoInput> }) =>
      todosApi.update(args.id, args.patch),
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success("Task updated");
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't update the task"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => todosApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["todos", "full"] });
      const prev = queryClient.getQueryData<Todo[]>(["todos", "full"]);
      if (prev) {
        queryClient.setQueryData<Todo[]>(
          ["todos", "full"],
          prev.filter((t) => t.id !== id)
        );
      }
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["todos", "full"], ctx.prev);
      }
      toast.error("Couldn't delete the task");
    },
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast.success("Task deleted");
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => todosApi.clearCompleted(),
    onSuccess: () => {
      invalidate();
      setClearOpen(false);
      toast.success("Completed tasks cleared");
    },
    onError: () => toast.error("Couldn't clear completed tasks"),
  });

  // ── Subtasks (checklist) ─────────────────────────────────────
  // Subtasks ride along on every todo response, so invalidating ["todos"]
  // refreshes them everywhere. They don't affect stats — no ["stats"] bust.
  // Errors toast only; success is visible in the UI itself.
  const invalidateTodos = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["todos"] });
  }, [queryClient]);

  const addSubtaskMutation = useMutation({
    mutationFn: ({ todoId, title }: { todoId: string; title: string }) =>
      subtasksApi.create(todoId, { title }),
    onSuccess: invalidateTodos,
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Couldn't add the step"),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: (subtask: Subtask) =>
      subtasksApi.update(subtask.id, { completed: !subtask.completed }),
    onMutate: async (subtask) => {
      await queryClient.cancelQueries({ queryKey: ["todos", "full"] });
      const prev = queryClient.getQueryData<Todo[]>(["todos", "full"]);
      if (prev) {
        queryClient.setQueryData<Todo[]>(
          ["todos", "full"],
          prev.map((t) =>
            t.id === subtask.todoId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtask.id
                      ? { ...s, completed: !s.completed }
                      : s
                  ),
                }
              : t
          )
        );
      }
      return { prev };
    },
    onError: (_e, _subtask, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["todos", "full"], ctx.prev);
      }
      toast.error("Couldn't update the step");
    },
    onSettled: invalidateTodos,
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: (subtask: Subtask) => subtasksApi.remove(subtask.id),
    onMutate: async (subtask) => {
      await queryClient.cancelQueries({ queryKey: ["todos", "full"] });
      const prev = queryClient.getQueryData<Todo[]>(["todos", "full"]);
      if (prev) {
        queryClient.setQueryData<Todo[]>(
          ["todos", "full"],
          prev.map((t) =>
            t.id === subtask.todoId
              ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtask.id) }
              : t
          )
        );
      }
      return { prev };
    },
    onError: (_e, _subtask, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["todos", "full"], ctx.prev);
      }
      toast.error("Couldn't delete the step");
    },
    onSettled: invalidateTodos,
  });

  // Drag-to-reorder of the steps inside one todo's checklist. Optimistic on
  // ["todos","full"] (same conventions as toggle/delete above) with rollback.
  const reorderSubtaskMutation = useMutation({
    mutationFn: ({ ids }: { todoId: string; ids: string[] }) =>
      subtasksApi.reorder(ids),
    onMutate: async ({ todoId, ids }) => {
      await queryClient.cancelQueries({ queryKey: ["todos", "full"] });
      const prev = queryClient.getQueryData<Todo[]>(["todos", "full"]);
      if (prev) {
        queryClient.setQueryData<Todo[]>(
          ["todos", "full"],
          prev.map((t) => {
            if (t.id !== todoId) return t;
            const byId = new Map(t.subtasks.map((s) => [s.id, s]));
            const next = ids
              .map((id) => byId.get(id))
              .filter((s): s is Subtask => s !== undefined);
            if (next.length !== t.subtasks.length) return t;
            return { ...t, subtasks: next };
          })
        );
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["todos", "full"], ctx.prev);
      }
      toast.error("Couldn't save the new order");
    },
    onSettled: invalidateTodos,
  });

  const reorderSubtask = (todoId: string, from: number, to: number) => {
    const todo = todos.find((t) => t.id === todoId);
    const steps = todo?.subtasks ?? [];
    if (from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) {
      return;
    }
    const reordered = arrayMove(steps, from, to);
    reorderSubtaskMutation.mutate({
      todoId,
      ids: reordered.map((s) => s.id),
    });
  };

  const today = todayKey();
  const tomorrow = addDaysToKey(today, 1);

  const doneTodayCount = todos.filter(
    (t) => t.completed && isoDayKey(t.completedAt) === today
  ).length;
  const overdueCount = todos.filter(
    (t) => !t.completed && isOverdue(t.dueDate)
  ).length;
  const completedTotal = todos.filter((t) => t.completed).length;

  const filtered = React.useMemo(
    () =>
      todos.filter(
        (t) =>
          matchesTab(t, tab, today) &&
          (category === "all" || t.category === category)
      ),
    [todos, tab, category, today]
  );

  const activeTodos = React.useMemo(
    () => filtered.filter((t) => !t.completed),
    [filtered]
  );

  const completedTodos = React.useMemo(
    () =>
      filtered
        .filter((t) => t.completed)
        .sort((a, b) =>
          (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
        ),
    [filtered]
  );

  const visibleGroups = React.useMemo(() => {
    const buckets: Record<
      "overdue" | "today" | "tomorrow" | "upcoming" | "nodate",
      Todo[]
    > = {
      overdue: [],
      today: [],
      tomorrow: [],
      upcoming: [],
      nodate: [],
    };
    for (const t of activeTodos) {
      const key = dueDayKey(t);
      if (key === null) buckets.nodate.push(t);
      else if (key < today) buckets.overdue.push(t);
      else if (key === today) buckets.today.push(t);
      else if (key === tomorrow) buckets.tomorrow.push(t);
      else buckets.upcoming.push(t);
    }
    return [
      { id: "overdue", label: "Overdue", tone: "danger" as const, items: buckets.overdue },
      { id: "today", label: "Today", tone: "default" as const, items: buckets.today },
      { id: "tomorrow", label: "Tomorrow", tone: "default" as const, items: buckets.tomorrow },
      { id: "upcoming", label: "Upcoming", tone: "default" as const, items: buckets.upcoming },
      { id: "nodate", label: "No date", tone: "default" as const, items: buckets.nodate },
    ].filter((g) => g.items.length > 0);
  }, [activeTodos, today, tomorrow]);

  const submitQuickAdd = () => {
    const title = quickTitle.trim();
    if (!title) {
      quickAddRef.current?.focus();
      return;
    }
    if (createMutation.isPending) return;
    const dueDate =
      quickDue === "none"
        ? null
        : localDateKeyToIso(quickDue === "today" ? today : tomorrow);
    createMutation.mutate(
      { title, priority: quickPriority, dueDate, repeat: quickRepeat },
      {
        onSuccess: () => {
          setQuickTitle("");
          quickAddRef.current?.focus();
        },
      }
    );
  };

  const cyclePriority = () =>
    setQuickPriority(
      (p) =>
        PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(p) + 1) % PRIORITY_CYCLE.length]
    );

  const cycleDue = () =>
    setQuickDue(
      (d) => DUE_CYCLE[(DUE_CYCLE.indexOf(d) + 1) % DUE_CYCLE.length]
    );

  const cycleRepeat = () =>
    setQuickRepeat(
      (r) => REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(r) + 1) % REPEAT_CYCLE.length]
    );

  const completedShown = completedTodos.length > 0 || tab === "completed";
  const completedExpanded = tab === "completed" || completedOpen;
  const hasAnyTodos = todos.length > 0;

  const empty = EMPTY_BY_TAB[tab];
  const categoryMeta = TODO_CATEGORIES.find((c) => c.value === category);
  const categoryScoped = category !== "all" && hasAnyTodos;
  const showEmptyAction = tab === "all" || tab === "today" || tab === "upcoming";
  const focusQuickAdd = () => quickAddRef.current?.focus();

  return (
    <div className="space-y-4 sm:space-y-5">
      <ViewHeader
        title="Tasks"
        subtitle={`${doneTodayCount} done today · ${overdueCount} overdue`}
        actions={
          completedTotal > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClearOpen(true)}
              className="gap-1.5 rounded-xl text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Clear completed
            </Button>
          ) : undefined
        }
      />

      {/* Quick add */}
      <section aria-label="Add a task">
        <div className="rounded-2xl border bg-card p-2 shadow-card">
          <div className="flex items-center gap-1.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Plus className="size-4.5" />
            </span>
            <Input
              ref={quickAddRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitQuickAdd();
                }
              }}
              placeholder="Add a task…"
              aria-label="Task title"
              className="h-9 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent dark:border-0"
            />
            <Button
              size="icon"
              aria-label="Add task"
              onClick={submitQuickAdd}
              disabled={createMutation.isPending}
              className="size-9 shrink-0 rounded-xl"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 pb-1">
            <button
              type="button"
              onClick={cyclePriority}
              aria-label={`Priority: ${quickPriority}. Tap to change.`}
              title="Tap to change priority"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium capitalize transition-colors",
                priorityChipStyles[quickPriority]
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  quickPriority === "urgent" && "bg-red-500",
                  quickPriority === "high" && "bg-orange-500",
                  quickPriority === "medium" && "bg-amber-500",
                  quickPriority === "low" && "bg-muted-foreground/50"
                )}
                aria-hidden="true"
              />
              {quickPriority}
            </button>
            <button
              type="button"
              onClick={cycleDue}
              aria-label={`Due: ${quickDue === "none" ? "no date" : quickDue}. Tap to change.`}
              title="Tap to change due date"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium capitalize transition-colors",
                quickDue === "none"
                  ? "border-border bg-muted/50 text-muted-foreground"
                  : "border-primary/40 bg-primary/10 text-primary"
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {quickDue === "none" ? "No date" : quickDue}
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              aria-label={`Repeat: ${quickRepeat === "none" ? "never" : quickRepeat}. Tap to change.`}
              title="Tap to change repeat"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                quickRepeat === "none"
                  ? "border-border bg-muted/50 text-muted-foreground"
                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              )}
            >
              <Repeat className="size-3.5" aria-hidden="true" />
              {quickRepeat === "none" ? "No repeat" : repeatOptionLabel(quickRepeat)}
            </button>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section aria-label="Filter tasks" className="space-y-2.5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList className="h-10 w-full justify-between overflow-x-auto rounded-xl no-scrollbar">
            {TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="flex-1 whitespace-nowrap px-2 text-xs sm:text-sm"
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div
          className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar"
          role="group"
          aria-label="Filter by category"
        >
          <CategoryChip
            label="All"
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {TODO_CATEGORIES.map((c) => (
            <CategoryChip
              key={c.value}
              label={`${c.label} ${c.emoji}`}
              active={category === c.value}
              onClick={() => setCategory(c.value)}
            />
          ))}
        </div>
      </section>

      {/* Task list */}
      {isLoading ? (
        <TasksSkeleton />
      ) : isError ? (
        <EmptyState
          icon={CloudOff}
          title="Couldn't load your tasks"
          description="Something went wrong while fetching your tasks. Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={categoryScoped ? ListTodo : empty.icon}
          title={
            categoryScoped
              ? `No ${categoryMeta?.label ?? category} tasks here`
              : empty.title
          }
          description={
            categoryScoped
              ? "Try another category filter, or add a new task in this one."
              : empty.description
          }
          actionLabel={showEmptyAction ? "Add a task" : undefined}
          onAction={showEmptyAction ? focusQuickAdd : undefined}
        />
      ) : (
        <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-card">
          {visibleGroups.map((g) => (
            <section key={g.id} aria-label={`${g.label} tasks`}>
              <GroupLabel
                label={g.label}
                count={g.items.length}
                danger={g.tone === "danger"}
              />
              <div className="stagger-list divide-y divide-border/60">
                {g.items.map((t) => (
                  <TodoRow
                    key={t.id}
                    todo={t}
                    onToggle={(todo) => toggleMutation.mutate(todo)}
                    onEdit={setEditing}
                    onDelete={setDeleting}
                    onAddSubtask={(todoId, title) =>
                      addSubtaskMutation.mutate({ todoId, title })
                    }
                    onToggleSubtask={(subtask) =>
                      toggleSubtaskMutation.mutate(subtask)
                    }
                    onDeleteSubtask={(subtask) =>
                      deleteSubtaskMutation.mutate(subtask)
                    }
                    onReorderSubtask={reorderSubtask}
                  />
                ))}
              </div>
            </section>
          ))}

          {completedShown && (
            <section aria-label="Completed tasks">
              <div className="sticky top-16 z-10 flex items-center justify-between gap-2 border-b border-border/70 bg-card/95 px-3 py-1 backdrop-blur sm:px-4 lg:top-0">
                <button
                  type="button"
                  onClick={() => setCompletedOpen((v) => !v)}
                  aria-expanded={completedExpanded}
                  className="flex items-center gap-1 rounded-md py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ChevronDown
                    className={cn(
                      "size-3.5 transition-transform duration-200",
                      completedExpanded && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                  Completed
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground/70">
                    {completedTodos.length}
                  </span>
                  {completedTodos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setClearOpen(true)}
                      className="rounded-md px-1 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {completedExpanded && (
                <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
                  {completedTodos.map((t) => (
                    <TodoRow
                      key={t.id}
                      todo={t}
                      onToggle={(todo) => toggleMutation.mutate(todo)}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                      onAddSubtask={(todoId, title) =>
                        addSubtaskMutation.mutate({ todoId, title })
                      }
                      onToggleSubtask={(subtask) =>
                        toggleSubtaskMutation.mutate(subtask)
                      }
                      onDeleteSubtask={(subtask) =>
                        deleteSubtaskMutation.mutate(subtask)
                      }
                      onReorderSubtask={reorderSubtask}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Edit dialog */}
      {editing && (
        <EditTaskDialog
          key={editing.id}
          todo={editing}
          saving={updateMutation.isPending}
          onCancel={() => setEditing(null)}
          onSave={(patch) =>
            updateMutation.mutate({ id: editing.id, patch })
          }
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleting?.title}&rdquo; will be permanently removed. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) deleteMutation.mutate(deleting.id);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear completed confirm */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear completed tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              {completedTotal} completed {completedTotal === 1 ? "task" : "tasks"}{" "}
              will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                clearMutation.mutate();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {clearMutation.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
