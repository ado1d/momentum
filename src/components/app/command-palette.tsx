"use client";

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  Check,
  ListTodo,
  Loader2,
  Moon,
  Plus,
  StickyNote,
  Sun,
  Target,
  Timer,
} from "lucide-react";
import { NAV_ITEMS } from "./nav-config";
import { searchApi } from "@/lib/api";
import { useUiStore } from "@/lib/store";
import { formatDueLabel, formatKeyLabel } from "@/lib/dates";
import type { ViewId } from "@/lib/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Debounce a value by `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-4 min-w-4 items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

const COMMAND_CLASSES =
  "**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5";

export function CommandPalette() {
  const paletteOpen = useUiStore((s) => s.paletteOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const setView = useUiStore((s) => s.setView);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const { resolvedTheme, setTheme } = useTheme();

  const [q, setQ] = React.useState("");
  const debouncedQ = useDebounced(q, 250);
  const hasQuery = q.trim().length >= 1;

  // Global ⌘K / Ctrl+K toggles the palette.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useUiStore.getState().paletteOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setPaletteOpen]);

  // Reset the search box whenever the palette closes so it reopens fresh.
  React.useEffect(() => {
    if (!paletteOpen) setQ("");
  }, [paletteOpen]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["search", debouncedQ],
    queryFn: () => searchApi.query(debouncedQ),
    enabled: debouncedQ.trim().length >= 1,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const go = (v: ViewId) => {
    setView(v);
    setPaletteOpen(false);
  };

  const toggleTheme = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Search across your tasks, notes, goals, habits and diary, or jump to
            any view.
          </DialogDescription>
        </DialogHeader>

        {/* Server-side search — disable cmdk's client-side filtering. */}
        <Command shouldFilter={false} className={COMMAND_CLASSES}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Search tasks, notes, goals…"
          />

          {hasQuery && isFetching ? (
            <div
              aria-live="polite"
              className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground"
            >
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              Searching…
            </div>
          ) : null}

          <CommandList className="max-h-[60vh]">
            {hasQuery ? (
              <>
                <CommandEmpty>
                  {isError
                    ? "Search failed. Please try again."
                    : isFetching || !data
                      ? "Searching…"
                      : `No results found for “${q}”.`}
                </CommandEmpty>

                {data && data.todos.length > 0 ? (
                  <CommandGroup heading="Tasks">
                    {data.todos.map((todo) => {
                      const due = formatDueLabel(todo.dueDate);
                      return (
                        <CommandItem
                          key={todo.id}
                          value={`todo-${todo.id}`}
                          onSelect={() => go("tasks")}
                        >
                          <ListTodo
                            className={cn(
                              todo.completed ? "text-muted-foreground" : "text-primary"
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              "flex-1 truncate",
                              todo.completed && "text-muted-foreground line-through"
                            )}
                          >
                            {todo.title}
                          </span>
                          {todo.completed ? (
                            <Check
                              className="size-3.5 text-primary"
                              aria-label="Completed"
                            />
                          ) : null}
                          {due ? (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {due}
                            </span>
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : null}

                {data && data.notes.length > 0 ? (
                  <CommandGroup heading="Notes">
                    {data.notes.map((note) => (
                      <CommandItem
                        key={note.id}
                        value={`note-${note.id}`}
                        onSelect={() => go("notes")}
                      >
                        <StickyNote className="text-primary" aria-hidden="true" />
                        <span className="flex-1 truncate">{note.title || "Untitled"}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(note.updatedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {data && data.goals.length > 0 ? (
                  <CommandGroup heading="Goals">
                    {data.goals.map((goal) => (
                      <CommandItem
                        key={goal.id}
                        value={`goal-${goal.id}`}
                        onSelect={() => go("goals")}
                      >
                        <Target className="text-primary" aria-hidden="true" />
                        <span className="flex-1 truncate">{goal.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {goal.progress}/{goal.target}
                          {goal.unit ? ` ${goal.unit}` : ""}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {data && data.habits.length > 0 ? (
                  <CommandGroup heading="Habits">
                    {data.habits.map((habit) => (
                      <CommandItem
                        key={habit.id}
                        value={`habit-${habit.id}`}
                        onSelect={() => go("routine")}
                      >
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-md bg-muted text-xs leading-none"
                          aria-hidden="true"
                        >
                          {habit.emoji}
                        </span>
                        <span className="flex-1 truncate">{habit.name}</span>
                        {habit.streak > 0 ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            🔥 {habit.streak}
                          </span>
                        ) : null}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}

                {data && data.journal.length > 0 ? (
                  <CommandGroup heading="Diary">
                    {data.journal.map((entry) => (
                      <CommandItem
                        key={entry.id}
                        value={`journal-${entry.id}`}
                        onSelect={() => go("diary")}
                      >
                        <BookOpen className="text-primary" aria-hidden="true" />
                        <span className="flex-1 truncate">{entry.title || "Untitled"}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatKeyLabel(entry.date)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </>
            ) : (
              <>
                <CommandGroup heading="Actions">
                  <CommandItem
                    value="action-new-task"
                    onSelect={() => {
                      setQuickAddOpen(true);
                      setPaletteOpen(false);
                    }}
                  >
                    <Plus className="text-primary" aria-hidden="true" />
                    <span className="flex-1">New task</span>
                    <span className="text-xs text-muted-foreground">Quick add</span>
                  </CommandItem>
                  <CommandItem value="action-focus" onSelect={() => go("focus")}>
                    <Timer className="text-primary" aria-hidden="true" />
                    <span className="flex-1">Start focus session</span>
                  </CommandItem>
                  <CommandItem value="action-theme" onSelect={toggleTheme}>
                    {resolvedTheme === "dark" ? (
                      <Sun className="text-primary" aria-hidden="true" />
                    ) : (
                      <Moon className="text-primary" aria-hidden="true" />
                    )}
                    <span className="flex-1">Toggle theme</span>
                    <span className="text-xs text-muted-foreground">
                      {resolvedTheme === "dark" ? "Light" : "Dark"}
                    </span>
                  </CommandItem>
                </CommandGroup>

                <CommandGroup heading="Go to">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`go-${item.id}`}
                        onSelect={() => go(item.id)}
                      >
                        <Icon className="text-primary" aria-hidden="true" />
                        <span className="flex-1">{item.label}</span>
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {item.description}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>

          <div className="flex items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Kbd>↑↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> select
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd> close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
