"use client";

// First-run welcome tour — a simple, polished 4-step dialog (no spotlight).
// EVERY close path (finishing via "Let's get started", the X button, Esc or
// the overlay) goes through onComplete, so the tour is never shown uninvited
// again (settings.onboarded is patched by the parent).

import * as React from "react";
import { Flame, ShieldCheck, Sparkles, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Small inline keycap (matches shortcuts-dialog styling). */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}

/** True on Apple platforms (⌘ vs Ctrl). */
function useIsMac(): boolean {
  const [isMac, setIsMac] = React.useState(false);
  React.useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform));
  }, []);
  return isMac;
}

interface TourStep {
  icon: LucideIcon;
  tile: string;
  title: string;
  body: (isMac: boolean) => React.ReactNode;
}

const STEPS: TourStep[] = [
  {
    icon: Sparkles,
    tile: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-sm",
    title: "Welcome to Momentum",
    body: () =>
      "Your calm companion for habits, tasks, goals and reflection — all in one place.",
  },
  {
    icon: Zap,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    title: "Capture anything, fast",
    body: (isMac) => (
      <>
        Press <Kbd>n</Kbd> or the + button to add tasks, notes and journal entries
        without breaking your flow.{" "}
        <span className="whitespace-nowrap">
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd> <Kbd>K</Kbd>
        </span>{" "}
        opens the command palette to jump anywhere.
      </>
    ),
  },
  {
    icon: Flame,
    tile: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    title: "Build streaks that stick",
    body: () =>
      "Check off daily habits in Routine and watch your streaks grow. Small steps, big results.",
  },
  {
    icon: ShieldCheck,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    title: "Your data, your device",
    body: () =>
      "Everything lives in a local database you can export or back up anytime from Settings.",
  },
];

export function OnboardingTour({
  open,
  onOpenChange,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = React.useState(0);
  const isMac = useIsMac();
  const last = STEPS.length - 1;

  // Start from the beginning whenever the tour is (re)opened.
  React.useEffect(() => {
    if (!open) setStep(0);
  }, [open]);

  // Any close path — X, Esc, overlay, or finishing — counts as complete,
  // so the tour never nags.
  const close = () => {
    onComplete();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) onOpenChange(true);
    else close();
  };

  const next = () => {
    if (step < last) setStep(step + 1);
    else close();
  };

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        {/* Step body */}
        <div className="flex min-h-[264px] flex-1 items-center justify-center px-6 py-8 text-center">
          <div
            key={step}
            className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 flex-col items-center"
          >
            <div
              className={cn(
                "mb-5 flex size-14 items-center justify-center rounded-2xl",
                current.tile
              )}
            >
              <Icon className="size-7" aria-hidden="true" />
            </div>
            <p className="sr-only">
              Step {step + 1} of {STEPS.length}
            </p>
            <DialogTitle className="text-xl font-bold tracking-tight">
              {current.title}
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-[40ch] text-balance text-sm leading-relaxed">
              {current.body(isMac)}
            </DialogDescription>
          </div>
        </div>

        {/* Footer: step dots + navigation */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-5 py-4 sm:px-6">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              tabIndex={step === 0 ? -1 : undefined}
              className={cn(
                "rounded-xl",
                step === 0 && "pointer-events-none invisible"
              )}
            >
              Back
            </Button>
            <Button type="button" onClick={next} className="rounded-xl">
              {step === last ? "Let's get started" : "Next"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
