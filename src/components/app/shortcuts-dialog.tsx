"use client";

// Keyboard shortcuts help dialog — opened with "?" from the app shell.
// Documents ONLY the bindings that actually exist:
//   ⌘K / Ctrl+K  command palette  (command-palette.tsx global listener)
//   n            quick add        (app-shell.tsx global listener)
//   ?            this help        (app-shell.tsx global listener)
//   Esc          close dialogs    (Radix Dialog/Sheet built-in)
//   ↑ ↓ / ↵      palette list     (cmdk built-in)

import * as React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Small keycap chip. */
function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground shadow-sm",
        className
      )}
    >
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

function ShortcutRow({ label, keys }: { label: React.ReactNode; keys: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="min-w-0 text-sm text-foreground/90">{label}</span>
      <span className="flex shrink-0 items-center gap-1">{keys}</span>
    </div>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="divide-y divide-border/70">{children}</div>
    </section>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
  onReplayTour,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplayTour: () => void;
}) {
  const isMac = useIsMac();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        {/* Header */}
        <DialogHeader className="flex shrink-0 flex-row items-center gap-3 border-b px-5 py-4 text-left sm:px-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Keyboard className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg">Keyboard shortcuts</DialogTitle>
            <DialogDescription className="mt-0.5">
              Keep your hands on the keyboard — Momentum has you covered.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6">
          <ShortcutGroup title="Anywhere">
            <ShortcutRow
              label="Open the command palette"
              keys={
                <>
                  <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                  <Kbd>K</Kbd>
                </>
              }
            />
            <ShortcutRow
              label="Quick add a task, note or diary entry"
              keys={<Kbd>N</Kbd>}
            />
            <ShortcutRow label="Show this help" keys={<Kbd>?</Kbd>} />
            <ShortcutRow
              label="Close dialogs, sheets and menus"
              keys={<Kbd>Esc</Kbd>}
            />
          </ShortcutGroup>

          <ShortcutGroup title="In the command palette">
            <ShortcutRow
              label="Move through results"
              keys={
                <>
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </>
              }
            />
            <ShortcutRow
              label="Choose the highlighted result"
              keys={<Kbd>↵ Enter</Kbd>}
            />
          </ShortcutGroup>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-center border-t px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onReplayTour}
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            Replay the welcome tour →
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
