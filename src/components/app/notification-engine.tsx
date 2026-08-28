"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { habitsApi, routineApi, todosApi } from "@/lib/api";
import { computeDueReminders } from "@/lib/notifications";

/**
 * Invisible component: while the app is open, checks every 60s for
 * reminders that are due and fires browser notifications + toasts.
 * Polling is disabled while signed out (all APIs would 401).
 */
export function NotificationEngine() {
  const { status } = useSession();
  const authed = status === "authenticated";

  const { data: todos } = useQuery({
    queryKey: ["todos", "all"],
    queryFn: () => todosApi.list({ status: "active" }),
    enabled: authed,
    refetchInterval: authed ? 120_000 : false,
  });
  const { data: habits } = useQuery({
    queryKey: ["habits"],
    queryFn: habitsApi.list,
    enabled: authed,
    refetchInterval: authed ? 120_000 : false,
  });
  const { data: routine } = useQuery({
    queryKey: ["routine"],
    queryFn: routineApi.list,
    enabled: authed,
    refetchInterval: authed ? 120_000 : false,
  });

  const firedRef = React.useRef(0);

  React.useEffect(() => {
    if (!todos || !habits || !routine) return;
    const run = () => {
      const { notifications } = computeDueReminders(todos, habits, routine);
      for (const n of notifications) {
        if (firedRef.current >= 3) break;
        firedRef.current += 1;
        toast(`🔔 ${n.title}`, { description: n.body, duration: 8000 });
      }
    };
    run(); // initial check
    const interval = setInterval(run, 60_000);
    return () => clearInterval(interval);
  }, [todos, habits, routine]);

  // reset the per-cycle cap every minute
  React.useEffect(() => {
    const reset = setInterval(() => (firedRef.current = 0), 60_000);
    return () => clearInterval(reset);
  }, []);

  return null;
}
