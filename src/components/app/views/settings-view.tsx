"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  BookOpen,
  CheckCircle2,
  DatabaseBackup,
  FileJson,
  FileText,
  Loader2,
  ListTodo,
  Merge,
  Printer,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  StickyNote,
  TriangleAlert,
  Upload,
  X,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

import { ViewHeader } from "@/components/app/shared/view-header";
import { exportApi, importApi, settingsApi } from "@/lib/api";
import {
  downloadJson,
  downloadMarkdown,
  miniMarkdownToHtml,
  printHtml,
} from "@/lib/export";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import type { AppSettings, ImportCounts, ImportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────

const START_VIEW_OPTIONS: { value: string; label: string }[] = [
  { value: "dashboard", label: "Dashboard" },
  { value: "tasks", label: "Tasks" },
  { value: "routine", label: "Routine" },
  { value: "goals", label: "Goals" },
  { value: "notes", label: "Notes" },
  { value: "diary", label: "Diary" },
];

const TECH_CHIPS = ["Next.js", "Prisma", "Tailwind"];

// ── Small shared pieces ──────────────────────────────────────

function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <TriangleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We could not load your settings. Try again in a moment.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading settings">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-40 w-full rounded-2xl" />
      ))}
    </div>
  );
}

// ── Export button ────────────────────────────────────────────

interface ExportButtonProps {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  busy: string | null;
  onRun: () => void;
}

function ExportButton({ id, icon: Icon, label, busy, onRun }: ExportButtonProps) {
  const isBusy = busy === id;
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy !== null}
      onClick={onRun}
      aria-label={label}
      className="h-auto w-full justify-start gap-2.5 rounded-xl px-3.5 py-3 text-left"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
          isBusy && "bg-transparent"
        )}
        aria-hidden="true"
      >
        {isBusy ? <Loader2 className="size-4.5 animate-spin" /> : <Icon className="size-4.5" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {isBusy ? "Preparing…" : label}
      </span>
    </Button>
  );
}

// ── Backup import (restore) ─────────────────────────────────

const MAX_BACKUP_BYTES = 20 * 1024 * 1024; // sanity cap: 20 MB

// A file counts as a plausible backup when at least one of these is an array.
const BACKUP_ARRAY_KEYS = [
  "todos",
  "subtasks",
  "habits",
  "routineTasks",
  "notes",
  "journal",
  "goals",
] as const;

interface ParsedBackup {
  fileName: string;
  sizeLabel: string;
  exportedAt: string | null; // pre-formatted friendly label
  data: Record<string, unknown>;
  preview: { label: string; count: number }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayCount(data: Record<string, unknown>, key: string): number {
  const value = data[key];
  return Array.isArray(value) ? value.length : 0;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function friendlyTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function pluralize(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatImportCounts(counts: ImportCounts): string {
  const parts = [
    pluralize(counts.todos, "task", "tasks"),
    pluralize(counts.habits, "habit", "habits"),
  ];
  if (counts.routineTasks > 0) {
    parts.push(pluralize(counts.routineTasks, "routine task", "routine tasks"));
  }
  parts.push(
    pluralize(counts.notes, "note", "notes"),
    pluralize(counts.journal, "journal entry", "journal entries"),
    pluralize(counts.goals, "goal", "goals"),
  );
  parts.push(`${counts.skipped} skipped`);
  return parts.join(" · ");
}

function ImportSection() {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = React.useState<ParsedBackup | null>(null);
  const [mode, setMode] = React.useState<"merge" | "replace">("merge");
  const [replaceConfirmed, setReplaceConfirmed] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const importBackup = useMutation({
    mutationFn: () => {
      if (!parsed) throw new Error("Choose a backup file first");
      return importApi.restore(parsed.data, mode);
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setResult(res);
      // Reset the pick + confirmation; the success panel stays visible
      // until another file is chosen or it is dismissed.
      setParsed(null);
      setMode("merge");
      setReplaceConfirmed(false);
      // An import can touch every feature (todos, subtasks, habits, routine,
      // notes, journal, goals, settings — plus derived stats / insights /
      // focus / review / search), so invalidate ALL queries — the robust
      // and simplest option after a full restore.
      void queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(error.message || "Import failed — please try again");
    },
  });

  const isImporting = importBackup.isPending;

  const openPicker = () => {
    if (!isImporting) fileInputRef.current?.click();
  };

  const handleFile = (file: File | undefined | null) => {
    if (!file || isImporting) return;
    setResult(null); // choosing a new file clears the previous outcome
    if (file.size > MAX_BACKUP_BYTES) {
      toast.error("File too large — backups up to 20 MB are supported");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast.error("Could not read the file — try again");
    reader.onload = () => {
      let json: unknown;
      try {
        json = JSON.parse(String(reader.result ?? ""));
      } catch {
        toast.error("Invalid JSON file");
        return;
      }
      if (
        !isRecord(json) ||
        !BACKUP_ARRAY_KEYS.some((key) => Array.isArray(json[key]))
      ) {
        toast.error("Not a Momentum backup file");
        return;
      }
      setParsed({
        fileName: file.name,
        sizeLabel: formatBytes(file.size),
        exportedAt: friendlyTimestamp(json.exportedAt),
        data: json,
        preview: [
          { label: "tasks", count: arrayCount(json, "todos") },
          { label: "subtasks", count: arrayCount(json, "subtasks") },
          { label: "habits", count: arrayCount(json, "habits") },
          { label: "routine", count: arrayCount(json, "routineTasks") },
          { label: "notes", count: arrayCount(json, "notes") },
          { label: "journal", count: arrayCount(json, "journal") },
          { label: "goals", count: arrayCount(json, "goals") },
        ].filter((p) => p.count > 0),
      });
      setMode("merge");
      setReplaceConfirmed(false);
    };
    reader.readAsText(file);
  };

  const clearFile = () => {
    setParsed(null);
    setMode("merge");
    setReplaceConfirmed(false);
  };

  const canImport =
    parsed !== null && !isImporting && (mode === "merge" || replaceConfirmed);

  return (
    <Card className="rounded-2xl py-0 shadow-card">
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="size-4.5 text-primary" aria-hidden="true" />
          Import &amp; restore
        </CardTitle>
        <CardDescription>
          Restore a Momentum JSON backup — merge it in, or replace everything.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-2">
        {/* Drop / pick zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a backup file, or drop one here"
          aria-disabled={isImporting}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:border-primary/50 hover:bg-primary/5",
            dragging && "border-primary bg-primary/5",
            isImporting && "pointer-events-none opacity-60"
          )}
        >
          <FileJson className="size-8 text-primary" aria-hidden="true" />
          <p className="mt-1 text-sm font-semibold">
            {parsed ? "Choose a different backup" : "Drag & drop a backup file"}
          </p>
          <p className="text-xs text-muted-foreground">or</p>
          <span className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm">
            Choose backup file
          </span>
          <p className="mt-1.5 text-[11px] text-muted-foreground/80">
            JSON backups from “Backup (JSON)” · up to 20 MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-picking the same file
              handleFile(file);
            }}
          />
        </div>

        {/* Parsed backup preview */}
        {parsed && (
          <div className="rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-start gap-3">
              <FileJson
                className="mt-0.5 size-4.5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={parsed.fileName}>
                  {parsed.fileName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {parsed.exportedAt ? `Exported ${parsed.exportedAt} · ` : ""}
                  {parsed.sizeLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-lg text-muted-foreground"
                onClick={clearFile}
                aria-label="Remove selected backup file"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {parsed.preview.length > 0 ? (
                parsed.preview.map((p) => (
                  <Badge
                    key={p.label}
                    variant="secondary"
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  >
                    {p.count} {p.label}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">
                  No items found in this backup.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Mode selector */}
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            setMode(v === "replace" ? "replace" : "merge");
            setReplaceConfirmed(false);
          }}
          disabled={isImporting}
          className="grid gap-2.5"
          aria-label="Import mode"
        >
          <label
            htmlFor="import-mode-merge"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
              mode === "merge"
                ? "border-emerald-500/60 bg-emerald-500/5"
                : "hover:bg-muted/40"
            )}
          >
            <RadioGroupItem value="merge" id="import-mode-merge" className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                <Merge
                  className="size-4 text-emerald-600 dark:text-emerald-400"
                  aria-hidden="true"
                />
                Merge
                <span className="rounded-full bg-emerald-500/10 px-2 py-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Safe
                </span>
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Add only items that don&apos;t already exist. Nothing you have
                today is changed or overwritten.
              </span>
            </span>
          </label>

          <label
            htmlFor="import-mode-replace"
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
              mode === "replace"
                ? "border-destructive/60 bg-destructive/5"
                : "hover:bg-muted/40"
            )}
          >
            <RadioGroupItem value="replace" id="import-mode-replace" className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                <TriangleAlert
                  className="size-4 text-rose-600 dark:text-rose-400"
                  aria-hidden="true"
                />
                Replace
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                Delete{" "}
                <strong className="font-semibold text-foreground">
                  all current data
                </strong>{" "}
                and restore this backup exactly as it was. This cannot be undone.
              </span>
            </span>
          </label>
        </RadioGroup>

        {/* Extra explicit confirmation for the destructive mode */}
        {mode === "replace" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3.5">
            <Checkbox
              id="import-replace-confirm"
              checked={replaceConfirmed}
              onCheckedChange={(checked) => setReplaceConfirmed(checked === true)}
              disabled={isImporting}
              className="mt-0.5"
            />
            <Label
              htmlFor="import-replace-confirm"
              className="cursor-pointer text-xs font-normal leading-relaxed text-destructive"
            >
              I understand{" "}
              <strong className="font-semibold">
                all current data will be deleted
              </strong>{" "}
              — tasks, habits, routine, notes, journal and goals — before this
              backup is restored.
            </Label>
          </div>
        )}

        {/* Primary action */}
        <Button
          type="button"
          size="lg"
          variant={mode === "replace" ? "destructive" : "default"}
          onClick={() => importBackup.mutate()}
          disabled={!canImport}
          className="w-full rounded-xl"
          aria-label={
            mode === "replace"
              ? "Delete all data and restore this backup"
              : "Import backup"
          }
        >
          {isImporting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {isImporting
            ? "Importing…"
            : mode === "replace"
              ? "Delete everything & restore backup"
              : "Import backup"}
        </Button>

        {/* Success panel */}
        {result && (
          <div
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3.5"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {result.mode === "replace" ? "Backup restored" : "Backup merged"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {formatImportCounts(result.counts)}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
                  Everything refreshes automatically — switch to Tasks, Notes,
                  Diary or Insights to see it.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-lg text-muted-foreground"
                onClick={() => setResult(null)}
                aria-label="Dismiss import result"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* Privacy hint */}
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          Your data stays on this device — backups are plain JSON files you
          control.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Main view ────────────────────────────────────────────────

export function SettingsView() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, isError, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const [permission, setPermission] = React.useState<
    NotificationPermission | "unsupported" | "unknown"
  >("unknown");
  const [exporting, setExporting] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  // ── Mutations ──

  const updateSettings = useMutation({
    mutationFn: (vars: { patch: Partial<AppSettings>; message?: string }) =>
      settingsApi.update(vars.patch),
    onMutate: async ({ patch }) => {
      await queryClient.cancelQueries({ queryKey: ["settings"] });
      const previous = queryClient.getQueryData<AppSettings>(["settings"]);
      if (previous) {
        queryClient.setQueryData<AppSettings>(["settings"], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["settings"], context.previous);
      }
      toast.error(error.message || "Could not save setting");
    },
    onSuccess: (_result, vars) => {
      toast.success(vars.message ?? "Setting saved");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  // ── Handlers ──

  const handleNotificationsToggle = async (checked: boolean) => {
    if (!checked) {
      updateSettings.mutate({
        patch: { notificationsEnabled: false },
        message: "Notifications disabled",
      });
      return;
    }
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result !== "granted") {
      toast.error(
        result === "unsupported"
          ? "Notifications aren't supported in this browser"
          : "Notification permission was denied — enable it in your browser settings"
      );
      return;
    }
    updateSettings.mutate({
      patch: { notificationsEnabled: true },
      message: "Notifications enabled",
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
      toast.error(e instanceof Error ? e.message : `${label} failed`, { id: toastId });
    } finally {
      setExporting(null);
    }
  };

  const exportAllMarkdown = () =>
    runExport("all-md", "Markdown export", async () => {
      const md = await exportApi.markdown("all");
      downloadMarkdown(md, "momentum-export.md");
    });

  const backupJson = () =>
    runExport("json", "JSON backup", async () => {
      const json = await exportApi.json();
      downloadJson(json, "momentum-backup.json");
    });

  const exportPdf = () =>
    runExport("pdf", "PDF export", async () => {
      const md = await exportApi.markdown("all");
      printHtml("Complete Export", miniMarkdownToHtml(md));
    });

  const exportDiary = () =>
    runExport("diary", "Diary export", async () => {
      const md = await exportApi.markdown("journal");
      downloadMarkdown(md, "momentum-diary.md");
    });

  const exportTasks = () =>
    runExport("tasks", "Tasks export", async () => {
      const md = await exportApi.markdown("tasks");
      downloadMarkdown(md, "momentum-tasks.md");
    });

  const exportNotes = () =>
    runExport("notes", "Notes export", async () => {
      const md = await exportApi.markdown("notes");
      downloadMarkdown(md, "momentum-notes.md");
    });

  const permissionLabel =
    permission === "unknown"
      ? "…"
      : permission === "granted"
        ? "granted"
        : permission === "denied"
          ? "denied"
          : permission === "unsupported"
            ? "not supported"
            : "default (not asked)";

  const permissionClasses =
    permission === "granted"
      ? "text-emerald-600 dark:text-emerald-400"
      : permission === "denied" || permission === "unsupported"
        ? "text-destructive"
        : "text-muted-foreground";

  const viewOptions =
    settings && !START_VIEW_OPTIONS.some((o) => o.value === settings.defaultView)
      ? [
          ...START_VIEW_OPTIONS,
          { value: settings.defaultView, label: settings.defaultView },
        ]
      : START_VIEW_OPTIONS;

  // ── Render ──

  return (
    <div>
      <ViewHeader title="Settings" subtitle="Make Momentum yours" />

      {isLoading ? (
        <SettingsSkeleton />
      ) : isError || !settings ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-4">
          {/* ── Notifications ── */}
          <Card className="rounded-2xl py-0 shadow-card">
            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="size-4.5 text-primary" aria-hidden="true" />
                Notifications
              </CardTitle>
              <CardDescription>
                Gentle nudges for tasks, habits and routines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 p-4 pt-2 sm:p-6 sm:pt-2">
              <div className="flex items-center justify-between gap-4 rounded-xl px-1 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="setting-notifications" className="text-sm">
                    Browser notifications
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Permission:{" "}
                    <span className={cn("font-medium", permissionClasses)}>
                      {permissionLabel}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    Reminders fire while the app is open.
                  </p>
                </div>
                <Switch
                  id="setting-notifications"
                  checked={settings.notificationsEnabled}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) => void handleNotificationsToggle(checked)}
                  aria-label="Browser notifications"
                />
              </div>

              <Separator className="my-1" />

              <div className="flex items-center justify-between gap-4 rounded-xl px-1 py-2.5">
                <div className="min-w-0">
                  <Label htmlFor="setting-sound" className="text-sm">
                    Sound effects
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A little audio feedback when you complete things.
                  </p>
                </div>
                <Switch
                  id="setting-sound"
                  checked={settings.soundEnabled}
                  disabled={updateSettings.isPending}
                  onCheckedChange={(checked) =>
                    updateSettings.mutate({
                      patch: { soundEnabled: checked },
                      message: checked ? "Sound effects on" : "Sound effects off",
                    })
                  }
                  aria-label="Sound effects"
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Preferences ── */}
          <Card className="rounded-2xl py-0 shadow-card">
            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <SettingsIcon className="size-4.5 text-primary" aria-hidden="true" />
                Preferences
              </CardTitle>
              <CardDescription>Small tweaks with a big daily impact.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-2 sm:p-6 sm:pt-2">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="setting-week-start">Week starts on</Label>
                  <Select
                    value={String(settings.weekStartsOn)}
                    onValueChange={(v) =>
                      updateSettings.mutate({
                        patch: { weekStartsOn: Number.parseInt(v, 10) },
                        message: `Week starts on ${v === "0" ? "Sunday" : "Monday"}`,
                      })
                    }
                  >
                    <SelectTrigger
                      id="setting-week-start"
                      className="h-11 w-full rounded-xl"
                    >
                      <SelectValue placeholder="Choose a day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1" className="py-2.5">
                        Monday
                      </SelectItem>
                      <SelectItem value="0" className="py-2.5">
                        Sunday
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Affects weekly summaries and the diary calendar.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setting-start-view">Start on view</Label>
                  <Select
                    value={settings.defaultView}
                    onValueChange={(v) =>
                      updateSettings.mutate({
                        patch: { defaultView: v },
                        message: `Starts on ${
                          viewOptions.find((o) => o.value === v)?.label ?? v
                        }`,
                      })
                    }
                  >
                    <SelectTrigger
                      id="setting-start-view"
                      className="h-11 w-full rounded-xl"
                    >
                      <SelectValue placeholder="Choose a view" />
                    </SelectTrigger>
                    <SelectContent>
                      {viewOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="py-2.5">
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Where Momentum opens each time.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Data & export ── */}
          <Card className="rounded-2xl py-0 shadow-card">
            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DatabaseBackup className="size-4.5 text-primary" aria-hidden="true" />
                Export data
              </CardTitle>
              <CardDescription>
                Your data lives on this device&apos;s database. Take it anywhere.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 sm:p-6 sm:pt-2">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <ExportButton
                  id="all-md"
                  icon={FileText}
                  label="Export all (Markdown)"
                  busy={exporting}
                  onRun={exportAllMarkdown}
                />
                <ExportButton
                  id="json"
                  icon={DatabaseBackup}
                  label="Backup (JSON)"
                  busy={exporting}
                  onRun={backupJson}
                />
                <ExportButton
                  id="pdf"
                  icon={Printer}
                  label="Export PDF"
                  busy={exporting}
                  onRun={exportPdf}
                />
                <ExportButton
                  id="diary"
                  icon={BookOpen}
                  label="Export diary only"
                  busy={exporting}
                  onRun={exportDiary}
                />
                <ExportButton
                  id="tasks"
                  icon={ListTodo}
                  label="Export tasks only"
                  busy={exporting}
                  onRun={exportTasks}
                />
                <ExportButton
                  id="notes"
                  icon={StickyNote}
                  label="Export notes only"
                  busy={exporting}
                  onRun={exportNotes}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Import & restore ── */}
          <ImportSection />

          {/* ── About ── */}
          <Card className="rounded-2xl py-0 shadow-card">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm"
                  aria-hidden="true"
                >
                  <Zap className="size-5.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold">Momentum</h3>
                    <Badge
                      variant="secondary"
                      className="rounded-full px-2 py-0 text-[10px] font-semibold"
                    >
                      v1.0
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                    A lightweight productivity companion — built to help you plan,
                    track, reflect and grow.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <Sparkles
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="sr-only">Built with</span>
                {TECH_CHIPS.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Icon-only affordance for muted permission states (a11y helper text) */}
          <p className="sr-only" aria-live="polite">
            {permission === "denied" && (
              <>Notification permission is denied in this browser.</>
            )}
            {permission === "unsupported" && (
              <>Notifications are not supported in this browser.</>
            )}
            {permission === "granted" && <>Notification permission is granted.</>}
          </p>
          {permission === "denied" && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm text-destructive" role="status">
              <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Notifications are blocked for this site. Re-enable them from the
                lock icon in your browser&apos;s address bar, then toggle the switch
                again.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
