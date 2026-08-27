"use client";

import * as React from "react";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

/**
 * Lazy-loaded markdown renderer. react-markdown is chunked so the
 * initial bundle stays light — important for phone browsers.
 */
const ReactMarkdown = React.lazy(() =>
  import("react-markdown").then((m) => ({ default: m.default }))
);

// ── Wiki-links: [[Note Title]] ───────────────────────────────
//
// `[[Title]]` in note content becomes a link to another note. The
// rewrite happens on the raw markdown BEFORE react-markdown parses
// it, but code is protected first (pipeline order matters):
//   1. fenced code blocks (``` / ~~~) are skipped line-by-line,
//   2. inline code spans are stashed behind private-use unicode
//      placeholders so their content is never rewritten,
//   3. only then is `[[Title]]` rewritten into a markdown link
//      carrying a private `#wiki:` href that the custom `a`
//      renderer below intercepts.
// Result: `` `[[literal]]` `` and fenced blocks render literally,
// while plain-text wiki-links become clickable.
//
// Known (documented) edges: multi-line inline code spans and
// 4-space indented code blocks are not protected; a `[[wiki]]`
// inside those rare constructs would still linkify. Malformed
// fences (```` ``` ```` closed by ```` ```junk ````) follow
// simplified toggle rules.

const WIKI_HREF_PREFIX = "#wiki:";

/** `[[Title]]` — inner 1–80 chars, no newlines, no nested brackets. */
const WIKI_LINK_RE = /\[\[([^[\]\n]{1,80})\]\]/g;
/** On plain lines, inline code wins over wiki-links at the same position. */
const INLINE_CODE_OR_WIKI_RE = /`[^`\n]*`|\[\[([^[\]\n]{1,80})\]\]/g;
const FENCE_OPEN_RE = /^ {0,3}(?:```|~~~)/;
/** A closing fence carries no info string (mirrors CommonMark). */
const FENCE_CLOSE_RE = /^ {0,3}(?:```|~~~)[ \t]*$/;

/** Escape markdown-significant brackets/backslashes for link text. */
function escapeLinkText(title: string): string {
  return title.replace(/([\\[\]])/g, "\\$1");
}

function wikiLinkToMarkdown(match: string, inner: string): string {
  const title = inner.trim();
  if (!title) return match;
  return `[${escapeLinkText(title)}](${WIKI_HREF_PREFIX}${encodeURIComponent(title)})`;
}

/**
 * All `[[wiki-link]]` titles in a piece of content, trimmed and
 * lower-cased — used for backlink scanning (intentionally a simple
 * regex scan, code-unaware).
 */
export function extractWikiTitles(content: string): string[] {
  if (!content) return [];
  return Array.from(content.matchAll(WIKI_LINK_RE), (m) =>
    m[1].trim().toLowerCase()
  );
}

/**
 * Rewrite wiki-links into markdown links, leaving code untouched.
 * (See the block comment above for the pipeline order.)
 */
export function transformWikiLinks(content: string): string {
  if (!content.includes("[[")) return content;
  const stashed: string[] = [];
  const stash = (code: string) => {
    stashed.push(code);
    // Private-use characters never appear in real text and carry no
    // markdown meaning, so the placeholder survives parsing untouched.
    return `\uE000${stashed.length - 1}\uE001`;
  };

  let inFence = false;
  const lines = content.split("\n").map((line) => {
    if (inFence) {
      // Inside a fenced block: only a bare fence line closes it.
      if (FENCE_CLOSE_RE.test(line)) inFence = false;
      return line;
    }
    if (FENCE_OPEN_RE.test(line)) {
      inFence = true;
      return line;
    }
    // Plain line: the alternation matches `` `code` `` before `[[wiki]]`
    // when both start at the same spot, so backticked wiki-links stay literal.
    return line.replace(INLINE_CODE_OR_WIKI_RE, (m, wiki: string | undefined) =>
      wiki === undefined ? stash(m) : wikiLinkToMarkdown(m, wiki)
    );
  });

  const joined = lines.join("\n");
  if (stashed.length === 0) return joined;
  return joined.replace(/\uE000(\d+)\uE001/g, (_, i) => stashed[Number(i)] ?? "");
}

function WikiLink({
  title,
  onWikiLink,
  children,
}: {
  title: string;
  onWikiLink?: (title: string) => void;
  children?: React.ReactNode;
}) {
  if (!onWikiLink) {
    // No handler → styled, but not interactive.
    return (
      <span className="text-primary underline decoration-primary/30 underline-offset-2">
        {children ?? title}
      </span>
    );
  }
  return (
    <span
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-sm text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      // stopPropagation keeps parent click handlers (e.g. the note card
      // that opens the editor) from also firing.
      onClick={(e) => {
        e.stopPropagation();
        onWikiLink(title);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onWikiLink(title);
        }
      }}
    >
      {children ?? title}
    </span>
  );
}

export function MarkdownContent({
  content,
  className,
  onWikiLink,
}: {
  content: string;
  className?: string;
  /** Invoked with the note title when a [[wiki-link]] is clicked. */
  onWikiLink?: (title: string) => void;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const transformed = React.useMemo(
    () => transformWikiLinks(content),
    [content]
  );

  const components = React.useMemo<Components>(
    () => ({
      a: ({ href, children }) => {
        if (typeof href === "string" && href.startsWith(WIKI_HREF_PREFIX)) {
          let title = href.slice(WIKI_HREF_PREFIX.length);
          try {
            title = decodeURIComponent(title);
          } catch {
            // Not encoded (shouldn't happen) — use the raw value.
          }
          return (
            <WikiLink title={title} onWikiLink={onWikiLink}>
              {children ?? title}
            </WikiLink>
          );
        }
        return <a href={href}>{children}</a>;
      },
    }),
    [onWikiLink]
  );

  if (!content?.trim()) return null;

  if (!mounted) {
    // Server/first-paint fallback: plain pre-wrap text
    return (
      <div className={cn("whitespace-pre-wrap break-words text-sm", className)}>
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:font-bold [&_h1]:text-lg [&_h2]:font-semibold [&_h2]:text-base [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-1 [&_strong]:font-semibold [&_ul]:my-1",
        className
      )}
    >
      <React.Suspense
        fallback={<div className="whitespace-pre-wrap text-sm">{content}</div>}
      >
        <ReactMarkdown components={components}>{transformed}</ReactMarkdown>
      </React.Suspense>
    </div>
  );
}
