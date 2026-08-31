// Shared UI building blocks — mirrors the Momentum web app's design language
// (rounded-2xl cards, emerald primary, pill tabs, shadcn-like inputs).

import React, { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  I18nManager,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { darkPalette, lightPalette, type Palette } from "../theme";
import { useApp } from "../store";
import { MiniMarkdown } from "./mini-md";

export function usePalette(): { palette: Palette; dark: boolean } {
  const mode = useApp((s) => s.theme);
  const system = useColorScheme();
  const dark = mode === "system" ? system !== "light" : mode === "dark";
  return { palette: dark ? darkPalette : lightPalette, dark };
}

// ── Screen shell ─────────────────────────────────────────────

export function Screen({
  children,
  scroll = true,
  pad = true,
  bottomPad = 24,
}: {
  children: ReactNode;
  scroll?: boolean;
  pad?: boolean;
  bottomPad?: number;
}) {
  const { palette } = usePalette();
  const body = (
    <View style={[styles.screenBody, pad && { paddingHorizontal: 16 }]}>
      {children}
    </View>
  );
  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: bottomPad }}
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </View>
  );
}

/** Web-like ViewHeader: bold title + muted subtitle + right actions. */
export function ViewHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { palette } = usePalette();
  return (
    <View style={styles.viewHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.viewHeaderTitle, { color: palette.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.viewHeaderSub, { color: palette.textDim }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {actions}
        </View>
      ) : null}
    </View>
  );
}

/** Header for stack-pushed screens: back chevron + title/subtitle + actions.
 *  Applies the top safe-area inset (status bar) — pushed screens render
 *  directly under the translucent status bar. */
export function StackHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  const { palette } = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      <GoBackBtn />
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text
          style={{
            color: palette.text,
            fontSize: 19,
            fontWeight: "800",
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{ color: palette.textDim, fontSize: 12.5, marginTop: 1 }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

function GoBackBtn() {
  const { palette } = usePalette();
  const navigation = useNavigation<any>();
  return (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={10}
      style={{ padding: 4 }}
    >
      <Ionicons name="chevron-back" size={25} color={palette.text} />
    </Pressable>
  );
}

/** Web-like SectionHeading: uppercase small bold + optional action. */
export function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  const { palette } = usePalette();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: palette.textDim }]}>
        {title.toUpperCase()}
      </Text>
      {action}
    </View>
  );
}

/** "See all →" ghost link like the web dashboard. */
export function SeeAll({
  label = "See all",
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      <Text style={{ color: palette.textDim, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={13}
        color={palette.textDim}
        style={{ marginLeft: 1 }}
      />
    </Pressable>
  );
}

// ── Surfaces ─────────────────────────────────────────────────

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: object | object[];
  onPress?: () => void;
}) {
  const { palette } = usePalette();
  const base = [
    styles.card,
    { backgroundColor: palette.card, borderColor: palette.border },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.82 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

// ── Buttons & chips ──────────────────────────────────────────

export function Btn({
  label,
  onPress,
  variant = "primary",
  icon,
  small,
  disabled,
  style,
  loading,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger" | "soft";
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
  disabled?: boolean;
  style?: object | object[];
  loading?: boolean;
}) {
  const { palette } = usePalette();
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isSoft = variant === "soft";
  const isOutline = variant === "outline";
  const bg = isPrimary
    ? palette.primary
    : isDanger
      ? palette.dangerSoft
      : isSoft
        ? palette.primarySoft
        : "transparent";
  const fg = isPrimary
    ? palette.onPrimary
    : isDanger
      ? palette.danger
      : isSoft
        ? palette.primary
        : palette.textDim;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg },
        (isOutline || variant === "ghost") && {
          borderWidth: 1,
          borderColor: isOutline ? palette.border : "transparent",
          backgroundColor: isOutline ? palette.card : "transparent",
        },
        pressed && { opacity: 0.82, transform: [{ scale: 0.985 }] },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={small ? 14 : 17}
          color={fg}
          style={{ marginRight: 7 }}
        />
      ) : null}
      <Text
        style={[styles.btnLabel, small && styles.btnLabelSmall, { color: fg }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function IconBtn({
  name,
  onPress,
  color,
  size = 22,
  bg,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
  bg?: string;
}) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.iconBtn,
        !!bg && { backgroundColor: bg },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? palette.textDim} />
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
  small,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  small?: boolean;
}) {
  const { palette } = usePalette();
  const accent = color ?? palette.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        small && styles.chipSmall,
        {
          backgroundColor: active ? accent : palette.cardAlt,
          borderColor: active ? accent : palette.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          small && { fontSize: 11.5, paddingVertical: 2 },
          { color: active ? "#ffffff" : palette.textDim },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** shadcn-Tabs-like segmented control. */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const { palette } = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: palette.cardAlt }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segment,
              active && {
                backgroundColor: palette.card,
                borderColor: palette.border,
                shadowColor: palette.shadow,
                shadowOpacity: 0.14,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.segmentLabel,
                { color: active ? palette.text : palette.textDim },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** shadcn-Switch-like toggle. */
export function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { palette } = usePalette();
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={8}>
      <View
        style={[
          styles.toggleTrack,
          {
            backgroundColor: value ? palette.primary : palette.cardAlt,
            borderColor: value ? palette.primary : palette.border,
          },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            { backgroundColor: value ? palette.onPrimary : palette.textFaint },
            value && { alignSelf: "flex-end" },
          ]}
        />
      </View>
    </Pressable>
  );
}

// ── Inputs ───────────────────────────────────────────────────

export function Input({
  value,
  onChangeText,
  placeholder,
  multiline,
  style,
  autoFocus,
  keyboardType,
  onSubmitEditing,
  darkBg,
  returnKeyType,
  onClear,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: object | object[];
  autoFocus?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
  onSubmitEditing?: () => void;
  darkBg?: boolean;
  returnKeyType?: "done" | "next" | "search";
  /** Show a clear (X) button while the field has text. */
  onClear?: () => void;
}) {
  const { palette } = usePalette();
  const showClear = !!onClear && value.length > 0 && !multiline;
  return (
    <View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textFaint}
        multiline={multiline}
        autoFocus={autoFocus}
        keyboardType={keyboardType}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        style={[
          styles.input,
          multiline && {
            minHeight: 110,
            textAlignVertical: "top",
            paddingTop: 12,
          },
          {
            color: palette.text,
            backgroundColor: darkBg ? palette.cardAlt : palette.bg,
            borderColor: palette.border,
          },
          showClear && { paddingRight: 40 },
          style,
        ]}
      />
      {showClear ? (
        <Pressable
          onPress={onClear}
          hitSlop={6}
          accessibilityLabel="Clear text"
          accessibilityRole="button"
          style={{
            position: "absolute",
            right: 6,
            top: 0,
            bottom: 0,
            justifyContent: "center",
            paddingHorizontal: 6,
          }}
        >
          <Ionicons name="close-circle" size={18} color={palette.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ── Rich text editor (markdown) ──────────────────────────────
// Mirrors the web app's MDXEditor writing surface as closely as a
// raw-markdown TextInput allows:
//   • full formatting toolbar — undo/redo, bold, italic, strikethrough,
//     H1–H3, quote, code block, bullet/numbered/task lists, link and
//     (in Notes) [[wiki-links]] — with live ACTIVE-state highlighting
//   • toggle behaviour: tapping an active format removes it
//   • smart Enter: lists auto-continue (- / 1. / - [ ]) and an empty
//     item exits the list, exactly like the web editor
//   • undo/redo history (typing is coalesced; toolbar steps are atomic)
//   • live Preview and a word/character count like the web dialog
// The stored document stays plain markdown, so wiki-links, search,
// previews and export keep working unchanged.

interface Sel {
  start: number;
  end: number;
}

interface Snapshot {
  value: string;
  sel: Sel;
}

/** Bounds of the line (no trailing \n) containing `pos`. */
function lineBoundsOf(text: string, pos: number): { start: number; end: number } {
  const start = text.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
  let end = text.indexOf("\n", pos);
  if (end === -1) end = text.length;
  return { start, end };
}

/** If `next` is `old` with exactly one "\n" inserted, return its position. */
function singleNewlineDiff(old: string, next: string): number | null {
  if (next.length !== old.length + 1) return null;
  let i = 0;
  while (i < old.length && old[i] === next[i]) i += 1;
  if (next[i] !== "\n") return null;
  if (old.slice(i) === next.slice(i + 1)) return i;
  return null;
}

type ListKind = "bullet" | "numbered" | "task";

const ANY_LIST_PREFIX = /^(\s*)(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)(.*)$/;

export function RichTextEditor({
  value,
  onChangeText,
  placeholder,
  style,
  autoFocus,
  keyboardType,
  onSubmitEditing,
  darkBg,
  returnKeyType,
  minHeight = 140,
  enableWikiLink = false,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  style?: object | object[];
  autoFocus?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
  onSubmitEditing?: () => void;
  darkBg?: boolean;
  returnKeyType?: "done" | "next" | "search";
  minHeight?: number;
  /** Show the [[Note title]] wiki-link button (Notes editor). */
  enableWikiLink?: boolean;
}) {
  const { palette, dark } = usePalette();
  const inputRef = React.useRef<TextInput>(null);
  const [sel, setSel] = React.useState<Sel>({ start: 0, end: 0 });
  const selRef = React.useRef<Sel>({ start: 0, end: 0 });
  const [showPreview, setShowPreview] = React.useState(false);
  const [, setHistVersion] = React.useState(0);

  const undoRef = React.useRef<Snapshot[]>([]);
  const redoRef = React.useRef<Snapshot[]>([]);
  const lastPushRef = React.useRef(0);
  const lastEmittedRef = React.useRef(value);

  // ── history ────────────────────────────────────────────────

  const pushHistory = (force: boolean) => {
    const now = Date.now();
    if (!force && now - lastPushRef.current < 700) return;
    undoRef.current.push({ value, sel: selRef.current });
    if (undoRef.current.length > 80) undoRef.current.shift();
    redoRef.current = [];
    lastPushRef.current = force ? 0 : now;
    setHistVersion((v) => v + 1);
  };

  // External value change (parent loaded another document) → reset history.
  React.useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
      undoRef.current = [];
      redoRef.current = [];
      selRef.current = { start: 0, end: 0 };
      setSel({ start: 0, end: 0 });
      setHistVersion((v) => v + 1);
    }
  }, [value]);

  const applyText = (next: string, nextSel: Sel | null, force: boolean) => {
    pushHistory(force);
    lastEmittedRef.current = next;
    onChangeText(next);
    if (nextSel) {
      selRef.current = nextSel;
      setSel(nextSel);
    }
  };

  const restore = (snap: Snapshot, from: Snapshot[]) => {
    from.push({ value, sel: selRef.current });
    lastEmittedRef.current = snap.value;
    onChangeText(snap.value);
    const clamped = {
      start: Math.min(snap.sel.start, snap.value.length),
      end: Math.min(snap.sel.end, snap.value.length),
    };
    selRef.current = clamped;
    setSel(clamped);
    lastPushRef.current = 0;
    setHistVersion((v) => v + 1);
  };

  const undo = () => {
    const snap = undoRef.current.pop();
    if (snap === undefined) return;
    restore(snap, redoRef.current);
  };

  const redo = () => {
    const snap = redoRef.current.pop();
    if (snap === undefined) return;
    restore(snap, undoRef.current);
  };

  // ── text change with smart Enter (list continuation) ───────

  const handleChange = (next: string) => {
    const nl = singleNewlineDiff(value, next);
    if (nl !== null) {
      const lineStart = next.lastIndexOf("\n", nl - 1) + 1;
      const above = next.slice(lineStart, nl);
      const m = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/.exec(above);
      if (m) {
        const content = m[5] ?? "";
        const indent = m[1] ?? "";
        if (content.trim() === "") {
          // Enter on an EMPTY list item → exit the list.
          applyText(
            next.slice(0, lineStart) + next.slice(nl + 1),
            { start: lineStart, end: lineStart },
            true,
          );
          return;
        }
        let marker = `${m[2]}${m[3]}`;
        if (m[4]) marker += m[4];
        if (/\d/.test(m[2][0])) {
          marker = `${parseInt(m[2], 10) + 1}.${m[3]}`;
        }
        applyText(
          next.slice(0, nl + 1) + indent + marker + next.slice(nl + 1),
          {
            start: nl + 1 + indent.length + marker.length,
            end: nl + 1 + indent.length + marker.length,
          },
          true,
        );
        return;
      }
    }
    applyText(next, null, false);
  };

  // ── inline wrap/unwrap (bold, italic, strike, wiki) ─────────

  const wrapInline = (marker: string) => {
    const { start, end } = selRef.current;
    let s = start;
    let e = end;
    if (s === e) {
      // No selection → grab the word around the caret (like Telegram).
      while (s > 0 && !/\s/.test(value[s - 1])) s -= 1;
      while (e < value.length && !/\s/.test(value[e])) e += 1;
      if (s === e) {
        const at = start;
        applyText(
          value.slice(0, at) + marker + marker + value.slice(at),
          { start: at + marker.length, end: at + marker.length },
          true,
        );
        return;
      }
    }
    // Selection INCLUDES the markers → strip them (toggle off).
    if (
      value.slice(s, s + marker.length) === marker &&
      value.slice(e - marker.length, e) === marker
    ) {
      const inner = value.slice(s + marker.length, e - marker.length);
      applyText(
        value.slice(0, s) + inner + value.slice(e),
        { start: s, end: s + inner.length },
        true,
      );
      return;
    }
    // Wrapped OUTSIDE the selection → strip them.
    const before = value.slice(Math.max(0, s - marker.length), s);
    const after = value.slice(e, e + marker.length);
    if (before === marker && after === marker) {
      applyText(
        value.slice(0, s - marker.length) +
          value.slice(s, e) +
          value.slice(e + marker.length),
        { start: s - marker.length, end: e - marker.length },
        true,
      );
      return;
    }
    // Wrap.
    applyText(
      value.slice(0, s) + marker + value.slice(s, e) + marker + value.slice(e),
      { start: s + marker.length, end: e + marker.length },
      true,
    );
  };

  // ── line prefix toggles (headings, quote) ───────────────────

  const setLinePrefix = (prefix: string, kind: "heading" | "quote") => {
    const { start, end } = selRef.current;
    const b = lineBoundsOf(value, start);
    const line = value.slice(b.start, b.end);
    const existingH = /^(#{1,4}\s+)/.exec(line)?.[1] ?? "";
    const existingQ = /^(>\s?)/.exec(line)?.[1] ?? "";
    const currentPrefix = existingH || existingQ;
    let nextPrefix = prefix;
    if (currentPrefix === prefix) nextPrefix = ""; // toggle off
    const rest = line.slice(currentPrefix.length);
    const next =
      value.slice(0, b.start) +
      (nextPrefix ? nextPrefix + rest : rest) +
      value.slice(b.end);
    const delta = nextPrefix.length - currentPrefix.length;
    applyText(
      next,
      {
        start: Math.max(b.start, start + delta),
        end: Math.max(b.start, end + delta),
      },
      true,
    );
  };

  // ── list toggles (multi-line aware) ─────────────────────────

  const toggleList = (kind: ListKind) => {
    const { start, end } = selRef.current;
    const b1 = lineBoundsOf(value, start);
    const b2 = lineBoundsOf(value, end);
    const chunk = value.slice(b1.start, b2.end);
    const lines = chunk.split("\n");

    const isTarget = (l: string) => {
      if (kind === "bullet") return /^\s*[-*+]\s+(?!\[)/.test(l);
      if (kind === "numbered") return /^\s*\d+[.)]\s+/.test(l);
      return /^\s*[-*+]\s+\[[ xX]\]\s+/.test(l);
    };

    const allTarget = lines.every((l) => isTarget(l));
    let number = 1;
    const transformed = lines.map((l) => {
      if (allTarget) {
        // Remove the list marker (keep indentation).
        const m = ANY_LIST_PREFIX.exec(l);
        if (m) return `${m[1] ?? ""}${m[2] ?? ""}`;
        return l;
      }
      const m = ANY_LIST_PREFIX.exec(l);
      const indent = m?.[1] ?? "";
      const body = m?.[2] ?? l;
      if (kind === "bullet") return `${indent}- ${body}`;
      if (kind === "task") return `${indent}- [ ] ${body}`;
      const out = `${indent}${number}. ${body}`;
      number += 1;
      return out;
    });

    const next =
      value.slice(0, b1.start) + transformed.join("\n") + value.slice(b2.end);

    const firstDelta = transformed[0].length - lines[0].length;
    const chunkDelta = next.length - value.length;
    applyText(
      next,
      {
        start: Math.max(
          b1.start,
          Math.min(start + firstDelta, b1.start + transformed[0].length),
        ),
        end: Math.max(
          b1.start,
          Math.min(end + chunkDelta, b1.start + transformed.join("\n").length),
        ),
      },
      true,
    );
  };

  // ── code block (wrap selected lines in fences) ──────────────

  const toggleCodeBlock = () => {
    const { start, end } = selRef.current;
    const b1 = lineBoundsOf(value, start);
    const b2 = lineBoundsOf(value, end);
    const chunk = value.slice(b1.start, b2.end);
    if (chunk.startsWith("```")) {
      const inner = chunk.replace(/^```[^\n]*\n/, "").replace(/\n?```\s*$/, "");
      const next = value.slice(0, b1.start) + inner + value.slice(b2.end);
      applyText(next, { start: b1.start, end: b1.start + inner.length }, true);
      return;
    }
    const body = chunk.endsWith("\n") ? chunk : `${chunk}\n`;
    const open = "```\n";
    const next =
      value.slice(0, b1.start) + open + body + "```" + value.slice(b2.end);
    applyText(
      next,
      {
        start: b1.start + open.length,
        end: b1.start + open.length + chunk.length,
      },
      true,
    );
  };

  // ── link insert ─────────────────────────────────────────────

  const insertLink = () => {
    const { start, end } = selRef.current;
    const selected = value.slice(start, end);
    if (selected) {
      const insertion = `[${selected}](url)`;
      const urlStart = start + 1 + selected.length + 2;
      applyText(
        value.slice(0, start) + insertion + value.slice(end),
        { start: urlStart, end: urlStart + 3 },
        true,
      );
      return;
    }
    const insertion = "[link text](url)";
    applyText(
      value.slice(0, start) + insertion + value.slice(start),
      { start: start + 1, end: start + 1 + "link text".length },
      true,
    );
  };

  const insertWikiLink = () => wrapInline("[[");

  // ── active-state detection (toolbar highlight) ──────────────

  const cursorLine = (() => {
    const b = lineBoundsOf(value, sel.start);
    return value.slice(b.start, b.end);
  })();

  const paraStart = value.lastIndexOf("\n", Math.max(0, sel.start - 1)) + 1;
  const beforeSel = value.slice(paraStart, sel.start);
  const afterSel = value.slice(sel.end);
  const count = (hay: string, needle: string) => hay.split(needle).length - 1;

  const active = {
    bold: count(beforeSel, "**") % 2 === 1 && afterSel.includes("**"),
    italic: count(beforeSel, "*") % 2 === 1,
    strike: count(beforeSel, "~~") % 2 === 1,
    h1: /^#\s/.test(cursorLine),
    h2: /^##\s/.test(cursorLine),
    h3: /^###\s/.test(cursorLine),
    quote: /^>\s?/.test(cursorLine),
    bullet: /^\s*[-*+]\s+(?!\[)/.test(cursorLine),
    numbered: /^\s*\d+[.)]\s+/.test(cursorLine),
    task: /^\s*[-*+]\s+\[[ xX]\]\s+/.test(cursorLine),
    code: cursorLine.startsWith("```"),
  };

  const canUndo = undoRef.current.length > 0;
  const canRedo = redoRef.current.length > 0;

  // ── toolbar buttons ─────────────────────────────────────────

  const TB = ({
    label,
    icon,
    onPress,
    active: on,
    italic,
    strike,
    disabled,
  }: {
    label?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    active?: boolean;
    italic?: boolean;
    strike?: boolean;
    disabled?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={1}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          minWidth: 34,
          height: 34,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 7,
          backgroundColor: on
            ? palette.primarySoft
            : pressed
              ? palette.cardAlt
              : "transparent",
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      {label ? (
        <Text
          style={{
            fontSize: label.length > 1 ? 12 : 16,
            fontWeight: "800",
            color: on ? palette.primary : palette.text,
            fontStyle: italic ? "italic" : "normal",
            textDecorationLine: strike ? "line-through" : "none",
          }}
        >
          {label}
        </Text>
      ) : icon ? (
        <Ionicons
          name={icon}
          size={17}
          color={on ? palette.primary : palette.textDim}
        />
      ) : null}
    </Pressable>
  );

  const Sep = () => (
    <View
      style={{
        width: 1,
        height: 20,
        backgroundColor: palette.border,
        marginHorizontal: 3,
      }}
    />
  );

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <View>
      <View
        style={{
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: 14,
          backgroundColor: darkBg ? palette.cardAlt : palette.bg,
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
            backgroundColor: palette.card,
            paddingHorizontal: 4,
            paddingVertical: 4,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: "center" }}
          >
            <TB icon="arrow-undo-outline" onPress={undo} disabled={!canUndo} />
            <TB icon="arrow-redo-outline" onPress={redo} disabled={!canRedo} />
            <Sep />
            <TB label="B" onPress={() => wrapInline("**")} active={active.bold} />
            <TB label="I" italic onPress={() => wrapInline("*")} active={active.italic} />
            <TB label="S" strike onPress={() => wrapInline("~~")} active={active.strike} />
            <Sep />
            <TB label="H1" onPress={() => setLinePrefix("# ", "heading")} active={active.h1} />
            <TB label="H2" onPress={() => setLinePrefix("## ", "heading")} active={active.h2} />
            <TB label="H3" onPress={() => setLinePrefix("### ", "heading")} active={active.h3} />
            <TB label="❝" onPress={() => setLinePrefix("> ", "quote")} active={active.quote} />
            <TB icon="code-slash-outline" onPress={toggleCodeBlock} active={active.code} />
            <Sep />
            <TB label="•—" onPress={() => toggleList("bullet")} active={active.bullet} />
            <TB label="1." onPress={() => toggleList("numbered")} active={active.numbered} />
            <TB icon="checkbox-outline" onPress={() => toggleList("task")} active={active.task} />
            <Sep />
            <TB icon="link-outline" onPress={insertLink} />
            {enableWikiLink ? (
              <TB label="[[ ]]" onPress={insertWikiLink} />
            ) : null}
          </ScrollView>
          <Pressable
            onPress={() => setShowPreview((v) => !v)}
            style={{
              paddingHorizontal: 9,
              paddingVertical: 7,
              borderRadius: 10,
              marginLeft: 2,
              backgroundColor: showPreview
                ? palette.primarySoft
                : palette.cardAlt,
            }}
          >
            <Text
              style={{
                color: palette.primary,
                fontSize: 11,
                fontWeight: "800",
              }}
            >
              {showPreview ? "Hide" : "Preview"}
            </Text>
          </Pressable>
        </View>

        {/* Writing surface */}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={palette.textFaint}
          multiline
          autoFocus={autoFocus}
          keyboardType={keyboardType}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          blurOnSubmit={false}
          keyboardAppearance={dark ? "dark" : "light"}
          onSelectionChange={(e) => {
            const s = e.nativeEvent.selection;
            selRef.current = s;
            setSel(s);
          }}
          selection={sel}
          style={[
            styles.input,
            {
              minHeight,
              borderWidth: 0,
              color: palette.text,
              backgroundColor: "transparent",
              textAlignVertical: "top",
              paddingTop: 12,
              paddingBottom: 10,
              lineHeight: 23,
            },
            style,
          ]}
        />
      </View>

      {/* Word count + syntax hint (like the web dialog footer) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
          paddingHorizontal: 2,
        }}
      >
        <Text style={{ color: palette.textFaint, fontSize: 11 }}>
          {words} {words === 1 ? "word" : "words"} · {value.length} chars
        </Text>
        <Text style={{ color: palette.textFaint, fontSize: 11 }} numberOfLines={1}>
          {enableWikiLink ? "[[Note title]] links notes · " : ""}Enter continues lists
        </Text>
      </View>

      {showPreview && value.trim() ? (
        <View
          style={{
            marginTop: 10,
            borderWidth: 1,
            borderColor: palette.border,
            backgroundColor: palette.card,
            borderRadius: 14,
            padding: 14,
            minHeight: 80,
          }}
        >
          <Text
            style={{
              color: palette.textDim,
              fontWeight: "700",
              fontSize: 11,
              letterSpacing: 0.8,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            Preview
          </Text>
          <MiniMarkdown content={value} palette={palette} />
        </View>
      ) : null}
    </View>
  );
}


export function FieldLabel({ children }: { children: string }) {
  const { palette } = usePalette();
  return (
    <Text style={[styles.fieldLabel, { color: palette.textDim }]}>
      {children}
    </Text>
  );
}

// ── Feedback ─────────────────────────────────────────────────

export function EmptyState({
  icon = "leaf-outline",
  title,
  hint,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  const { palette } = usePalette();
  return (
    <View style={styles.empty}>
      <View
        style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}
      >
        <Ionicons name={icon} size={26} color={palette.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {hint ? (
        <Text style={[styles.emptyHint, { color: palette.textDim }]}>
          {hint}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

/** Dashed "nothing here" placeholder like the web app sections. */
export function EmptyNote({ text }: { text: string }) {
  const { palette } = usePalette();
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1.2,
        borderStyle: "dashed",
        borderColor: palette.border,
        backgroundColor: palette.cardAlt,
        paddingHorizontal: 16,
        paddingVertical: 22,
      }}
    >
      <Text
        style={{
          color: palette.textDim,
          fontSize: 13,
          textAlign: "center",
          lineHeight: 19,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

/** Real circular progress ring (SVG) — matches the web ProgressRing. */
export function ProgressRing({
  size,
  progress,
  thickness = 8,
  color,
  trackColor,
  children,
}: {
  size: number;
  progress: number; // 0..1
  thickness?: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = clamped * c;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function Bar({
  value,
  max,
  color,
  height = 8,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
}) {
  const { palette } = usePalette();
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View
      style={[styles.barTrack, { backgroundColor: palette.cardAlt, height }]}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          backgroundColor: color,
          borderRadius: height / 2,
          height,
        }}
      />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator size="small" color="#2dd4a8" />
    </View>
  );
}

/** 7-day week dots (web WeekDots). */
export function WeekDots({
  days,
  doneSet,
  size = 7,
}: {
  days: string[];
  doneSet: Set<string>;
  size?: number;
}) {
  const { palette } = usePalette();
  return (
    <View
      style={{ flexDirection: "row", gap: size * 0.55, alignItems: "center" }}
    >
      {days.map((d) => (
        <View
          key={d}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            backgroundColor: doneSet.has(d) ? palette.primary : palette.cardAlt,
            borderWidth: 1,
            borderColor: doneSet.has(d) ? palette.primary : palette.border,
          }}
        />
      ))}
    </View>
  );
}

// ── Modal bottom sheet (FIXED: content never collapses) ──────

export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { palette } = usePalette();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      transparent
      statusBarTranslucent
    >
      <View style={styles.sheetBackdrop}>
        <Pressable
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ width: "100%", alignItems: "center" }}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: palette.bg,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: palette.text }]}>
                {title}
              </Text>
              <IconBtn name="close" onPress={onClose} size={22} />
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View
                style={[styles.sheetFooter, { borderColor: palette.border }]}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── FAB ──────────────────────────────────────────────────────

export function Fab({
  onPress,
  icon = "add",
  bottom = 96,
}: {
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  bottom?: number;
}) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: palette.primary, bottom },
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Ionicons name={icon} size={26} color={palette.onPrimary} />
    </Pressable>
  );
}

// ── Offline pill ─────────────────────────────────────────────

// ── User avatar (Google profile photo with initials fallback) ──

export function UserAvatar({
  uri,
  name,
  email,
  size = 34,
  borderRadius,
}: {
  uri?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  borderRadius?: number;
}) {
  const { palette } = usePalette();
  const [failed, setFailed] = useState(false);
  const initial = (name ?? email ?? "M").trim().charAt(0).toUpperCase() || "M";
  const showImage = !!uri && !failed;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius ?? 999,
        backgroundColor: palette.primarySoft,
        borderWidth: 1,
        borderColor: palette.border,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {showImage ? (
        <Image
          source={{ uri: uri as string }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
          accessible
          accessibilityLabel={
            name ? `${name}'s profile photo` : "Profile photo"
          }
        />
      ) : (
        <Text
          style={{
            color: palette.primary,
            fontWeight: "800",
            fontSize: Math.max(12, size * 0.4),
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

export function OfflinePill() {
  const { palette } = usePalette();
  const online = useApp((s) => s.online);
  const pending = useApp((s) => s.pending);
  if (online && pending <= 0) return null;
  const count = Math.max(0, pending);
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: online ? palette.warnSoft : palette.cardAlt,
          borderColor: online ? palette.warn : palette.border,
        },
      ]}
    >
      <Ionicons
        name={online ? "cloud-upload-outline" : "cloud-offline-outline"}
        size={13}
        color={online ? palette.warn : palette.textDim}
      />
      <Text
        style={[
          styles.pillText,
          { color: online ? palette.warn : palette.textDim },
        ]}
      >
        {online
          ? `${count} change${count === 1 ? "" : "s"} waiting to sync`
          : "Offline — everything saves on this device"}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenBody: { paddingTop: 4 },
  viewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    marginTop: 6,
  },
  viewHeaderTitle: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  viewHeaderSub: { fontSize: 13.5, marginTop: 3, lineHeight: 18 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.9 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 10 },
  btnLabel: { fontSize: 14.5, fontWeight: "700" },
  btnLabelSmall: { fontSize: 13 },
  iconBtn: { padding: 7, borderRadius: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 4 },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  segmented: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  segmentLabel: { fontSize: 13, fontWeight: "700" },
  toggleTrack: {
    width: 46,
    height: 27,
    borderRadius: 999,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  toggleThumb: { width: 21, height: 21, borderRadius: 999 },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    fontSize: 15,
    minHeight: 46,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 7,
    marginTop: 14,
    textTransform: "uppercase",
  },
  empty: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 24 },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  barTrack: { borderRadius: 999, overflow: "hidden", flex: 1 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4,6,12,0.6)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "90%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(150,160,180,0.35)",
    marginTop: 6,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800" },
  sheetFooter: { borderTopWidth: 1, paddingTop: 12, paddingBottom: 18 },
  fab: {
    position: "absolute",
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  pillText: { fontSize: 11.5, fontWeight: "600", marginLeft: 6 },
});

// Keep RTL support flag referenced (future-proof).
void I18nManager;
