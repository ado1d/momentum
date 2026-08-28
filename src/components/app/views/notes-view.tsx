"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  Ellipsis,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Printer,
  Search,
  StickyNote,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";

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
  DialogFooter,
  DialogHeader,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { EmptyState } from "@/components/app/shared/empty-state";
import { ViewHeader } from "@/components/app/shared/view-header";
import { extractWikiTitles, MarkdownContent } from "@/components/app/shared/markdown";
import {
  RichEditor,
  type RichEditorToolbarApi,
} from "@/components/app/shared/rich-editor";
import { exportApi, notesApi } from "@/lib/api";
import { downloadMarkdown, esc, miniMarkdownToHtml, printHtml } from "@/lib/export";
import { NOTE_COLORS, type Note, type NoteColor, type NoteInput } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────

const NOTE_CARD_STYLES: Record<NoteColor, string> = {
  default: "bg-card border-border",
  yellow: "border-amber-500/30 bg-amber-500/10",
  green: "border-emerald-500/30 bg-emerald-500/10",
  rose: "border-rose-500/30 bg-rose-500/10",
  violet: "border-violet-500/30 bg-violet-500/10",
  teal: "border-teal-500/30 bg-teal-500/10",
};

const SWATCH_STYLES: Record<NoteColor, string> = {
  default: "border border-border bg-card",
  yellow: "bg-amber-400",
  green: "bg-emerald-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  teal: "bg-teal-500",
};

const COLOR_LABELS: Record<NoteColor, string> = {
  default: "Default",
  yellow: "Yellow",
  green: "Green",
  rose: "Rose",
  violet: "Violet",
  teal: "Teal",
};

/** "Edited 2h ago" style relative timestamps */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "some time ago";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Small shared pieces ──────────────────────────────────────

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We could not load your notes. Try again in a moment.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function NotesSkeleton() {
  return (
    <div className="columns-1 gap-4 sm:columns-2" aria-busy="true" aria-label="Loading notes">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="mb-4 break-inside-avoid rounded-2xl" style={{ height: `${120 + (i % 3) * 56}px` }} />
      ))}
    </div>
  );
}

// ── Note card ────────────────────────────────────────────────

interface NoteCardProps {
  note: Note;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
  onWikiLink: (title: string) => void;
  pinPending: boolean;
}

function NoteCard({ note, onOpen, onTogglePin, onDelete, onWikiLink, pinPending }: NoteCardProps) {
  return (
    <Card
      className={cn(
        "group relative mb-4 cursor-pointer break-inside-avoid rounded-2xl py-0 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 press",
        NOTE_CARD_STYLES[note.color] ?? NOTE_CARD_STYLES.default
      )}
      onClick={() => onOpen(note)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(note);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open note: ${note.title || "Untitled note"}`}
    >
      <CardContent className="p-4 sm:p-5">
        {note.pinned && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl bg-gradient-to-b from-amber-400 via-amber-500 to-orange-500/70"
          />
        )}
        <div className="flex items-start gap-2">
          {note.pinned && (
            <Pin
              className="mt-0.5 size-4 shrink-0 fill-amber-500 text-amber-500 transition-transform duration-300 group-hover:rotate-45"
              aria-label="Pinned"
            />
          )}
          <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug sm:text-base">
            {note.title || "Untitled note"}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`Options for ${note.title || "untitled note"}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Ellipsis className="size-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              // The menu is portaled but still a React-tree child of the
              // card — stop the synthetic click from opening the editor.
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                disabled={pinPending}
                onSelect={() => onTogglePin(note)}
              >
                {note.pinned ? (
                  <>
                    <PinOff aria-hidden="true" /> Unpin
                  </>
                ) : (
                  <>
                    <Pin aria-hidden="true" /> Pin
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpen(note)}>
                <Pencil aria-hidden="true" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(note)}>
                <Trash2 aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {note.content.trim() ? (
          <MarkdownContent
            content={note.content}
            className="mt-1.5 line-clamp-4 text-muted-foreground"
            onWikiLink={onWikiLink}
          />
        ) : (
          <p className="mt-1.5 text-sm italic text-muted-foreground/70">Empty note</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {note.tag && (
            <Badge
              variant="secondary"
              className="rounded-full px-2 py-0 text-[10px] font-medium"
            >
              # {note.tag}
            </Badge>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Edited {relativeTime(note.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Note editor dialog ───────────────────────────────

/** Toolbar item for the note editor: wraps the selection (or inserts) a
 *  [[wiki-link]] that navigates to another note. */
function WikiLinkToolbarButton({
  insertMarkdown,
}: RichEditorToolbarApi) {
  return (
    <button
      type="button"
      aria-label="Link to another note"
      title="Link to another note — [[Note title]]"
      // Keep focus (and the selection) inside the editor on click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        // Read the live DOM selection (the editor keeps it thanks to the
        // prevented mousedown). Only wrap text selected INSIDE this editor.
        const sel = window.getSelection();
        const editorEl = document.querySelector(
          ".rich-editor-root [contenteditable]"
        );
        let text = "";
        if (sel && !sel.isCollapsed && editorEl?.contains(sel.anchorNode)) {
          // wiki-links are single-line; collapse paragraph breaks
          text = sel.toString().trim().replace(/\s*\n+\s*/g, " ");
        }
        insertMarkdown(text ? `[[${text}]]` : "[[]]");
      }}
      className="rich-editor-toolbtn"
    >
      <Link2 className="size-3.5" aria-hidden="true" />
    </button>
  );
}

interface NoteFormValues {
  title: string;
  content: string;
  tag: string;
  color: NoteColor;
  pinned: boolean;
}

function emptyNoteForm(): NoteFormValues {
  return { title: "", content: "", tag: "", color: "default", pinned: false };
}

function noteToForm(note: Note): NoteFormValues {
  return {
    title: note.title,
    content: note.content,
    tag: note.tag ?? "",
    color: note.color,
    pinned: note.pinned,
  };
}

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note | null;
  notes: Note[];
  existingTags: string[];
  submitting: boolean;
  onSubmit: (values: NoteFormValues) => void;
  onOpenNote: (note: Note) => void;
  onWikiLink: (title: string) => void;
}

function NoteDialog({
  open,
  onOpenChange,
  note,
  notes,
  existingTags,
  submitting,
  onSubmit,
  onOpenNote,
  onWikiLink,
}: NoteDialogProps) {
  const [values, setValues] = React.useState<NoteFormValues>(emptyNoteForm);

  React.useEffect(() => {
    if (open) {
      setValues(note ? noteToForm(note) : emptyNoteForm());
    }
  }, [open, note]);

  const set = <K extends keyof NoteFormValues>(key: K, value: NoteFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  // ── Backlinks: other notes whose content contains [[current title]] ──

  const backlinks = React.useMemo(() => {
    const title = values.title.trim().toLowerCase();
    if (!title || !note) return [];
    return notes.filter(
      (n) => n.id !== note.id && extractWikiTitles(n.content).includes(title)
    );
  }, [notes, note, values.title]);

  const canSubmit = values.title.trim().length > 0 || values.content.trim().length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Write a title or some content first");
      return;
    }
    onSubmit(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note ? "Edit note" : "New note"}</DialogTitle>
          <DialogDescription>
            {note ? "Refine your thoughts." : "Capture the idea before it slips away."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-title">Title</Label>
            <Input
              id="note-title"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Give it a name (optional)"
              maxLength={120}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note-content">Content</Label>
            <RichEditor
              id="note-content"
              value={values.content}
              onChange={(md) => set("content", md)}
              placeholder="Start writing — formatting appears as you type…"
              minHeight={220}
              toolbarExtra={WikiLinkToolbarButton}
            />
            <p className="text-[11px] text-muted-foreground">
              Formatting shows live as you type · ⌘B / ⌑ bold · ⌘I italic ·{" "}
              <span className="text-primary">[[Note title]]</span> links notes
              together
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="note-tag">Tag</Label>
              <Input
                id="note-tag"
                value={values.tag}
                onChange={(e) => set("tag", e.target.value)}
                placeholder="e.g. ideas"
                list="note-tag-suggestions"
                maxLength={40}
                className="rounded-xl"
              />
              <datalist id="note-tag-suggestions">
                {existingTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color: ${COLOR_LABELS[c]}`}
                    aria-pressed={values.color === c}
                    onClick={() => set("color", c)}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl transition-all duration-200",
                      SWATCH_STYLES[c],
                      values.color === c
                        ? "scale-110 ring-2 ring-ring/60 ring-offset-2 ring-offset-background"
                        : "opacity-80 hover:scale-105 hover:opacity-100"
                    )}
                  >
                    {values.color === c && (
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          c === "yellow" || c === "default" ? "bg-foreground" : "bg-white"
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-3 py-2.5">
            <div>
              <Label htmlFor="note-pinned" className="text-sm">
                Pin to top
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Pinned notes always come first.
              </p>
            </div>
            <Switch
              id="note-pinned"
              checked={values.pinned}
              onCheckedChange={(checked) => set("pinned", checked)}
              aria-label="Pin note to top"
            />
          </div>

          {backlinks.length > 0 && (
            <div className="rounded-xl border bg-muted/30 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Link2 className="size-3" aria-hidden="true" /> Mentioned in:
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {backlinks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpenNote(b)}
                    className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  >
                    {b.title || "Untitled note"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 rounded-xl" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {note ? "Save changes" : "Create note"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main view ────────────────────────────────────────────────

export function NotesView() {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["notes"],
    queryFn: notesApi.list,
  });

  const [search, setSearch] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string>("all");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<Note | null>(null);
  const [noteToDelete, setNoteToDelete] = React.useState<Note | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);

  const invalidate = (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  // ── Derived data ──

  const tags = React.useMemo(
    () =>
      Array.from(
        new Set(notes.map((n) => n.tag).filter((t): t is string => !!t))
      ).sort((a, b) => a.localeCompare(b)),
    [notes]
  );

  const query = search.trim().toLowerCase();
  const filtered = notes.filter((n) => {
    if (activeTag !== "all" && n.tag !== activeTag) return false;
    if (!query) return true;
    return (
      n.title.toLowerCase().includes(query) ||
      n.content.toLowerCase().includes(query) ||
      (n.tag ?? "").toLowerCase().includes(query)
    );
  });

  // ── Mutations ──

  const saveNote = useMutation({
    mutationFn: (vars: { id?: string; input: NoteInput }) =>
      vars.id ? notesApi.update(vars.id, vars.input) : notesApi.create(vars.input),
    onSuccess: (_result, vars) => {
      invalidate(["notes", "stats"]);
      toast.success(vars.id ? "Note updated" : "Note created");
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message || "Could not save note"),
  });

  const patchNote = useMutation({
    mutationFn: (vars: { note: Note; patch: NoteInput }) =>
      notesApi.update(vars.note.id, vars.patch),
    onMutate: async ({ note, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["notes"] });
      const previous = queryClient.getQueryData<Note[]>(["notes"]);
      queryClient.setQueryData<Note[]>(["notes"], (old) =>
        (old ?? []).map((n) => (n.id === note.id ? { ...n, ...patch } : n))
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["notes"], context.previous);
      toast.error(error.message || "Could not update note");
    },
    onSettled: () => invalidate(["notes", "stats"]),
  });

  const removeNote = useMutation({
    mutationFn: (id: string) => notesApi.remove(id),
    onSuccess: () => {
      invalidate(["notes", "stats"]);
      toast.success("Note deleted");
      setNoteToDelete(null);
    },
    onError: (e) => toast.error(e.message || "Could not delete note"),
  });

  // ── Handlers ──

  const openNewNote = () => {
    setEditingNote(null);
    setDialogOpen(true);
  };

  const openEditNote = (note: Note) => {
    setEditingNote(note);
    setDialogOpen(true);
  };

  /** Resolve a [[wiki-link]] title against the loaded notes. */
  const openWikiLink = (title: string) => {
    const needle = title.trim().toLowerCase();
    const target = notes.find(
      (n) => (n.title.trim() || "Untitled note").toLowerCase() === needle
    );
    if (target) {
      openEditNote(target);
    } else {
      toast.info(`No note titled “${title}” yet`);
    }
  };

  const submitNote = (values: NoteFormValues) => {
    saveNote.mutate({
      id: editingNote?.id,
      input: {
        title: values.title.trim() || "Untitled note",
        content: values.content,
        tag: values.tag.trim().toLowerCase() || null,
        color: values.color,
        pinned: values.pinned,
      },
    });
  };

  const togglePin = (note: Note) => {
    patchNote.mutate({
      note,
      patch: { pinned: !note.pinned },
    });
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
      toast.error(
        e instanceof Error ? e.message : `${label} failed`,
        { id: toastId }
      );
    } finally {
      setExporting(null);
    }
  };

  const exportMarkdown = () =>
    runExport("md", "Markdown export", async () => {
      const md = await exportApi.markdown("notes");
      downloadMarkdown(md, "momentum-notes.md");
    });

  const exportPdf = () =>
    runExport("pdf", "PDF export", async () => {
      if (notes.length === 0) {
        toast.error("Nothing to export yet");
        return;
      }
      const html = notes
        .map(
          (n) => `
        <div>
          <div style="font-size:17px; font-weight:700; margin:18px 0 4px;">${esc(n.title || "Untitled note")}${n.pinned ? " 📌" : ""}</div>
          ${n.tag ? `<div style="font-size:11px; color:#777; margin-bottom:6px;"># ${esc(n.tag)}</div>` : ""}
          ${miniMarkdownToHtml(n.content)}
          <hr style="border:none; border-top:1px solid #e3e3e3; margin:16px 0 4px;" />
        </div>`
        )
        .join("");
      printHtml("Notes", html);
    });

  const exportBusy = exporting !== null;

  // ── Render ──

  return (
    <div>
      <ViewHeader
        title="Notes"
        subtitle="Quick capture & ideas"
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl"
                  aria-label="Export notes"
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
                  <FileText aria-hidden="true" /> Export notes (Markdown)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportPdf}>
                  <Printer aria-hidden="true" /> Export notes (PDF)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="h-11 rounded-xl" onClick={openNewNote}>
              <Plus aria-hidden="true" /> New note
            </Button>
          </>
        }
      />

      {isLoading ? (
        <>
          <div className="mb-4 space-y-3">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-9 w-2/3 rounded-full" />
          </div>
          <NotesSkeleton />
        </>
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4">
          {notes.length > 0 && (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search notes by title, content or tag…"
                  aria-label="Search notes"
                  className="h-11 rounded-xl pl-9 pr-10"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {tags.length > 0 && (
                <div
                  className="fade-edges -mx-3 flex gap-2 overflow-x-auto px-3 pb-1"
                  role="group"
                  aria-label="Filter by tag"
                >
                  <button
                    type="button"
                    onClick={() => setActiveTag("all")}
                    aria-pressed={activeTag === "all"}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      activeTag === "all"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    All ({notes.length})
                  </button>
                  {tags.map((tag) => {
                    const count = notes.filter((n) => n.tag === tag).length;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setActiveTag(activeTag === tag ? "all" : tag)}
                        aria-pressed={activeTag === tag}
                        className={cn(
                          "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                          activeTag === tag
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        # {tag} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title="No notes yet"
              description="Capture ideas, snippets and lists before they escape. They'll be right here, pinned or searchable."
              actionLabel="New note"
              onAction={openNewNote}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching notes"
              description={
                query
                  ? `Nothing matches “${search.trim()}”. Try a different word or clear the filters.`
                  : "No notes carry this tag yet."
              }
              actionLabel="Clear filters"
              onAction={() => {
                setSearch("");
                setActiveTag("all");
              }}
            />
          ) : (
            <div className="stagger-list columns-1 gap-4 sm:columns-2">
              {filtered.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpen={openEditNote}
                  onTogglePin={togglePin}
                  onDelete={setNoteToDelete}
                  onWikiLink={openWikiLink}
                  pinPending={patchNote.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <NoteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        note={editingNote}
        notes={notes}
        existingTags={tags}
        submitting={saveNote.isPending}
        onSubmit={submitNote}
        onOpenNote={openEditNote}
        onWikiLink={openWikiLink}
      />

      <AlertDialog
        open={noteToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setNoteToDelete(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{noteToDelete?.title || "Untitled note"}&rdquo; will be permanently
              removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => noteToDelete && removeNote.mutate(noteToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
