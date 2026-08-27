"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  BookOpen,
  DatabaseBackup,
  FileText,
  Loader2,
  ListTodo,
  Printer,
  Settings as SettingsIcon,
  Sparkles,
  StickyNote,
  TriangleAlert,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { exportApi, settingsApi } from "@/lib/api";
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
import type { AppSettings } from "@/lib/types";
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
                Data &amp; export
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
