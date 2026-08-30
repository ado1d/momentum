// MiniMarkdown — a tiny, dependency-free markdown renderer for read-only
// views (notes reader, diary reader). Supports the subset the web app's
// notes commonly use: headings, bold, italic, inline code, code fences,
// blockquotes, bullet/numbered lists, horizontal rules and [[wiki-links]]
// (tappable when they resolve to an existing note).

import React from "react";
import { Text, View } from "react-native";
import type { Palette } from "../theme";

export interface MiniMarkdownProps {
  content: string;
  palette: Palette;
  onWikiLink?: (title: string) => void;
}

interface Ctx {
  palette: Palette;
  onWikiLink?: (title: string) => void;
}

// ── inline rendering (bold / italic / code / wiki-links) ──────

const INLINE_RE =
  /(\*\*[^*]+\*\*)|(`[^`]+`)|(\[\[[^\]]+\]\])|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)/g;

function renderInline(text: string, ctx: Ctx, keyPrefix: string): React.ReactNode {
  const { palette } = ctx;
  const parts = text.split(INLINE_RE).filter((p) => p !== undefined && p !== "");
  if (parts.length === 0) return text;
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <Text key={key} style={{ fontWeight: "800", color: palette.text }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <Text
          key={key}
          style={{
            fontSize: 12.5,
            color: palette.text,
            backgroundColor: palette.cardAlt,
            paddingHorizontal: 4,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {part.slice(1, -1)}
        </Text>
      );
    }
    const wiki = /^\[\[([^\]]+)\]\]$/.exec(part);
    if (wiki) {
      return (
        <Text
          key={key}
          onPress={() => ctx.onWikiLink?.(wiki[1])}
          style={{ color: palette.primary, fontWeight: "700" }}
        >
          {wiki[1]}
        </Text>
      );
    }
    if (/^\*[^*]+\*$/.test(part) || /^_[^_]+_$/.test(part)) {
      return (
        <Text key={key} style={{ fontStyle: "italic", color: palette.textDim }}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={key}>{part}</Text>;
  });
}

// ── block rendering ──────────────────────────────────────────

export function MiniMarkdown({ content, palette, onWikiLink }: MiniMarkdownProps) {
  const ctx: Ctx = { palette, onWikiLink };
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <View
          key={`b${key++}`}
          style={{
            backgroundColor: palette.cardAlt,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: palette.border,
            padding: 12,
            marginVertical: 8,
          }}
        >
          <Text style={{ color: palette.textDim, fontSize: 12.5, lineHeight: 19, fontFamily: "monospace" }}>
            {code.join("\n")}
          </Text>
        </View>,
      );
      continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(
        <View
          key={`b${key++}`}
          style={{ height: 1, backgroundColor: palette.border, marginVertical: 12 }}
        />,
      );
      i += 1;
      continue;
    }

    // headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push(
        <Text
          key={`b${key++}`}
          style={{
            color: palette.text,
            fontWeight: "800",
            fontSize: level === 1 ? 22 : level === 2 ? 19 : 16.5,
            marginTop: level === 1 ? 14 : 10,
            marginBottom: 6,
            letterSpacing: -0.3,
          }}
        >
          {renderInline(h[2], ctx, `h${key}`)}
        </Text>,
      );
      i += 1;
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <View
          key={`b${key++}`}
          style={{
            borderLeftWidth: 3,
            borderLeftColor: palette.primary,
            backgroundColor: palette.cardAlt,
            paddingLeft: 12,
            paddingVertical: 8,
            borderRadius: 8,
            marginVertical: 8,
          }}
        >
          <Text style={{ color: palette.textDim, fontSize: 14, lineHeight: 21, fontStyle: "italic" }}>
            {renderInline(quote.join(" "), ctx, `q${key}`)}
          </Text>
        </View>,
      );
      continue;
    }

    // lists (collect consecutive items)
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+[.)]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""));
        i += 1;
      }
      blocks.push(
        <View key={`b${key++}`} style={{ marginVertical: 6 }}>
          {items.map((item, idx) => (
            <View key={idx} style={{ flexDirection: "row", marginBottom: 5 }}>
              <Text style={{ color: palette.primary, fontWeight: "800", fontSize: 14.5, lineHeight: 22, marginRight: 8 }}>
                {ordered ? `${idx + 1}.` : "•"}
              </Text>
              <Text style={{ color: palette.text, fontSize: 14.5, lineHeight: 22, flex: 1 }}>
                {renderInline(item, ctx, `li${key}-${idx}`)}
              </Text>
            </View>
          ))}
        </View>,
      );
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
      !/^\s*(#{1,3}\s|>|[-*]\s|\d+[.)]\s|```)/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <Text key={`b${key++}`} style={{ color: palette.text, fontSize: 15, lineHeight: 24, marginVertical: 5 }}>
        {renderInline(para.join(" "), ctx, `p${key}`)}
      </Text>,
    );
  }

  return <View>{blocks}</View>;
}

/** Titles of every [[wiki-link]] in a text — mirrors the web's extractWikiTitles. */
export function extractWikiTitles(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].trim().toLowerCase());
  }
  return out;
}

/** Plain-text preview of markdown (for note cards): strips syntax, keeps words. */
export function markdownToPlain(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " … ")
    .replace(/^\s*#{1,3}\s+/gm, "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*>{1,}\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
