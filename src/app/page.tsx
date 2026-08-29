"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { QuickAddDialog } from "@/components/app/quick-add";
import { NotificationEngine } from "@/components/app/notification-engine";
import { PushManager } from "@/components/app/push-manager";
import { LoginScreen } from "@/components/auth/login-screen";
import { useUiStore } from "@/lib/store";

// Lazy-load every view so the initial payload stays small on phones.
const DashboardView = dynamic(
  () => import("@/components/app/views/dashboard-view").then((m) => m.DashboardView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const FocusView = dynamic(
  () => import("@/components/app/views/focus-view").then((m) => m.FocusView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const TasksView = dynamic(
  () => import("@/components/app/views/tasks-view").then((m) => m.TasksView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const RoutineView = dynamic(
  () => import("@/components/app/views/routine-view").then((m) => m.RoutineView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const GoalsView = dynamic(
  () => import("@/components/app/views/goals-view").then((m) => m.GoalsView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const NotesView = dynamic(
  () => import("@/components/app/views/notes-view").then((m) => m.NotesView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const DiaryView = dynamic(
  () => import("@/components/app/views/diary-view").then((m) => m.DiaryView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const InsightsView = dynamic(
  () => import("@/components/app/views/insights-view").then((m) => m.InsightsView),
  { ssr: false, loading: () => <ViewLoading /> }
);
const SettingsView = dynamic(
  () => import("@/components/app/views/settings-view").then((m) => m.SettingsView),
  { ssr: false, loading: () => <ViewLoading /> }
);

function ViewLoading() {
  return (
    <div className="space-y-4 pt-2" aria-busy="true" aria-label="Loading view">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-40 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

/** Tiny splash while next-auth decides whether there's a session — same
 *  Zap mark + wordmark the login screen shows, so the loading → login
 *  transition never jumps. */
function SplashScreen() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background"
      aria-busy="true"
      aria-label="Loading Momentum"
    >
      <div className="glow-ring flex size-14 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Zap className="size-7" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold tracking-tight">Momentum</p>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") return <SplashScreen />;
  if (!session) return <LoginScreen />;
  return <AuthenticatedApp userId={session.user.id} />;
}

/** The whole SPA — only ever mounted while a session exists. */
function AuthenticatedApp({ userId }: { userId: string }) {
  const view = useUiStore((s) => s.view);
  const [mounted, setMounted] = React.useState(false);
  const queryClient = useQueryClient();
  React.useEffect(() => setMounted(true), []);

  // Session-change cache hygiene: wipe the TanStack cache when the signed-in
  // user changes (login as someone else without a full reload) AND on mount,
  // so user A's cached data can never flash for user B.
  React.useEffect(() => {
    queryClient.clear();
  }, [queryClient, userId]);

  return (
    <AppShell>
      <NotificationEngine />
      {/* Server-push upkeep: subscribes this device when permission is granted,
          reports timezone, triggers the morning digest on app-open. */}
      <PushManager />
      <QuickAddDialog />
      {!mounted ? (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="flex size-14 animate-pulse items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Zap className="size-7" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">Warming up Momentum…</p>
        </div>
      ) : (
        <div key={view} className="view-enter">
          {view === "dashboard" && <DashboardView />}
          {view === "focus" && <FocusView />}
          {view === "tasks" && <TasksView />}
          {view === "routine" && <RoutineView />}
          {view === "goals" && <GoalsView />}
          {view === "notes" && <NotesView />}
          {view === "diary" && <DiaryView />}
          {view === "insights" && <InsightsView />}
          {view === "settings" && <SettingsView />}
        </div>
      )}
    </AppShell>
  );
}
