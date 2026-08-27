"use client";

import * as React from "react";

/**
 * PwaRegister — mounts once in the root layout, registers the Momentum
 * service worker (`/sw.js`) and renders no UI. Registration failures are
 * non-fatal (console.warn only): the app is fully functional without the
 * service worker, and in dev the Next HMR setup can be finicky.
 */
export default function PwaRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        // Non-fatal — offline caching simply stays unavailable.
        console.warn("[pwa] service worker registration failed:", error);
      });
    };

    try {
      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register, { once: true });
        return () => window.removeEventListener("load", register);
      }
    } catch (error) {
      console.warn("[pwa] service worker setup failed:", error);
    }
  }, []);

  return null;
}

/**
 * useOnlineStatus — SSR-safe connection awareness.
 * Starts optimistic (`true`) on the server and the first client render,
 * then syncs to `navigator.onLine` and tracks online/offline events.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
