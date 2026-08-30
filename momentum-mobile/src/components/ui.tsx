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
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
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
  bottomPad = 24,
}: {
  children: ReactNode;
  scroll?: boolean;
  pad?: boolean;
  bottomPad?: number;
}) {
  const { palette } = usePalette();
  const body = (
    <View style={[styles.screenBody, pad && { paddingHorizontal: 16 }]}>{children}</View>
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
        <Text style={[styles.viewHeaderTitle, { color: palette.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.viewHeaderSub, { color: palette.textDim }]}>{subtitle}</Text>
        ) : null}
      </View>
      {actions ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{actions}</View> : null}
    </View>
  );
}

/** Header for stack-pushed screens: back chevron + title/subtitle + actions. */
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
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 8,
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
        <Text style={{ color: palette.text, fontSize: 19, fontWeight: "800", letterSpacing: -0.3 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: palette.textDim, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
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
    <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={{ padding: 4 }}>
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
      <Text style={[styles.sectionTitle, { color: palette.textDim }]}>{title.toUpperCase()}</Text>
      {action}
    </View>
  );
}

/** "See all →" ghost link like the web dashboard. */
export function SeeAll({ label = "See all", onPress }: { label?: string; onPress: () => void }) {
  const { palette } = usePalette();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ flexDirection: "row", alignItems: "center" }}>
      <Text style={{ color: palette.textDim, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <Ionicons name="chevron-forward" size={13} color={palette.textDim} style={{ marginLeft: 1 }} />
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
  const base = [styles.card, { backgroundColor: palette.card, borderColor: palette.border }, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.82 }]}>
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
        <Ionicons name={icon} size={small ? 14 : 17} color={fg} style={{ marginRight: 7 }} />
      ) : null}
      <Text style={[styles.btnLabel, small && styles.btnLabelSmall, { color: fg }]}>{label}</Text>
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
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
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
      returnKeyType={returnKeyType}
      style={[
        styles.input,
        multiline && { minHeight: 110, textAlignVertical: "top", paddingTop: 12 },
        {
          color: palette.text,
          backgroundColor: darkBg ? palette.cardAlt : palette.bg,
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
      <Text style={{ color: palette.textDim, fontSize: 13, textAlign: "center", lineHeight: 19 }}>
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
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
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
      <View style={{ position: "absolute", alignItems: "center", justifyContent: "center" }}>
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

/** 7-day week dots (web WeekDots). */
export function WeekDots({ days, doneSet, size = 7 }: { days: string[]; doneSet: Set<string>; size?: number }) {
  const { palette } = usePalette();
  return (
    <View style={{ flexDirection: "row", gap: size * 0.55, alignItems: "center" }}>
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent statusBarTranslucent>
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
              <Text style={[styles.sheetTitle, { color: palette.text }]}>{title}</Text>
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
              <View style={[styles.sheetFooter, { borderColor: palette.border }]}>{footer}</View>
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
          accessibilityLabel={name ? `${name}'s profile photo` : "Profile photo"}
        />
      ) : (
        <Text style={{ color: palette.primary, fontWeight: "800", fontSize: Math.max(12, size * 0.4) }}>
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
      <Text style={[styles.pillText, { color: online ? palette.warn : palette.textDim }]}>
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
  viewHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, marginTop: 6 },
  viewHeaderTitle: { fontSize: 23, fontWeight: "800", letterSpacing: -0.4 },
  viewHeaderSub: { fontSize: 13.5, marginTop: 3, lineHeight: 18 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 },
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
  segment: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: "center", borderWidth: 1, borderColor: "transparent" },
  segmentLabel: { fontSize: 13, fontWeight: "700" },
  toggleTrack: { width: 46, height: 27, borderRadius: 999, borderWidth: 1, padding: 2, justifyContent: "center" },
  toggleThumb: { width: 21, height: 21, borderRadius: 999 },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    fontSize: 15,
    minHeight: 46,
  },
  fieldLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, marginBottom: 7, marginTop: 14, textTransform: "uppercase" },
  empty: { alignItems: "center", paddingVertical: 30, paddingHorizontal: 24 },
  emptyIcon: { width: 54, height: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  emptyHint: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  barTrack: { borderRadius: 999, overflow: "hidden", flex: 1 },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(4,6,12,0.6)", justifyContent: "flex-end", alignItems: "center" },
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
  sheetGrabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 999, backgroundColor: "rgba(150,160,180,0.35)", marginTop: 6, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
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
