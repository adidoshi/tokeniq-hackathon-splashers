import type { Side } from "@/types/api";

/** Resolutions Delta actually serves (no sub-minute history exists). Mirrors backend RESOLUTION_SECONDS. */
export const RESOLUTION_SECONDS: Record<string, number> = {
  "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
  "1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "1d": 86400,
};

export const CHART_TIMEFRAMES = ["1m", "5m", "15m", "1h"] as const;

/**
 * Hex values for canvas charts (Tailwind classes can't reach them). Keep in sync with globals.css tokens.
 * long / short / warn are identical in both themes so trade markers stay readable on either background;
 * the rest follow the theme (read it with `useChartColors`).
 */
const CHART_BASE = {
  long: "#10b981",
  short: "#ef4444",
  warn: "#f59e0b",
  volumeUp: "rgba(16, 185, 129, 0.28)",
  volumeDown: "rgba(239, 68, 68, 0.28)",
} as const;

export const CHART_THEMES = {
  light: {
    ...CHART_BASE,
    surface: "#ffffff",
    grid: "#f2f4f7",
    border: "#e8ebf0",
    text: "#5b6275",
    foreground: "#111114",
    navy: "#00225a", // crosshair label, ADX line, entry line
    accent: "#536cf0", // EMA fast, crosshair
    emaSlow: "#d97706", // EMA slow
  },
  dark: {
    ...CHART_BASE,
    surface: "#0d1322",
    grid: "#18213a",
    border: "#252f4d",
    text: "#8a94b0",
    foreground: "#e8ecf8",
    navy: "#8aa4ff",
    accent: "#7c8bff",
    emaSlow: "#fbbf24",
  },
} as const;

export type ChartColors = (typeof CHART_THEMES)[keyof typeof CHART_THEMES];
/** Theme-independent colours (markers). Components that follow the theme use `useChartColors`. */
export const CHART_COLORS = CHART_THEMES.light;

export const SIDE_TEXT_CLASS: Record<Side, string> = {
  long: "text-long",
  short: "text-short",
  flat: "text-muted-foreground",
};

export const MAX_EVENTS = 200;
