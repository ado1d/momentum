// Global app state (zustand). Persisted keys live in the SQLite kv table.

import { create } from "zustand";
import { kvGet, kvSet, pendingSince } from "./db";
import type { ThemeMode } from "./theme";

export interface AuthUser {
  token: string;
  email: string;
  name: string | null;
  image: string | null;
}

interface AppState {
  hydrated: boolean;
  auth: AuthUser | null;
  theme: ThemeMode;
  autoSync: boolean;
  serverUrl: string;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  dataVersion: number;
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  lastSyncMessage: string | null;
  pending: number;
  hydrate: () => void;
  setAuth: (a: AuthUser | null) => void;
  setTheme: (t: ThemeMode) => void;
  setAutoSync: (v: boolean) => void;
  setServerUrl: (v: string) => void;
  setReminder: (enabled: boolean, hour?: number, minute?: number) => void;
  setOnline: (v: boolean) => void;
  setSyncing: (v: boolean) => void;
  setSyncDone: (iso: string | null, message: string | null) => void;
  refreshPending: () => void;
  bump: () => void;
}

const PERSIST_KEYS = ["auth", "theme", "autoSync", "serverUrl", "reminderEnabled", "reminderHour", "reminderMinute", "lastSyncAt"] as const;

interface PersistedShape {
  auth: AuthUser | null;
  theme: ThemeMode;
  autoSync: boolean;
  serverUrl: string;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  lastSyncAt: string | null;
}

export const DEFAULT_SERVER_URL = "https://momentum-theta-navy.vercel.app";

const DEFAULTS: PersistedShape = {
  auth: null,
  theme: "system",
  autoSync: true,
  serverUrl: DEFAULT_SERVER_URL,
  reminderEnabled: false,
  reminderHour: 9,
  reminderMinute: 0,
  lastSyncAt: null,
};

function persist<K extends keyof PersistedShape>(key: K, value: PersistedShape[K]) {
  kvSet(key, JSON.stringify(value));
}

export const useApp = create<AppState>((set, get) => ({
  hydrated: false,
  auth: null,
  theme: "system",
  autoSync: true,
  serverUrl: DEFAULT_SERVER_URL,
  reminderEnabled: false,
  reminderHour: 9,
  reminderMinute: 0,
  dataVersion: 0,
  online: true,
  syncing: false,
  lastSyncAt: null,
  lastSyncMessage: null,
  pending: 0,

  hydrate: () => {
    if (get().hydrated) return;
    const next: Partial<PersistedShape> = {};
    for (const key of PERSIST_KEYS) {
      const raw = kvGet(key);
      if (raw !== null) {
        try {
          (next as Record<string, unknown>)[key] = JSON.parse(raw);
        } catch {
          /* ignore malformed */
        }
      }
    }
    set({
      ...DEFAULTS,
      ...next,
      hydrated: true,
      pending: pendingSince(next.lastSyncAt ?? DEFAULTS.lastSyncAt),
    });
  },

  setAuth: (a) => {
    persist("auth", a);
    set({ auth: a, lastSyncMessage: null });
    if (!a) {
      persist("lastSyncAt", null);
      set({ lastSyncAt: null, pending: 0 });
    }
  },
  setTheme: (t) => {
    persist("theme", t);
    set({ theme: t });
  },
  setAutoSync: (v) => {
    persist("autoSync", v);
    set({ autoSync: v });
  },
  setServerUrl: (v) => {
    const url = v.trim().replace(/\/+$/, "") || DEFAULT_SERVER_URL;
    persist("serverUrl", url);
    set({ serverUrl: url });
  },
  setReminder: (enabled, hour, minute) => {
    const prev = {
      enabled: get().reminderEnabled,
      hour: get().reminderHour,
      minute: get().reminderMinute,
    };
    const next = {
      enabled,
      hour: hour ?? prev.hour,
      minute: minute ?? prev.minute,
    };
    persist("reminderEnabled", next.enabled);
    persist("reminderHour", next.hour);
    persist("reminderMinute", next.minute);
    set({
      reminderEnabled: next.enabled,
      reminderHour: next.hour,
      reminderMinute: next.minute,
    });
  },
  setOnline: (v) => set({ online: v }),
  setSyncing: (v) => set({ syncing: v }),
  setSyncDone: (iso, message) => {
    persist("lastSyncAt", iso);
    set({ lastSyncAt: iso, lastSyncMessage: message, pending: pendingSince(iso) });
  },
  refreshPending: () => set({ pending: pendingSince(get().lastSyncAt) }),
  bump: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));

/** Re-export mutations that bump the data version — screens re-query on change. */
export function bumpData(): void {
  useApp.getState().bump();
  useApp.getState().refreshPending();
}
