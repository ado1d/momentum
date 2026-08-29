// Backend client — talks to the Momentum web app's /api/mobile/* routes.

import { useApp } from "./store";

export function serverBase(): string {
  return useApp.getState().serverUrl;
}

export interface SyncResult {
  ok: boolean;
  message: string;
}

export interface MobileAuth {
  token: string;
  email: string;
  name: string | null;
  image: string | null;
}
