"use client";

// RichEditor — the user-facing WYSIWYG writing surface used by Notes, Diary
// and Tasks. Formatting (bold, italic, headings, lists, quotes, links) is
// applied from the toolbar or ⌘B/⌘I shortcuts and renders LIVE while typing;
// no raw markdown syntax is ever shown to the writer.
//
// The heavy @mdxeditor/editor bundle is code-split: it only loads when an
// editor actually mounts, keeping the initial dashboard bundle light.

import * as React from "react";
import type { MDXEditorMethods } from "@mdxeditor/editor";

const MdxEditorInner = React.lazy(() => import("./mdx-editor-inner"));

export type { RichEditorToolbarApi } from "./mdx-editor-inner";

/** Imperative handle for a mounted RichEditor. */
export interface RichEditorHandle {
  focus: () => void;
}

export interface RichEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** Content area min-height in px (default 168). */
  minHeight?: number;
  /** Extra toolbar item, e.g. the [[wiki-link]] button in Notes. */
  toolbarExtra?: React.ComponentType<{
    insertMarkdown: (markdown: string) => void;
    getSelectionMarkdown: () => string;
  }>;
  /** id used for the aria-label of the editor region. */
  id?: string;
  className?: string;
  /** Imperative handle (focus). */
  handleRef?: React.RefObject<RichEditorHandle | null>;
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  minHeight,
  toolbarExtra,
  id,
  className,
  handleRef,
}: RichEditorProps) {
  // Bridge to the lazy inner editor's methods (focus …).
  const methodsRef = React.useRef<MDXEditorMethods | null>(null);
  const focus = React.useCallback(() => {
    methodsRef.current?.focus();
  }, []);
  React.useEffect(() => {
    if (handleRef) handleRef.current = { focus };
    return () => {
      if (handleRef) handleRef.current = null;
    };
  }, [handleRef, focus]);

  // Client-only mount gate — avoids any SSR/hydration involvement of the
  // contentEditable surface (the views are client-rendered anyway, but this
  // makes the component safe anywhere).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Skeleton mirroring the editor's shape while the chunk streams in.
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{ minHeight: (minHeight ?? 168) + 44 }}
      >
        <div className="flex h-9 items-center gap-2 rounded-t-xl border border-b-0 border-border bg-muted/40 px-3">
          <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-10 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-12 animate-pulse rounded-md bg-muted" />
        </div>
        <div
          className="rounded-b-xl border border-border"
          style={{ minHeight: minHeight ?? 168 }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      role="group"
      aria-label={id ? `Rich text editor: ${id}` : "Rich text editor"}
    >
      <React.Suspense
        fallback={
          <div
            aria-hidden="true"
            style={{ minHeight: (minHeight ?? 168) + 44 }}
          >
            <div className="flex h-9 items-center gap-2 rounded-t-xl border border-b-0 border-border bg-muted/40 px-3">
              <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-10 animate-pulse rounded-md bg-muted" />
              <div className="h-4 w-12 animate-pulse rounded-md bg-muted" />
            </div>
            <div
              className="rounded-b-xl border border-border"
              style={{ minHeight: minHeight ?? 168 }}
            />
          </div>
        }
      >
        <MdxEditorInner
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={minHeight}
          toolbarExtra={toolbarExtra}
          methodsRef={methodsRef}
        />
      </React.Suspense>
    </div>
  );
}
