"use client";

// Client UI state — current view, quick-add sheet, search.
// Persisted to localStorage so the app reopens where you left off.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewId } from "./types";

interface UiState {
  view: ViewId;
  quickAddOpen: boolean;
  setView: (view: ViewId) => void;
  setQuickAddOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      view: "dashboard",
      quickAddOpen: false,
      setView: (view) => set({ view, quickAddOpen: false }),
      setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),
    }),
    {
      name: "momentum-ui",
      partialize: (s) => ({ view: s.view }),
    }
  )
);
