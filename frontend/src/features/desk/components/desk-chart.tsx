"use client";

import { useMemo, useState } from "react";

import { Panel } from "@/components/common/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CandleChart, type ChartPriceLine } from "@/features/charts/candle-chart";
import { toTradeMarkers } from "@/features/desk/lib/chart-data";
import { useStatus, useTrades } from "@/hooks/use-bot";
import { useChartColors } from "@/hooks/use-chart-colors";
import { useCandles } from "@/hooks/use-market";
import { CHART_TIMEFRAMES } from "@/lib/constants";
import { useLiveStore } from "@/stores/live-store";

/** Live chart of the bot's own symbol: what the strategy sees, where it traded, where its stop is. */
export function DeskChart() {
  const { data: status } = useStatus();
  const [picked, setPicked] = useState<string | null>(null);
  const timeframe = picked ?? status?.resolution ?? "1h";
  const { data: candles, isPending, isError, error } = useCandles(300, timeframe);
  const { data: trades } = useTrades(100);
  const tick = useLiveStore((s) => s.tick);
  const { colors } = useChartColors();

  const symbolTrades = useMemo(() => (trades ?? []).filter((t) => t.symbol === status?.symbol), [trades, status?.symbol]);
  const markers = useMemo(
    () => (candles?.length ? toTradeMarkers(symbolTrades, timeframe, candles[0].time) : []),
    [symbolTrades, timeframe, candles],
  );

  const pos = status?.position;
  const priceLines = useMemo<ChartPriceLine[]>(() => {
    if (!pos || pos.side === "flat") return [];
    const lines: ChartPriceLine[] = [{ id: "entry", price: pos.entry_price, title: "entry", color: colors.navy }];
    if (pos.stop) lines.push({ id: "stop", price: pos.stop, title: "stop", color: colors.warn, dashed: true });
    if (pos.take_profit) lines.push({ id: "tp", price: pos.take_profit, title: "target", color: colors.long, dashed: true });
    return lines;
  }, [pos, colors]);

  return (
    <Panel
      title={status ? `${status.symbol} · ${timeframe}` : "Chart"}
      aside={
        <ToggleGroup
          aria-label="Timeframe"
          variant="outline"
          size="sm"
          value={[timeframe]}
          onValueChange={(v) => v[0] && setPicked(v[0])}
        >
          {CHART_TIMEFRAMES.map((tf) => (
            <ToggleGroupItem key={tf} value={tf} className="font-mono text-xs data-pressed:bg-primary data-pressed:text-primary-foreground">
              {tf}
              {tf === status?.resolution ? " ●" : ""}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      {isError ? (
        <p className="rounded-xl border border-kill-line bg-kill-soft p-4 text-sm text-kill">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-115 rounded-xl" />
      ) : (
        <CandleChart
          candles={candles ?? []}
          markers={markers}
          priceLines={priceLines}
          liveTick={timeframe === status?.resolution ? tick?.price : null}
          adxThreshold={Number(status?.params.adx_threshold ?? 20)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        ● = the timeframe the bot trades on. Blue = EMA 20, dashed amber = EMA 50, lower pane = ADX with the trend
        threshold. Times shown in your local time.
      </p>
    </Panel>
  );
}
