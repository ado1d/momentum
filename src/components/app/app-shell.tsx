"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Menu, Monitor, Moon, Plus, Search, Sun, Zap } from "lucide-react";
import { MOBILE_MORE_NAV, MOBILE_PRIMARY_NAV, NAV_ITEMS } from "./nav-config";
import { CommandPalette } from "./command-palette";
import { OnboardingTour } from "./onboarding-tour";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { settingsApi } from "@/lib/api";
import { UserMenu } from "@/components/auth/user-menu";
import { useUiStore } from "@/lib/store";
import type { ViewId } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BellMenu } from "./bell-menu";
import { OfflineBadge } from "./offline-badge";

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      className="size-9 rounded-xl"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {!mounted ? (
        <Monitor className="size-4" />
      ) : resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Zap className="size-5" aria-hidden="true" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-base font-extrabold tracking-tight">Momentum</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Productivity companion
          </p>
        </div>
      )}
    </div>
  );
}

/** Desktop sidebar navigation */
function SidebarNav({ view, onNavigate }: { view: ViewId; onNavigate: (v: ViewId) => void }) {
  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-4.5 shrink-0 transition-transform group-hover:scale-110",
                active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
              )}
              aria-hidden="true"
            />
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Mobile bottom navigation */
function BottomNav({ view, onNavigate, onMore }: { view: ViewId; onNavigate: (v: ViewId) => void; onMore: () => void }) {
  const moreActive = ["notes", "diary", "settings"].includes(view);
  return (
    <nav
      aria-label="Primary navigation"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {MOBILE_PRIMARY_NAV.map((id) => {
          const item = NAV_ITEMS.find((n) => n.id === id)!;
          const Icon = item.icon;
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors"
            >
              <span
                className={cn(
                  "flex h-7 items-center rounded-full px-4 transition-all",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span
                className={cn(
                  "text-[10px] font-semibold",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-current={moreActive ? "page" : undefined}
          aria-label="More"
          className={cn(
            "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 transition-colors"
          )}
        >
          <span
            className={cn(
              "flex h-7 items-center rounded-full px-4 transition-all",
              moreActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </span>
          <span
            className={cn(
              "text-[10px] font-semibold",
              moreActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            More
          </span>
        </button>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const setQuickAddOpen = useUiStore((s) => s.setQuickAddOpen);
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);
  const [tourOpen, setTourOpen] = React.useState(false);
  const queryClient = useQueryClient();

  const navigate = (v: ViewId) => {
    setView(v);
    setMoreOpen(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  // Global "?" opens the shortcuts help; "n" opens quick add.
  // Ignored while typing, when a modifier is held, or while any dialog,
  // sheet, menu or listbox is open (⌘K / Esc stay global).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (typing) return;
      if (
        document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"], [data-state="open"][role="menu"], [data-state="open"][role="listbox"]'
        )
      )
        return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setQuickAddOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setQuickAddOpen]);

  // First run: open the welcome tour until settings.onboarded is true.
  const tourChecked = React.useRef(false);
  React.useEffect(() => {
    if (tourChecked.current) return;
    tourChecked.current = true;
    settingsApi
      .get()
      .then((s) => {
        if (!s.onboarded) setTourOpen(true);
      })
      .catch(() => {
        /* Failed check — never nag. */
      });
  }, []);

  // Completing (or dismissing) the tour marks the user as onboarded.
  // The dialog itself is closed by OnboardingTour via onOpenChange.
  const completeTour = () => {
    settingsApi
      .update({ onboarded: true })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["settings"] });
      })
      .catch(() => {
        toast.error("Couldn't save that you've seen the tour — it may appear again.");
      });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Brand />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              className="size-10 rounded-xl"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="size-5" />
            </Button>
            <BellMenu />
            <Button
              size="icon"
              aria-label="Quick add"
              className="size-10 rounded-xl"
              onClick={() => setQuickAddOpen(true)}
            >
              <Plus className="size-5" />
            </Button>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r bg-sidebar px-4 py-5 lg:flex">
          <div>
            <div className="px-2 pb-6">
              <Brand />
            </div>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open search"
              className="mb-3 flex w-full items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="pointer-events-none hidden items-center justify-center rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground sm:inline-flex">
                ⌘K
              </kbd>
            </button>
            <SidebarNav view={view} onNavigate={navigate} />
          </div>
          <div className="relative overflow-hidden rounded-2xl border bg-card px-3 py-3">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-6 -top-8 size-20 rounded-full bg-primary/10 blur-2xl"
            />
            {/* Account row: avatar menu (name/email/sign out) + theme toggle */}
            <div className="relative mb-2.5 flex items-center justify-between gap-2 border-b pb-2.5">
              <UserMenu />
              <ThemeToggle />
            </div>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => navigate("insights")}
                aria-label="Stay consistent — view your insights"
                className="group -mx-1 rounded-lg px-1 py-0.5 text-left leading-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <p className="text-xs font-semibold">Stay consistent</p>
                <p className="text-[10px] text-muted-foreground transition-colors group-hover:text-primary/80">
                  Small steps, big results →
                </p>
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-4xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:pb-10 lg:pt-8">
            {children}
          </div>
        </main>
      </div>

      <BottomNav view={view} onNavigate={navigate} onMore={() => setMoreOpen(true)} />

      {/* Mobile "More" sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8 pt-3">
          <SheetHeader className="pb-1 text-left">
            <SheetTitle className="text-base">More</SheetTitle>
            <SheetDescription className="sr-only">
              Notes, diary and settings
            </SheetDescription>
          </SheetHeader>
          <div className="mt-2 grid gap-2">
            {MOBILE_MORE_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted/60"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
            <div className="mt-1 flex items-center justify-between rounded-xl border bg-card px-4 py-3">
              <span className="text-sm font-medium">Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Global search / command palette (⌘K) */}
      <CommandPalette
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenTour={() => setTourOpen(true)}
      />

      {/* Keyboard shortcuts help (?) */}
      <ShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        onReplayTour={() => {
          setShortcutsOpen(false);
          setTourOpen(true);
        }}
      />

      {/* First-run welcome tour */}
      <OnboardingTour
        open={tourOpen}
        onOpenChange={setTourOpen}
        onComplete={completeTour}
      />

      {/* Offline indicator (fixed bottom-left, shown when disconnected) */}
      <OfflineBadge />
    </div>
  );
}
