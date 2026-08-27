"use client";

// Pointer-based list reordering that works with BOTH mouse and touch
// (html5 drag events don't fire on touch, so we unify via PointerEvents).
//
// Consumer contract:
//   const drag = useDragList({ count, onReorder });
//   <ul data-drag-list>                                  ← list container
//     {items.map((item, i) => (
//       <li data-drag-item style={drag.itemState(i).style}> ← item root
//         <button onPointerDown={drag.itemState(i).onPointerDown}
//                 className="touch-none cursor-grab" … />   ← drag handle
//
// Items are located through `[data-drag-item]` descendants of the nearest
// `[data-drag-list]` ancestor of the handle, so indices always match the
// rendered (DOM) order. While dragging, the item is visually lifted and the
// item it would land on gets an `indicator` ("above" | "below") so the
// consumer can render a 2px insertion line. On pointerup the reorder is
// committed via onReorder(from, to) — only when the target changed.

import * as React from "react";

export type DragIndicator = "above" | "below" | null;

export interface DragItemState {
  /** Spread on the drag-handle element. */
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  /** Spread on the item root element (visual lift; undefined when idle). */
  style: React.CSSProperties | undefined;
  isDragging: boolean;
  /** Where the insertion line should render on this item, if any. */
  indicator: DragIndicator;
}

export interface UseDragListOptions {
  count: number;
  onReorder: (from: number, to: number) => void;
}

interface DragSession {
  pointerId: number;
  from: number;
  startY: number;
  centers: number[];
}

/** Returns a copy of `arr` with the element at `from` moved to `to`. */
export function arrayMove<T>(arr: readonly T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useDragList({ count, onReorder }: UseDragListOptions) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [targetIndex, setTargetIndex] = React.useState<number | null>(null);

  const sessionRef = React.useRef<DragSession | null>(null);
  const targetRef = React.useRef<number | null>(null);
  const onReorderRef = React.useRef(onReorder);
  React.useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);

  const reduced = prefersReducedMotion();

  const itemState = (index: number): DragItemState => ({
    onPointerDown: (e) => {
      if (sessionRef.current) return; // another drag is already active
      if (e.button !== 0 || !e.isPrimary) return; // primary mouse/touch only
      const handle = e.currentTarget;
      const item = handle.closest<HTMLElement>("[data-drag-item]");
      const container = handle.closest<HTMLElement>("[data-drag-list]");
      if (!item || !container) return;
      const siblings = Array.from(
        container.querySelectorAll<HTMLElement>("[data-drag-item]")
      );
      const from = siblings.indexOf(item);
      if (from < 0 || siblings.length !== count) return; // list is stale — bail
      e.preventDefault(); // no text selection / native image drag

      const session: DragSession = {
        pointerId: e.pointerId,
        from,
        startY: e.clientY,
        centers: siblings.map((el) => {
          const rect = el.getBoundingClientRect();
          return rect.top + rect.height / 2;
        }),
      };

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        const draggedCenter = s.centers[s.from] + (ev.clientY - s.startY);
        let target = s.from;
        for (let i = 0; i < s.centers.length; i++) {
          if (i === s.from) continue;
          if (i < s.from && draggedCenter < s.centers[i]) target = Math.min(target, i);
          if (i > s.from && draggedCenter > s.centers[i]) target = Math.max(target, i);
        }
        if (target !== targetRef.current) {
          targetRef.current = target;
          setTargetIndex(target);
        }
      };

      const onEnd = (ev: PointerEvent) => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        // pointercancel (e.g. browser took over the gesture) → abort, no commit
        const to = ev.type === "pointercancel" ? null : targetRef.current;
        sessionRef.current = null;
        targetRef.current = null;
        setDragIndex(null);
        setTargetIndex(null);
        if (to !== null && to !== s.from) onReorderRef.current(s.from, to);
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);

      try {
        handle.setPointerCapture(e.pointerId); // keeps events flowing to us
      } catch {
        // Synthetic/test events carry inactive pointer ids — window
        // listeners above still receive everything we need.
      }

      sessionRef.current = session;
      targetRef.current = from;
      setDragIndex(from);
      setTargetIndex(from);
    },
    style:
      dragIndex === index
        ? reduced
          ? ({ position: "relative", zIndex: 10 } as const)
          : {
              position: "relative",
              zIndex: 10,
              opacity: 0.8,
              transform: "scale(1.02)",
              boxShadow:
                "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
              transition: "opacity 150ms ease, transform 150ms ease, box-shadow 150ms ease",
            }
        : undefined,
    isDragging: dragIndex === index,
    indicator:
      dragIndex !== null &&
      targetIndex !== null &&
      targetIndex !== dragIndex &&
      index === targetIndex
        ? targetIndex < dragIndex
          ? "above"
          : "below"
        : null,
  });

  return { itemState, draggingIndex: dragIndex, targetIndex };
}
