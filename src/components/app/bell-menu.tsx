"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRing, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { habitsApi, todosApi } from "@/lib/api";
import { todayKey } from "@/lib/dates";
import {
  notificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";
import { useUiStore } from "@/lib/store";
import type { ViewId } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function BellMenu() {
  const [open, setOpen] = React.useState(false);
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">("default");
  const setView = useUiStore((s) => s.setView);

  React.useEffect(() => {
    setPermission(notificationPermission());
  }, [open]);

  const { data: todos = [] } = useQuery({
    queryKey: ["todos", "all"],
    queryFn: () => todosApi.list({ status: "active" }),
    enabled: open,
  });

  const { data: habits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: habitsApi.list,
    enabled: open,
  });

  const todayStart = new Date(`${todayKey()}T00:00:00`).getTime();
  const overdue = todos.filter(
    (t) => t.dueDate && new Date(t.dueDate).getTime() < todayStart
  );
  const dueToday = todos.filter(
    (t) => t.dueDate && t.dueDate.slice(0, 10) === todayKey()
  );
  const pendingHabits = habits.filter((h) => !h.doneToday);

  const attentionCount = overdue.length + (dueToday.length > 0 ? 0 : 0);

  const go = (view: ViewId) => {
    setOpen(false);
    setView(view);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${attentionCount ? `, ${attentionCount} overdue` : ""}`}
          className="relative size-10 rounded-xl"
        >
          {attentionCount > 0 ? (
            <BellRing className="size-5" />
          ) : (
            <Bell className="size-5" />
          )}
          {attentionCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {attentionCount > 9 ? "9+" : attentionCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            Reminders & what needs attention
          </p>
        </div>

        {permission === "default" && (
          <div className="border-b bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Turn on browser notifications for task & habit reminders.
            </p>
            <Button
              size="sm"
              className="mt-2 h-8 w-full"
              onClick={async () => {
                const result = await requestNotificationPermission();
                setPermission(result);
                if (result === "granted") {
                  toast.success("Notifications enabled");
                } else if (result !== "unsupported") {
                  toast.info("Notifications were not enabled");
                }
              }}
            >
              Enable notifications
            </Button>
          </div>
        )}

        <div className="max-h-80 overflow-y-auto">
          {overdue.length > 0 && (
            <section className="border-b">
              <SectionLabel label={`Overdue · ${overdue.length}`} tone="danger" />
              <ul>
                {overdue.slice(0, 4).map((t) => (
                  <NotificationRow
                    key={t.id}
                    icon={<Clock className="size-4 text-destructive" />}
                    title={t.title}
                    sub="Past due"
                    onClick={() => go("tasks")}
                  />
                ))}
              </ul>
            </section>
          )}

          {dueToday.length > 0 && (
            <section className="border-b">
              <SectionLabel label={`Due today · ${dueToday.length}`} tone="warn" />
              <ul>
                {dueToday.slice(0, 4).map((t) => (
                  <NotificationRow
                    key={t.id}
                    icon={<Clock className="size-4 text-amber-500" />}
                    title={t.title}
                    sub="Scheduled for today"
                    onClick={() => go("tasks")}
                  />
                ))}
              </ul>
            </section>
          )}

          {pendingHabits.length > 0 && (
            <section className="border-b">
              <SectionLabel
                label={`Habits remaining · ${pendingHabits.length}`}
                tone="ok"
              />
              <ul>
                {pendingHabits.slice(0, 4).map((h) => (
                  <NotificationRow
                    key={h.id}
                    icon={<span className="text-base leading-none">{h.emoji}</span>}
                    title={h.name}
                    sub={h.reminderTime ? `Reminder ${h.reminderTime}` : "Not done yet today"}
                    onClick={() => go("routine")}
                  />
                ))}
              </ul>
            </section>
          )}

          {overdue.length === 0 && dueToday.length === 0 && pendingHabits.length === 0 && (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <CheckCircle2 className="size-8 text-primary" />
              <p className="mt-2 text-sm font-medium">All clear!</p>
              <p className="text-xs text-muted-foreground">
                Nothing overdue — have a great day.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SectionLabel({
  label,
  tone,
}: {
  label: string;
  tone: "danger" | "warn" | "ok";
}) {
  return (
    <p
      className={cn(
        "px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide",
        tone === "danger" && "text-destructive",
        tone === "warn" && "text-amber-600 dark:text-amber-400",
        tone === "ok" && "text-primary"
      )}
    >
      {label}
    </p>
  );
}

function NotificationRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{sub}</span>
        </span>
      </button>
    </li>
  );
}
