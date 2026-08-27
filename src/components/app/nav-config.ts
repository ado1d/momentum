import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  ListTodo,
  Repeat,
  Settings,
  StickyNote,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import type { ViewId } from "@/lib/types";

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    description: "Your day at a glance",
  },
  {
    id: "focus",
    label: "Focus",
    icon: Timer,
    description: "Pomodoro deep-work timer",
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: ListTodo,
    description: "Todos & reminders",
  },
  {
    id: "routine",
    label: "Routine",
    icon: Repeat,
    description: "Daily habits & schedule",
  },
  {
    id: "goals",
    label: "Goals",
    icon: Target,
    description: "Daily, weekly & monthly goals",
  },
  {
    id: "notes",
    label: "Notes",
    icon: StickyNote,
    description: "Quick capture & ideas",
  },
  {
    id: "diary",
    label: "Diary",
    icon: BookOpen,
    description: "Daily journal & mood",
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    description: "Trends, streaks & analytics",
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    description: "Preferences, notifications & export",
  },
];

export const MOBILE_PRIMARY_NAV: ViewId[] = [
  "dashboard",
  "tasks",
  "routine",
  "goals",
];

export const MOBILE_MORE_NAV: NavItem[] = [
  NAV_ITEMS.find((n) => n.id === "focus")!,
  NAV_ITEMS.find((n) => n.id === "insights")!,
  NAV_ITEMS.find((n) => n.id === "notes")!,
  NAV_ITEMS.find((n) => n.id === "diary")!,
  NAV_ITEMS.find((n) => n.id === "settings")!,
];
