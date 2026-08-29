"use client";

// Browser-side web-push helpers: subscribe this device to server push
// notifications using the VAPID public key from /api/push/vapid-public.

export type EnsurePushResult =
  | "subscribed"
  | "denied"
  | "unsupported"
  | "no-key"
  | "error";

/** Converts a VAPID base64url public key to the Uint8Array Push API wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Makes sure this browser is subscribed to push (permission already
 * granted) and that the server knows the subscription. Safe to call
 * repeatedly — existing subscriptions are simply re-confirmed.
 */
export async function ensurePushSubscription(): Promise<EnsurePushResult> {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "granted") return "denied";

  try {
    const [registration, keyRes] = await Promise.all([
      navigator.serviceWorker.ready,
      fetch("/api/push/vapid-public", { cache: "no-store" }),
    ]);
    if (!keyRes.ok) return "no-key";
    const keyData = (await keyRes.json()) as { publicKey?: string };
    if (!keyData.publicKey) return "no-key";

    const postSubscription = async (subscription: PushSubscription) => {
      const body = {
        ...(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }),
        userAgent: navigator.userAgent.slice(0, 250),
      };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`);
    };

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await postSubscription(existing); // re-confirm after server loss / key rotation
      return "subscribed";
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });
    await postSubscription(subscription);
    return "subscribed";
  } catch (err) {
    console.warn("[push] ensurePushSubscription failed:", err);
    return "error";
  }
}

/** Removes this device's subscription from the server (permission stays). */
export async function removePushSubscription(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: existing.endpoint }),
        cache: "no-store",
      });
      await existing.unsubscribe();
    }
  } catch (err) {
    console.warn("[push] removePushSubscription failed:", err);
  }
}
