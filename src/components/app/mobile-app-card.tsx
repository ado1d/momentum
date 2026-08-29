"use client";

// MobileAppCard — Settings card for the installed-app experience:
//   • Install status + one-tap install (Android/Chrome) or step-by-step
//     "Add to Home Screen" instructions (iOS Safari).
//   • Push notification enrollment + a "Send test notification" button.
//
// Honest platform notes baked into the copy: push to CLOSED apps needs the
// PWA installed (Android Chrome; iOS 16.4+ installed to the home screen).

import * as React from "react";
import { toast } from "sonner";
import { BellRing, CheckCircle2, Download, Send, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { requestNotificationPermission } from "@/lib/notifications";
import { ensurePushSubscription } from "@/lib/push-client";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = React.useState(false);
  const [isIosSafari, setIsIosSafari] = React.useState(false);

  React.useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);

    const ua = navigator.userAgent;
    const iosDevice = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document);
    // iOS in-app browsers (Chrome/Edge on iOS) can't install PWAs — only Safari.
    const looksLikeSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
    setIsIosSafari(iosDevice && looksLikeSafari && !standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setPromptEvent(null);
      return true;
    }
    return false;
  }, [promptEvent]);

  return { canInstall: Boolean(promptEvent) && !installed, installed, isIosSafari, promptInstall };
}

function usePushState() {
  const [subscribed, setSubscribed] = React.useState<boolean | null>(null); // null = unknown

  React.useEffect(() => {
    let alive = true;
    const check = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (alive) setSubscribed(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (alive) setSubscribed(Boolean(existing));
      } catch {
        if (alive) setSubscribed(false);
      }
    };
    void check();
    const interval = setInterval(() => void check(), 10_000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  return { subscribed, setSubscribed };
}

function statusPill(ok: boolean | null, labelOk: string, labelOff: string) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        ok === true
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : ok === false
            ? "bg-muted text-muted-foreground"
            : "bg-muted text-muted-foreground",
      )}
    >
      {ok === true ? <CheckCircle2 className="size-3" aria-hidden="true" /> : null}
      {ok === true ? labelOk : labelOff}
    </span>
  );
}

export function MobileAppCard() {
  const { canInstall, installed, isIosSafari, promptInstall } = useInstallPrompt();
  const { subscribed, setSubscribed } = usePushState();
  const [busy, setBusy] = React.useState<"enable" | "test" | "install" | null>(null);

  const handleInstall = async () => {
    setBusy("install");
    try {
      const accepted = await promptInstall();
      if (!accepted) toast.info("You can install anytime from your browser's menu → \"Install app\"");
    } finally {
      setBusy(null);
    }
  };

  const handleEnablePush = async () => {
    setBusy("enable");
    try {
      const perm = await requestNotificationPermission();
      if (perm !== "granted") {
        toast.error(
          perm === "unsupported"
            ? "This browser doesn't support notifications"
            : "Notification permission denied — allow it in your browser/site settings, then retry",
          { duration: 7000 },
        );
        return;
      }
      const result = await ensurePushSubscription();
      if (result === "subscribed") {
        setSubscribed(true);
        toast.success("Push reminders enabled on this device 🎉");
      } else if (result === "no-key" || result === "error") {
        toast.error("Couldn't reach the notification service — try again in a moment");
      } else {
        toast.error("Push isn't available in this browser");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleTestPush = async () => {
    setBusy("test");
    const toastId = toast.loading("Sending test notification…");
    try {
      const res = await fetch("/api/push/test", { method: "POST", cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { sent: number; failed: number };
      if (data.sent > 0) {
        toast.success("Test notification sent — check your notifications!", { id: toastId });
      } else {
        toast.warning(
          "No device received it — make sure this device is enrolled below and the app is installed",
          { id: toastId, duration: 7000 },
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Test failed", { id: toastId });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-2xl py-0 shadow-card">
      <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="size-4.5 text-primary" aria-hidden="true" />
          Mobile app
        </CardTitle>
        <CardDescription>
          Install Momentum on your phone — it works offline and can notify you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2 sm:p-6 sm:pt-2">
        {/* ── Install ── */}
        {installed ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Momentum is installed on this device</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Launch it from your home screen for the full app experience.
              </p>
            </div>
          </div>
        ) : canInstall ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Install the app</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Full-screen, offline-ready, lives on your home screen.
              </p>
            </div>
            <Button size="sm" className="rounded-xl" onClick={() => void handleInstall()} disabled={busy === "install"}>
              <Download className="size-4" aria-hidden="true" />
              {busy === "install" ? "Installing…" : "Install app"}
            </Button>
          </div>
        ) : isIosSafari ? (
          <div className="rounded-xl border px-4 py-3">
            <p className="text-sm font-semibold">Install on iPhone / iPad</p>
            <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                Tap the <Share className="inline size-3.5 align-[-2px]" aria-hidden="true" /> <span className="font-medium">Share</span> button in Safari&apos;s toolbar
              </li>
              <li className="flex gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                Scroll down and choose <span className="font-medium">Add to Home Screen</span>
              </li>
              <li className="flex gap-2">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                Tap <span className="font-medium">Add</span> — then launch Momentum from your home screen
              </li>
            </ol>
          </div>
        ) : (
          <div className="rounded-xl border px-4 py-3">
            <p className="text-sm font-semibold">Install the app</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Look for <span className="font-medium">“Install app”</span> / <span className="font-medium">“Add to Home screen”</span> in your browser menu.
            </p>
          </div>
        )}

        <Separator />

        {/* ── Push ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <BellRing className="size-4 text-primary" aria-hidden="true" />
              Push reminders
              {statusPill(subscribed, "On", "Off")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A morning summary and reminders — even when the app is closed.
            </p>
          </div>
          <div className="flex gap-2">
            {subscribed ? (
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl"
                onClick={() => void handleTestPush()}
                disabled={busy === "test"}
              >
                <Send className="size-3.5" aria-hidden="true" />
                {busy === "test" ? "Sending…" : "Send test"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => void handleEnablePush()}
                disabled={busy === "enable"}
              >
                <BellRing className="size-4" aria-hidden="true" />
                {busy === "enable" ? "Enabling…" : "Enable push"}
              </Button>
            )}
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">
          On iPhone, push requires Momentum to be installed to the home screen
          (iOS 16.4 or newer). On Android, install it or use Chrome.
        </p>
      </CardContent>
    </Card>
  );
}
