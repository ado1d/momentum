// Momentum mobile theme — mirrors the web app's dark-navy + emerald palette.

export type ThemeMode = "system" | "light" | "dark";

export interface Palette {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  primary: string;
  primaryDim: string;
  primarySoft: string;
  onPrimary: string;
  danger: string;
  dangerSoft: string;
  warn: string;
  warnSoft: string;
  ok: string;
  tabBar: string;
  shadow: string;
}

export const darkPalette: Palette = {
  bg: "#10131c",
  card: "#191e2e",
  cardAlt: "#222840",
  border: "#2a3045",
  text: "#f2f4f8",
  textDim: "#9aa3b8",
  textFaint: "#616b82",
  primary: "#2dd4a8",
  primaryDim: "#1a8f74",
  primarySoft: "rgba(45,212,168,0.14)",
  onPrimary: "#08251d",
  danger: "#fb7185",
  dangerSoft: "rgba(251,113,133,0.14)",
  warn: "#fbbf24",
  warnSoft: "rgba(251,191,36,0.14)",
  ok: "#34d399",
  tabBar: "#141826",
  shadow: "#000000",
};

export const lightPalette: Palette = {
  bg: "#f4f6f3",
  card: "#ffffff",
  cardAlt: "#ecefe9",
  border: "#dfe3da",
  text: "#1c2233",
  textDim: "#5c6577",
  textFaint: "#9aa1b0",
  primary: "#0d9488",
  primaryDim: "#0f766e",
  primarySoft: "rgba(13,148,136,0.12)",
  onPrimary: "#ffffff",
  danger: "#e11d48",
  dangerSoft: "rgba(225,29,72,0.10)",
  warn: "#b45309",
  warnSoft: "rgba(180,83,9,0.10)",
  ok: "#059669",
  tabBar: "#ffffff",
  shadow: "#3b4256",
};

export const ACCENTS: Record<string, string> = {
  emerald: "#34d399",
  amber: "#fbbf24",
  rose: "#fb7185",
  violet: "#a78bfa",
  teal: "#2dd4bf",
  orange: "#fb923c",
};

export const NOTE_COLORS: Record<string, { bg: string; border: string }> = {
  default: { bg: "transparent", border: "" },
  yellow: { bg: "rgba(251,191,36,0.12)", border: "#8a6a17" },
  green: { bg: "rgba(52,211,153,0.12)", border: "#1f7a58" },
  rose: { bg: "rgba(251,113,133,0.12)", border: "#8f3a4c" },
  violet: { bg: "rgba(167,139,250,0.12)", border: "#5d4a91" },
  teal: { bg: "rgba(45,212,191,0.12)", border: "#1a7a6d" },
};

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#fb7185",
  high: "#fb923c",
  medium: "#fbbf24",
  low: "#64748b",
};

export const MOODS: { key: string; emoji: string; label: string; color: string }[] = [
  { key: "great", emoji: "😄", label: "Great", color: "#34d399" },
  { key: "good", emoji: "🙂", label: "Good", color: "#2dd4bf" },
  { key: "okay", emoji: "😐", label: "Okay", color: "#fbbf24" },
  { key: "low", emoji: "😕", label: "Low", color: "#fb923c" },
  { key: "rough", emoji: "😣", label: "Rough", color: "#fb7185" },
];

export function accentColor(name: string | null | undefined): string {
  return ACCENTS[name ?? "emerald"] ?? ACCENTS.emerald;
}
