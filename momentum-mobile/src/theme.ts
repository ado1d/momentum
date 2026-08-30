// Momentum mobile theme — mirrors the web app's oklch-derived palette
// (emerald primary, warm-white light surface, dark-navy dark surface).

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
  card: "#1a1f2e",
  cardAlt: "#242a3d",
  border: "#2b3145",
  text: "#f2f4f8",
  textDim: "#9aa3b8",
  textFaint: "#616b82",
  primary: "#2dd4a8",
  primaryDim: "#1a8f74",
  primarySoft: "rgba(45,212,168,0.13)",
  onPrimary: "#08251d",
  danger: "#fb7185",
  dangerSoft: "rgba(251,113,133,0.13)",
  warn: "#fbbf24",
  warnSoft: "rgba(251,191,36,0.13)",
  ok: "#34d399",
  tabBar: "#141826",
  shadow: "#000000",
};

export const lightPalette: Palette = {
  bg: "#fafbf8",
  card: "#ffffff",
  cardAlt: "#f0f2ec",
  border: "#e2e5da",
  text: "#232936",
  textDim: "#5f6779",
  textFaint: "#9ba2b2",
  primary: "#067857",
  primaryDim: "#055f46",
  primarySoft: "rgba(6,120,87,0.10)",
  onPrimary: "#ffffff",
  danger: "#dc2626",
  dangerSoft: "rgba(220,38,38,0.09)",
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
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#94a3b8",
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

export const QUOTES: { text: string; author: string }[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "Small deeds done are better than great deeds planned.", author: "Peter Marshall" },
  {
    text: "You do not rise to the level of your goals; you fall to the level of your systems.",
    author: "James Clear",
  },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Do the hard jobs first. The easy jobs will take care of themselves.", author: "Dale Carnegie" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
];

/** Deterministic quote for the day (mirrors the web app's day-index pick). */
export function quoteForDay(key: string): { text: string; author: string } {
  const digits = key.split("-").join("");
  const n = parseInt(digits, 10);
  return QUOTES[Number.isFinite(n) ? n % QUOTES.length : 0];
}
