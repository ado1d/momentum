// MiniMarkdown — a dependency-free markdown renderer for read-only views
// (note reader, note cards, diary reader, editor preview). Mirrors the web
// app's react-markdown output, plus mobile niceties:
//
//   headings H1–H4 · bold · italic · strikethrough · inline code · code
//   fences · blockquotes · nested bullet/numbered lists · task lists
//   (- [ ] / - [x] checkboxes) · horizontal rules · tappable [links](url)
//   (opens an in-app browser tab) · <u>underline</u> · [[wiki-links]]
//   (tappable when they resolve to an existing note).
//
// `clamped` renders a card-friendly preview (like the web's line-clamp-4
// MarkdownContent in note cards) instead of the full document.

import React from "react";
import { Linking, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import type { Palette } from "../theme";

export interface MiniMarkdownProps {
  content: string;
  palette: Palette;
  onWikiLink?: (title: string) => void;
  /** Card preview mode: clamp each block, stop after a few blocks. */
  clamped?: boolean;
}

interface Ctx {
  palette: Palette;
  onWikiLink?: (title: string) => void;
  clamped: boolean;
}

// ── inline rendering ─────────────────────────────────────────
// bold **x** / __x__ · strike ~~x~~ · code `x` · wiki [[x]] ·
// link [x](url) · italic *x* / _x_ · underline <u>x</u>
// Order matters: wiki-links must be tried before plain links, code
// before everything so `[[x]]` stays literal inside backticks.
const INLINE_RE = new RegExp(
  [
    "(\\*\\*[^*]+\\*\\*)",
    "(__[^_]+__)",
    "(~~[^~\\n]+~~)",
    "(`[^`\\n]+`)",
    "(\\[\\[[^\\]\\n]+\\]\\])",
    "(\\[[^\\]\\n]*\\]\\([^)\\s]+\\))",
    "(<u>[^<\\n]+</u>)",
    "(\\*[^*\\s][^*\\n]*\\*)",
    "(_[^_\\s][^_\\n]*_)",
  ].join("|"),
  "g",
);

const URL_RE = /^https?:\/\//i;

async function openUrl(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Linking.openURL(url).catch(() => {});
  }
}

function renderInline(
  text: string,
  ctx: Ctx,
  keyPrefix: string,
): React.ReactNode {
  const { palette } = ctx;
  const parts = text.split(INLINE_RE).filter((p) => p !== undefined && p !== "");
  if (parts.length === 0) return text;
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;

    if (/^\*\*[^*]+\*\*$/.test(part) || /^__[^_]+__$/.test(part)) {
      return (
        <Text key={key} style={{ fontWeight: "700", color: palette.text }}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    if (/^~~[^~\n]+~~$/.test(part)) {
      return (
        <Text
          key={key}
          style={{
            textDecorationLine: "line-through",
            color: palette.textDim,
          }}
        >
          {part.slice(2, -2)}
        </Text>
      );
    }

    const code = /^`[^`\n]+`$/.exec(part);
    if (code) {
      return (
        <Text
          key={key}
          style={{
            fontSize: 12.5,
            color: palette.text,
            backgroundColor: palette.cardAlt,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 5,
            overflow: "hidden",
            fontFamily: "monospace",
          }}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }

    const wiki = /^\[\[([^\]\n]+)\]\]$/.exec(part);
    if (wiki) {
      return (
        <Text
          key={key}
          onPress={() => ctx.onWikiLink?.(wiki[1].trim())}
          style={{
            color: palette.primary,
            fontWeight: "700",
            textDecorationLine: "underline",
            textDecorationColor: `${palette.primary}55`,
          }}
        >
          {wiki[1]}
        </Text>
      );
    }

    const link = /^\[([^\]\n]*)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const label = link[1] || link[2];
      const url = link[2];
      const isHttp = URL_RE.test(url);
      if (isHttp) {
        return (
          <Text
            key={key}
            onPress={() => void openUrl(url)}
            style={{
              color: palette.primary,
              textDecorationLine: "underline",
              textDecorationColor: `${palette.primary}55`,
            }}
          >
            {label}
          </Text>
        );
      }
      return (
        <Text key={key} style={{ color: palette.text }}>
          {label}
        </Text>
      );
    }

    if (/^<u>[^<\n]+<\/u>$/.test(part)) {
      return (
        <Text
          key={key}
          style={{ textDecorationLine: "underline", color: palette.text }}
        >
          {part.slice(3, -4)}
        </Text>
      );
    }

    if (/^\*[^*\n]+\*$/.test(part) || /^_[^_\n]+_$/.test(part)) {
      return (
        <Text key={key} style={{ fontStyle: "italic", color: palette.text }}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    return <Text key={key}>{part}</Text>;
  });
}

// ── list line parsing ────────────────────────────────────────

interface ListLine {
  indent: number; // 0..3
  ordered: boolean;
  task: null | "todo" | "done";
  text: string;
  number: number; // for ordered items, as written
}

const LIST_LINE_RE =
  /^(\s*)([-*+]|\d+[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/;

function parseListLine(line: string): ListLine | null {
  const m = LIST_LINE_RE.exec(line);
  if (!m) return null;
  const indent = Math.min(3, Math.floor(m[1].length / 2));
  const marker = m[2];
  const ordered = /\d/.test(marker[0]);
  const check = m[3];
  return {
    indent,
    ordered,
    task: check === undefined ? null : check === " " ? "todo" : "done",
    text: m[4] ?? "",
    number: ordered ? parseInt(marker, 10) || 1 : 0,
  };
}

const BULLET_GLYPH = ["•", "–", "·", "·"];

// ── block rendering ──────────────────────────────────────────

export function MiniMarkdown({
  content,
  palette,
  onWikiLink,
  clamped = false,
}: MiniMarkdownProps) {
  const ctx: Ctx = { palette, onWikiLink, clamped };
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  let key = 0;
  let truncated = false;
  // Clamped (card preview) mode renders with a LINE BUDGET, mirroring the
  // web app's line-clamp-4 note previews: full markdown styling, but the
  // whole document is cut after ~5 rendered lines.
  let budget = clamped ? 5 : Infinity;

  const push = (node: React.ReactNode) => {
    blocks.push(node);
  };

  while (i < lines.length) {
    if (budget <= 0) {
      if (lines.slice(i).some((l) => l.trim())) truncated = true;
      break;
    }
    const line = lines[i];

    // fenced code block
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (if present)
      if (code.length === 0) continue;
      push(
          <View
            key={`b${key++}`}
            style={{
              backgroundColor: palette.cardAlt,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: palette.border,
              padding: clamped ? 7 : 12,
              marginVertical: clamped ? 4 : 10,
            }}
          >
            <Text
              numberOfLines={clamped ? 1 : undefined}
              style={{
                color: palette.textDim,
                fontSize: clamped ? 11.5 : 12.5,
                lineHeight: clamped ? 16 : 20,
                fontFamily: "monospace",
              }}
            >
              {code.join("\n")}
            </Text>
          </View>,
      );
      if (clamped) budget -= 1;
      continue;
    }

    // horizontal rule (skipped entirely in card previews — pure space cost)
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      if (clamped) {
        i += 1;
        continue;
      }
      push(
        <View
          key={`b${key++}`}
          style={{ height: 1, backgroundColor: palette.border, marginVertical: 14 }}
        />,
      );
      i += 1;
      continue;
    }

    // headings h1–h4
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const size = clamped ? [16.5, 15, 14, 13.5][level - 1] : [24, 20, 17.5, 15.5][level - 1];
      const weight = level <= 2 ? "800" : "700";
      push(
        <Text
          key={`b${key++}`}
          numberOfLines={clamped ? 1 : undefined}
          style={{
            color: palette.text,
            fontWeight: weight as "700" | "800",
            fontSize: size,
            marginTop: clamped ? 2 : level === 1 ? 20 : level === 2 ? 16 : 12,
            marginBottom: clamped ? 1 : level === 1 ? 7 : 5,
            letterSpacing: -0.3,
            lineHeight: size * (clamped ? 1.25 : 1.3),
          }}
        >
          {renderInline(h[2], ctx, `h${key}`)}
        </Text>,
      );
      if (clamped) budget -= 1;
      i += 1;
      continue;
    }

    // blockquote
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      const qLines = clamped ? Math.min(2, Math.max(1, budget)) : undefined;
      push(
        <View
          key={`b${key++}`}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: palette.primary,
            backgroundColor: palette.cardAlt,
            paddingLeft: 12,
            paddingVertical: clamped ? 5 : 9,
            borderRadius: 8,
            marginVertical: clamped ? 4 : 10,
          }}
        >
          <Text
            numberOfLines={qLines}
            style={{
              color: palette.textDim,
              fontSize: clamped ? 12.5 : 14,
              lineHeight: clamped ? 18 : 22,
              fontStyle: "italic",
            }}
          >
            {renderInline(quote.join(" "), ctx, `q${key}`)}
          </Text>
        </View>,
      );
      if (clamped) budget -= qLines ?? 2;
      continue;
    }

    // list block (bullets / ordered / task items, nested levels)
    if (parseListLine(line)) {
      const items: { line: ListLine }[] = [];
      while (i < lines.length) {
        const parsed = parseListLine(lines[i]);
        if (!parsed) break;
        items.push({ line: parsed });
        i += 1;
      }

      const maxItems = clamped ? Math.max(1, Math.min(4, budget)) : items.length;
      if (clamped && items.length > maxItems) truncated = true;
      const shownItems = clamped ? items.slice(0, maxItems) : items;

      // renumber ordered items per level
      const counters: number[] = [];
      for (const it of shownItems) {
        if (it.line.ordered) {
          counters[it.line.indent] = (counters[it.line.indent] ?? 0) + 1;
          for (let d = it.line.indent + 1; d < counters.length; d += 1) {
            counters[d] = 0;
          }
          it.line.number = counters[it.line.indent];
        }
      }

      push(
        <View key={`b${key++}`} style={{ marginVertical: clamped ? 3 : 10 }}>
          {shownItems.map((it, idx) => {
            const l = it.line;
            const markerWidth = 18 + l.indent * 16;
            const done = l.task === "done";
            return (
              <View
                key={idx}
                style={{
                  flexDirection: "row",
                  marginBottom: clamped ? 3 : 5,
                  alignItems: "flex-start",
                  opacity: done ? 0.72 : 1,
                }}
              >
                <View style={{ width: markerWidth, alignItems: "flex-end", paddingTop: 1.5 }}>
                  {l.task ? (
                    <View
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 5,
                        borderWidth: 1.5,
                        borderColor: done ? palette.primary : palette.border,
                        backgroundColor: done ? palette.primary : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={12} color={palette.onPrimary} />
                      ) : null}
                    </View>
                  ) : (
                    <Text
                      style={{
                        color: l.ordered ? palette.textDim : palette.primary,
                        fontWeight: l.ordered ? "700" : "800",
                        fontSize: 14,
                        lineHeight: 22,
                      }}
                    >
                      {l.ordered ? `${l.number}.` : BULLET_GLYPH[l.indent]}
                    </Text>
                  )}
                </View>
                <Text
                  numberOfLines={clamped ? 1 : undefined}
                  style={{
                    color: palette.text,
                    fontSize: clamped ? 12.5 : 15,
                    lineHeight: clamped ? 18 : 23,
                    flex: 1,
                    textDecorationLine: done ? "line-through" : "none",
                  }}
                >
                  {renderInline(l.text, ctx, `li${key}-${idx}`)}
                </Text>
              </View>
            );
          })}
        </View>,
      );
      if (clamped) budget -= shownItems.length;
      continue;
    }

    // blank line
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // paragraph (merge following non-special lines)
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(#{1,4}\s|>|```)/.test(lines[i]) &&
      !parseListLine(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    const pLines = clamped ? Math.min(3, Math.max(1, budget)) : undefined;
    push(
      <Text
        key={`b${key++}`}
        numberOfLines={pLines}
        style={{
          color: palette.text,
          fontSize: clamped ? 12.5 : 15,
          lineHeight: clamped ? 18 : 24,
          marginVertical: clamped ? 3 : 9,
        }}
      >
        {renderInline(para.join(" "), ctx, `p${key}`)}
      </Text>,
    );
    if (clamped) budget -= pLines ?? 3;
    // Rough heuristic: a long merged paragraph likely exceeds the clamp.
    if (clamped && para.join(" ").length > 90) truncated = true;
  }

  if (content.trim() === "") return null;

  return (
    <View>
      {blocks}
      {clamped && truncated ? (
        <Text
          style={{
            color: palette.textFaint,
            fontSize: 13,
            marginTop: 2,
            fontStyle: "italic",
          }}
        >
          …
        </Text>
      ) : null}
    </View>
  );
}

/** Titles of every [[wiki-link]] in a text — mirrors the web's extractWikiTitles. */
export function extractWikiTitles(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]\n]{1,80})\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].trim().toLowerCase());
  }
  return out;
}

/** Plain-text preview of markdown (for compact rows): strips syntax, keeps words. */
export function markdownToPlain(text: string): string {
  return text
    .replace(/```[\s\S]*?(?:```|$)/g, " … ")
    .replace(/^\s*#{1,4}\s+/gm, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, "$1")
    .replace(/<\/?u>/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*>{1,}\s?/gm, "")
    .replace(/^(\s*)[-*+]\s+\[ \]\s+/gm, "$1☐ ")
    .replace(/^(\s*)[-*++]\s+\[[xX]\]\s+/gm, "$1☑ ")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
