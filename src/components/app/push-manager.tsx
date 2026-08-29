"use client";

// PushManager — invisible component mounted inside the authenticated app.
//
// Keeps this device subscribed to server push notifications:
//   • subscribes (silently, no permission prompt) whenever notification
//     permission is already granted — on mount, on window focus and on a
//     slow poll, so granting permission from the bell menu or Settings
//     eventually enrolls the device even without a page reload
//   • reports the browser timezone to the server once a day (used to
//     schedule the morning digest at a sensible local hour)
//   • triggers the self morning digest on app-open (covers timezones the
//     fixed UTC cron slots miss; the server dedupes per user)

import * as React from "react";
import { useSession } from "next-auth/react";
import { ensurePushSubscription } from "@/lib/push-client";
import { useOnlineStatus } from "./pwa-register";

const TZ_SAVED_KEY = "momentum-tz-saved";
const DIGEST_DAY_KEY = "momentum-digest-day";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PushManager() {
  const { status } = useSession();
  const authed = status === "authenticated";
  const online = useOnlineStatus();
  const subscribedRef = React.useRef(false);

  // ── Subscription upkeep ────────────────────────────────────────────
  React.useEffect(() => {
    if (!authed || !online) return;
    const run = async () => {
      if (subscribedRef.current) return;
      const result = await ensurePushSubscription();
      if (result === "subscribed") subscribedRef.current = true;
    };
    void run();
    // Slow poll: catches permission granted after mount (bell menu /
    // Settings) without a reload. Cheap — one no-op after success.
    const interval = setInterval(() => void run(), 60_000);
    const onFocus = () => void run();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [authed, online]);

  // Reset when signing out so the next user re-subscribes.
  React.useEffect(() => {
    if (!authed) subscribedRef.current = false;
  }, [authed]);

  // ── Timezone report (daily) ────────────────────────────────────────
  React.useEffect(() => {
    if (!authed || !online) return;
    try {
      if (localStorage.getItem(TZ_SAVED_KEY) === todayKey()) return;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone) return;
      localStorage.setItem(TZ_SAVED_KEY, todayKey());
      void fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
        cache: "no-store",
      }).catch(() => undefined);
    } catch {
      /* localStorage unavailable — skip */
    }
  }, [authed, online]);

  // ── Morning digest on app-open ─────────────────────────────────────
  React.useEffect(() => {
    if (!authed || !online) return;
    try {
      const hour = new Date().getHours();
      if (hour < 6 || hour >= 11) return;
      if (localStorage.getItem(DIGEST_DAY_KEY) === todayKey()) return;
      localStorage.setItem(DIGEST_DAY_KEY, todayKey());
      void fetch("/api/push/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      }).catch(() => undefined);
    } catch {
      /* localStorage unavailable — skip */
    }
  }, [authed, online]);

  return null;
}
