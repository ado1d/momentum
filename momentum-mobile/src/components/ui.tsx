// Shared UI building blocks — dark-navy/emerald Momentum look.

import React, { ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { darkPalette, lightPalette, type Palette } from "../theme";
import { useApp } from "../store";

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
}: {
  children: ReactNode;
  scroll?: boolean;
  pad?: boolean;
}) {
  const { palette } = usePalette();
  const body = (
    <View style={[styles.screenBody, pad && { paddingHorizontal: 16 }]}>{children}</View>
  );
  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>{body}</ScrollView> : body}
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { palette } = usePalette();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.headerSub, { color: palette.textDim }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ── Surfaces ─────────────────────────────────────────────────

export function Card({ children, style, onPress }: { children: ReactNode; style?: object; onPress?: () => void }) {
  const { palette } = usePalette();
  const base = [
    styles.card,
    { backgroundColor: palette.card, borderColor: palette.border },
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  const { palette } = usePalette();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: palette.textDim }]}>{children.toUpperCase()}</Text>
      {action}
    </View>
  );
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
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "ghost" | "danger" | "soft";
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
  disabled?: boolean;
  style?: object;
}) {
  const { palette } = usePalette();
  const bg =
    variant === "primary"
      ? palette.primary
      : variant === "danger"
        ? palette.dangerSoft
        : variant === "soft"
          ? palette.primarySoft
          : "transparent";
  const fg =
    variant === "primary"
      ? palette.onPrimary
      : variant === "danger"
        ? palette.danger
        : variant === "soft"
          ? palette.primary
          : palette.textDim;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, borderColor: variant === "ghost" ? palette.border : "transparent" },
        variant === "ghost" && styles.btnGhost,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 14 : 17} color={fg} style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.btnLabel, small && styles.btnLabelSmall, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function IconBtn({
  name,
  onPress,
  color,
  size = 22,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  size?: number;
}) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
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
      style={[
        styles.chip,
        small && styles.chipSmall,
        {
          backgroundColor: active ? accent : palette.cardAlt,
          borderColor: active ? accent : palette.border,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          small && { fontSize: 11, paddingVertical: 2 },
          { color: active ? (color ? "#0b0f18" : palette.onPrimary) : palette.textDim },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
    <View style={[styles.segmented, { backgroundColor: palette.cardAlt, borderColor: palette.border }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segment,
              active && { backgroundColor: palette.primary },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.segmentLabel, { color: active ? palette.onPrimary : palette.textDim }]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { palette } = usePalette();
  return (
    <Pressable onPress={() => onChange(!value)} hitSlop={8}>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? palette.primary : palette.cardAlt, borderColor: value ? palette.primary : palette.border },
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
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: object;
  autoFocus?: boolean;
  keyboardType?: "default" | "numeric" | "email-address";
  onSubmitEditing?: () => void;
  darkBg?: boolean;
}) {
  const { palette } = usePalette();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={palette.textFaint}
      multiline={multiline}
      autoFocus={autoFocus}
      keyboardType={keyboardType}
      onSubmitEditing={onSubmitEditing}
      style={[
        styles.input,
        multiline && { minHeight: 110, textAlignVertical: "top", paddingTop: 12 },
        {
          color: palette.text,
          backgroundColor: darkBg ? palette.cardAlt : palette.card,
          borderColor: palette.border,
        },
        style,
      ]}
    />
  );
}

export function FieldLabel({ children }: { children: string }) {
  const { palette } = usePalette();
  return <Text style={[styles.fieldLabel, { color: palette.textDim }]}>{children}</Text>;
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
      <View style={[styles.emptyIcon, { backgroundColor: palette.primarySoft }]}>
        <Ionicons name={icon} size={26} color={palette.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: palette.text }]}>{title}</Text>
      {hint ? <Text style={[styles.emptyHint, { color: palette.textDim }]}>{hint}</Text> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

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
  // Simple arc via border tricks is jittery — draw a segmented ring of dots.
  const segments = 36;
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const dots = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
    const filled = i / segments < clamped;
    const dotSize = i % 3 === 0 ? thickness : thickness * 0.66;
    dots.push(
      <View
        key={i}
        style={{
          position: "absolute",
          left: center + Math.cos(angle) * radius - dotSize / 2,
          top: center + Math.sin(angle) * radius - dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: filled ? color : trackColor,
        }}
      />,
    );
  }
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {dots}
      <View style={{ alignItems: "center", justifyContent: "center" }}>{children}</View>
    </View>
  );
}

export function Bar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const { palette } = usePalette();
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <View style={[styles.barTrack, { backgroundColor: palette.cardAlt, height }]}>
      <View style={{ width: `${pct * 100}%`, backgroundColor: color, borderRadius: height / 2, height }} />
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

// ── Modal sheet ──────────────────────────────────────────────

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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
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
            <Text style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text>
            <IconBtn name="close" onPress={onClose} size={24} />
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {children}
          </ScrollView>
          {footer ? (
            <View style={[styles.sheetFooter, { borderColor: palette.border }]}>{footer}</View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ── FAB ──────────────────────────────────────────────────────

export function Fab({ onPress, icon = "add" }: { onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { palette } = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: palette.primary },
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Ionicons name={icon} size={26} color={palette.onPrimary} />
    </Pressable>
  );
}

// ── Offline pill ─────────────────────────────────────────────

export function OfflinePill() {
  const { palette } = usePalette();
  const online = useApp((s) => s.online);
  const pending = useApp((s) => s.pending);
  if (online && pending <= 0) return null;
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
      <Text style={[styles.pillText, { color: online ? palette.warn : palette.textDim }]}>
        {online
          ? `${pending} change${pending === 1 ? "" : "s"} waiting to sync`
          : "Offline — everything saves on this device"}
      </Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenBody: { paddingTop: 8 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  headerTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 9 },
  btnGhost: { borderWidth: 1 },
  btnLabel: { fontSize: 15, fontWeight: "700" },
  btnLabelSmall: { fontSize: 13 },
  iconBtn: { padding: 6 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  chipSmall: { paddingHorizontal: 9, paddingVertical: 3 },
  chipLabel: { fontSize: 13, fontWeight: "600" },
  segmented: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginVertical: 10,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  segmentLabel: { fontSize: 13, fontWeight: "700" },
  toggleTrack: { width: 48, height: 28, borderRadius: 999, borderWidth: 1, padding: 2, justifyContent: "center" },
  toggleThumb: { width: 22, height: 22, borderRadius: 999 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  fieldLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6, marginTop: 14, textTransform: "uppercase" },
  empty: { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24 },
  emptyIcon: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  barTrack: { borderRadius: 999, overflow: "hidden", flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  sheetGrabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 999, backgroundColor: "rgba(150,160,180,0.35)", marginTop: 6, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800" },
  sheetFooter: { borderTopWidth: 1, paddingTop: 12, paddingBottom: 20 },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 18,
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
    marginBottom: 10,
  },
  pillText: { fontSize: 11.5, fontWeight: "600", marginLeft: 6 },
});
