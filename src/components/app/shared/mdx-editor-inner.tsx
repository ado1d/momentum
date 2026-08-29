"use client";

// Inner WYSIWYG markdown editor (heavy — loaded via React.lazy from
// rich-editor.tsx). Built on @mdxeditor/editor: formatting (bold, italic,
// headings, lists, quotes, links) renders LIVE while writing; the document
// stays markdown under the hood, so rendering, wiki-links, search and export
// all keep working unchanged.

import "@mdxeditor/editor/style.css";
import "./rich-editor.css";

import * as React from "react";
import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  type MDXEditorMethods,
  Separator,
  UndoRedo,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from "@mdxeditor/editor";

/** Imperative helpers handed to custom toolbar items (e.g. wiki-link insert). */
export interface RichEditorToolbarApi {
  /** Insert markdown at the caret (replaces the current selection). */
  insertMarkdown: (markdown: string) => void;
  /** The current selection as markdown ("" when nothing is selected). */
  getSelectionMarkdown: () => string;
}

export interface MdxEditorInnerProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  /** Content area min-height in px. */
  minHeight?: number;
  /** Optional extra toolbar item (receives the imperative helpers). */
  toolbarExtra?: React.ComponentType<RichEditorToolbarApi>;
  /** Receives the underlying editor methods (focus, getMarkdown…). */
  methodsRef?: React.RefObject<MDXEditorMethods | null>;
}

export default function MdxEditorInner({
  value,
  onChange,
  placeholder,
  minHeight = 168,
  toolbarExtra: ToolbarExtra,
  methodsRef,
}: MdxEditorInnerProps) {
  const ref = React.useRef<MDXEditorMethods>(null);

  // Bubble the editor methods up so parents can focus the editor.
  React.useEffect(() => {
    if (methodsRef) methodsRef.current = ref.current;
    return () => {
      if (methodsRef) methodsRef.current = null;
    };
  }, [methodsRef]);

  // Controlled-value sync: only push external changes (e.g. the diary form
  // loading another date) into the editor — never the echoes of our own
  // onChange, or the caret would jump after every keystroke.
  const lastEmitted = React.useRef(value);
  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      ref.current?.setMarkdown(value);
    }
  }, [value]);

  const api = React.useMemo<RichEditorToolbarApi>(
    () => ({
      insertMarkdown: (md) => ref.current?.insertMarkdown(md),
      getSelectionMarkdown: () => ref.current?.getSelectionMarkdown() ?? "",
    }),
    []
  );

  // toolbarContents must be a STABLE component/function across renders, or
  // the toolbar realm re-initializes (focus + state loss on every render).
  const toolbarContents = React.useCallback(() => {
    return (
      <>
        <UndoRedo />
        <Separator />
        <BoldItalicUnderlineToggles />
        <Separator />
        <BlockTypeSelect />
        <ListsToggle />
        <Separator />
        <CreateLink />
        {ToolbarExtra ? <ToolbarExtra {...api} /> : null}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ToolbarExtra, api.insertMarkdown, api.getSelectionMarkdown]);

  const plugins = React.useMemo(
    () => [
      toolbarPlugin({ toolbarContents }),
      // Typing markdown (`**bold**`, `# `, `- `) converts to live formatting
      // as you type — muscle memory from plain-markdown writing keeps working.
      markdownShortcutPlugin(),
      headingsPlugin(),
      listsPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
    ],
    [toolbarContents]
  );

  return (
    <div
      className="rich-editor-root"
      style={{ "--re-min-h": `${minHeight}px` } as React.CSSProperties}
    >
      <MDXEditor
        ref={ref}
        markdown={value}
        onChange={(md) => {
          // mdxeditor escapes literal brackets (\[) when serializing plain
          // text — undo that so [[wiki-links]] written via the toolbar
          // button or by typing survive verbatim in the stored markdown
          // (the display renderer linkifies them).
          const fixed = md.replace(/\\([[\]])/g, "$1");
          lastEmitted.current = fixed;
          onChange(fixed);
        }}
        contentEditableClassName="rich-editor-content"
        plugins={plugins}
        suppressHtmlProcessing
      />
    </div>
  );
}
