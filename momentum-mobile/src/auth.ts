// Google sign-in via the Momentum backend (OAuth code flow, exchanged
// server-side). The app never touches a client secret — it opens the system
// browser at the backend, which 302s to Google, then back to the app through
// the `momentum://auth` deep link carrying a signed sync token.

import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useApp } from "./store";
import { newId, parseUrlQuery } from "./utils";

WebBrowser.maybeCompleteAuthSession();

export interface SignInResult {
  ok: boolean;
  message: string;
}

function redirectBase(): string {
  // In Expo Go the app can't own a custom scheme — bounce through exp:// so
  // the flow is testable there too. Standalone/APK builds use momentum://.
  const ownership = Constants.appOwnership ?? "standalone";
  return ownership === "expo" ? "exp://auth" : "momentum://auth";
}

export async function signInWithGoogle(): Promise<SignInResult> {
  const base = useApp.getState().serverUrl;
  const state = newId();
  const redirect = redirectBase();
  const startUrl = `${base}/api/mobile/auth/google?state=${encodeURIComponent(
    state,
  )}&redirect=${encodeURIComponent(redirect)}`;

  let result: WebBrowser.WebBrowserResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(startUrl, redirect);
  } catch {
    return { ok: false, message: "Could not open the sign-in window" };
  }

  if (result.type !== "success" || !result.url) {
    return { ok: false, message: "Sign-in cancelled" };
  }

  const q = parseUrlQuery(result.url);
  if (q.state !== state) {
    return { ok: false, message: "Sign-in failed a security check — try again" };
  }
  if (q.error === "config") {
    return {
      ok: false,
      message:
        "The server's Google login isn't configured yet (see README step 2)",
    };
  }
  if (q.error === "auth_failed") {
    return { ok: false, message: "Google rejected the sign-in — try again" };
  }
  if (!q.token) {
    return { ok: false, message: "Sign-in did not complete — try again" };
  }

  useApp.getState().setAuth({
    token: q.token,
    email: q.email ?? "",
    name: q.name ?? null,
    image: q.image ?? null,
  });
  return { ok: true, message: `Signed in as ${q.email ?? "your account"}` };
}

export function signOut(): void {
  useApp.getState().setAuth(null);
}
