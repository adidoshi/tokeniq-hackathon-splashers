"use client";

import { useTheme } from "next-themes";

import { CHART_THEMES } from "@/lib/constants";

/** Canvas colours for the active theme. Charts live under ClientOnly, so the theme is resolved by then. */
export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const mode = resolvedTheme === "light" ? "light" : "dark";
  return { mode, colors: CHART_THEMES[mode] } as const;
}
