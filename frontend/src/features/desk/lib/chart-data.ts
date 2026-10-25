import type { SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";

import { CHART_COLORS, RESOLUTION_SECONDS } from "@/lib/constants";
import { parseTime } from "@/lib/format";
import type { Side } from "@/types/api";

/** Pure mapping functions from API data to chart data, kept out of components so they're testable. */

export const toTime = (seconds: number) => seconds as UTCTimestamp;

/** The fields markers need; satisfied by both live `Trade` and `BacktestTrade`. */
export interface MarkerTrade {
  side: Exclude<Side, "flat">;
  size: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
}

/** Snap a trade timestamp onto the start of the candle that contains it. */
export function barTime(iso: string, resolution: string): UTCTimestamp {
  const step = RESOLUTION_SECONDS[resolution] ?? 3600;
  return toTime(Math.floor(parseTime(iso).getTime() / 1000 / step) * step);
}

/** Entry arrows (green long / red short) and exit dots coloured by P&L, limited to the visible bars. */
export function toTradeMarkers(trades: MarkerTrade[], resolution: string, firstBar: number, lastBar = Infinity) {
  const markers: SeriesMarker<Time>[] = [];
  for (const t of trades) {
    const long = t.side === "long";
    const entry = barTime(t.entry_time, resolution);
    if (entry >= firstBar && entry <= lastBar) {
      markers.push({
        time: entry,
        position: long ? "belowBar" : "aboveBar",
        shape: long ? "arrowUp" : "arrowDown",
        color: long ? CHART_COLORS.long : CHART_COLORS.short,
        text: `${long ? "LONG" : "SHORT"} ${t.size}`,
      });
    }
    if (t.exit_time && t.pnl != null) {
      const exit = barTime(t.exit_time, resolution);
      if (exit >= firstBar && exit <= lastBar) {
        markers.push({
          time: exit,
          position: long ? "aboveBar" : "belowBar",
          shape: "circle",
          color: t.pnl >= 0 ? CHART_COLORS.long : CHART_COLORS.short,
          text: `${t.pnl >= 0 ? "+" : "−"}$${Math.abs(t.pnl).toFixed(2)}`,
        });
      }
    }
  }
  return markers.sort((a, b) => Number(a.time) - Number(b.time));
}
