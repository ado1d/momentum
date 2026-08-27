"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, NotebookPen, Plus, StickyNote, ListTodo } from "lucide-react";
import { toast } from "sonner";
import { journalApi, notesApi, todosApi } from "@/lib/api";
import { todayKey } from "@/lib/dates";
import {
  MOODS,
  REPEAT_OPTIONS,
  type Mood,
  type Priority,
  type RepeatKind,
} from "@/lib/types";
import { useUiStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { repeatOptionLabel } from "@/components/app/shared/badges";
import { cn } from "@/lib/utils";

type QuickTab = "task" | "note" | "diary";

export function QuickAddDialog() {
  const open = useUiStore((s) => s.quickAddOpen);
  const setOpen = useUiStore((s) => s.setQuickAddOpen);
  const queryClient = useQueryClient();

  const [tab, setTab] = React.useState<QuickTab>("task");
  const [title, setTitle] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("medium");
  const [due, setDue] = React.useState<"none" | "today" | "tomorrow">("today");
  const [repeat, setRepeat] = React.useState<RepeatKind>("none");
  const [content, setContent] = React.useState("");
  const [mood, setMood] = React.useState<Mood | null>(null);

  const reset = () => {
    setTitle("");
    setPriority("medium");
    setDue("today");
    setRepeat("none");
    setContent("");
    setMood(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const invalidate = (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  const createTask = useMutation({
    mutationFn: () =>
      todosApi.create({
        title: title.trim(),
        priority,
        repeat,
        dueDate:
          due === "none"
            ? null
            : new Date(
                `${due === "today" ? todayKey() : new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T12:00:00`
              ).toISOString(),
      }),
    onSuccess: () => {
      invalidate(["todos", "stats", "dashboard"]);
      toast.success("Task added");
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const createNote = useMutation({
    mutationFn: () =>
      notesApi.create({
        title: title.trim() || "Untitled note",
        content: content.trim(),
      }),
    onSuccess: () => {
      invalidate(["notes", "stats"]);
      toast.success("Note saved");
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const saveDiary = useMutation({
    mutationFn: () =>
      journalApi.upsert({
        date: todayKey(),
        content: content.trim(),
        ...(mood ? { mood } : {}),
      }),
    onSuccess: () => {
      invalidate(["journal", "stats", "dashboard"]);
      toast.success("Diary entry saved");
      close();
    },
    onError: (e) => toast.error(e.message),
  });

  const busy =
    createTask.isPending || createNote.isPending || saveDiary.isPending;

  const submit = () => {
    if (busy) return;
    if (tab === "task") {
      if (!title.trim()) {
        toast.error("Give your task a title");
        return;
      }
      createTask.mutate();
    } else if (tab === "note") {
      if (!title.trim() && !content.trim()) {
        toast.error("Write something first");
        return;
      }
      createNote.mutate();
    } else {
      if (!content.trim()) {
        toast.error("Write something first");
        return;
      }
      saveDiary.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> Quick capture
          </DialogTitle>
          <DialogDescription>
            Get it out of your head in seconds.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as QuickTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="task" className="gap-1.5 text-xs sm:text-sm">
              <ListTodo className="size-3.5" /> Task
            </TabsTrigger>
            <TabsTrigger value="note" className="gap-1.5 text-xs sm:text-sm">
              <StickyNote className="size-3.5" /> Note
            </TabsTrigger>
            <TabsTrigger value="diary" className="gap-1.5 text-xs sm:text-sm">
              <NotebookPen className="size-3.5" /> Diary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="task" className="mt-4 space-y-3">
            <Input
              autoFocus
              placeholder="What needs doing?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Priority:</span>
              {(["low", "medium", "high", "urgent"] as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    priority === p
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Due:</span>
              {(["today", "tomorrow", "none"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDue(d)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    due === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Repeat:</span>
              {REPEAT_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={repeat === r.value}
                  onClick={() => setRepeat(r.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    repeat === r.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  {repeatOptionLabel(r.value)}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="note" className="mt-4 space-y-3">
            <Input
              autoFocus
              placeholder="Note title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Write your note… (markdown supported)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
          </TabsContent>

          <TabsContent value="diary" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Today&apos;s diary entry
            </p>
            <Textarea
              autoFocus
              placeholder="How was your day? What did you learn?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mood:</span>
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  aria-label={m.label}
                  aria-pressed={mood === m.value}
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  className={cn(
                    "rounded-lg px-1.5 py-1 text-lg transition-all",
                    mood === m.value
                      ? "scale-110 bg-primary/15 ring-2 ring-primary/40"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
            {tab === "task" ? "Add task" : tab === "note" ? "Save note" : "Save entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
