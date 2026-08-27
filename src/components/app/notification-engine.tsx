"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { habitsApi, routineApi, todosApi } from "@/lib/api";
import { computeDueReminders } from "@/lib/notifications";

/**
 * Invisible component: while the app is open, checks every 60s for
 * reminders that are due and fires browser notifications + toasts.
 */
export function NotificationEngine() {
  const { data: todos } = useQuery({
    queryKey: ["todos", "all"],
    queryFn: () => todosApi.list({ status: "active" }),
    refetchInterval: 120_000,
  });
  const { data: habits } = useQuery({
    queryKey: ["habits"],
    queryFn: habitsApi.list,
    refetchInterval: 120_000,
  });
  const { data: routine } = useQuery({
    queryKey: ["routine"],
    queryFn: routineApi.list,
    refetchInterval: 120_000,
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
