"use client";

import { useMemo, useState } from "react";
import { Activity, ShieldAlert } from "lucide-react";

import { Panel } from "@/components/common/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CandleChart, type ChartPriceLine } from "@/features/charts/candle-chart";
import { toTradeMarkers } from "@/features/desk/lib/chart-data";
import { useSelectStrategy, useStatus, useTrades } from "@/hooks/use-bot";
import { useChartColors } from "@/hooks/use-chart-colors";
import { useCandles } from "@/hooks/use-market";
import { CHART_TIMEFRAMES } from "@/lib/constants";
import { useLiveStore } from "@/stores/live-store";
import { cn } from "@/lib/utils";

const STRATEGY_OPTIONS = [
  { id: "trend_regime", label: "Trade Regime Follower", short: "Trend Regime" },
  { id: "stoch_sma_66", label: "Stochasticate Momentum 66", short: "Stoch 66" },
] as const;

/** Live chart of the bot's own symbol: what the strategy sees, where it traded, where its stop is. */
export function DeskChart() {
  const { data: status } = useStatus();
  const selectStrategy = useSelectStrategy();
  const [picked, setPicked] = useState<string | null>(null);
  const timeframe = picked ?? status?.resolution ?? "1h";
  const { data: candles, isPending, isError, error } = useCandles(300, timeframe, status?.strategy);
  const { data: trades } = useTrades(100);
  const tick = useLiveStore((s) => s.tick);
  const { colors } = useChartColors();

  const symbolTrades = useMemo(() => (trades ?? []).filter((t) => t.symbol === status?.symbol), [trades, status?.symbol]);
  const markers = useMemo(
    () => (candles?.length ? toTradeMarkers(symbolTrades, timeframe, candles[0].time) : []),
    [symbolTrades, timeframe, candles],
  );

  const pos = status?.position;
  const isPositionOpen = pos && pos.side !== "flat";
  const activeStrategy = status?.strategy ?? "trend_regime";

  const priceLines = useMemo<ChartPriceLine[]>(() => {
    if (!pos || pos.side === "flat") return [];
    const lines: ChartPriceLine[] = [{ id: "entry", price: pos.entry_price, title: "entry", color: colors.navy }];
    if (pos.stop) lines.push({ id: "stop", price: pos.stop, title: "stop", color: colors.warn, dashed: true });
    if (pos.take_profit) lines.push({ id: "tp", price: pos.take_profit, title: "target", color: colors.long, dashed: true });
    return lines;
  }, [pos, colors]);

  const handleStrategyChange = (newStrategy: string) => {
    if (!newStrategy || newStrategy === activeStrategy) return;
    selectStrategy.mutate({ strategy: newStrategy });
  };

  return (
    <Panel
      title={status ? `${status.symbol} · ${timeframe}` : "Chart"}
      aside={
        <div className="flex flex-wrap items-center gap-2">
          {/* Strategy Selector Toggle */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
            {STRATEGY_OPTIONS.map((st) => {
              const isActive = activeStrategy === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  disabled={selectStrategy.isPending}
                  onClick={() => handleStrategyChange(st.id)}
                  title={isPositionOpen ? "Position open: cannot switch strategy mid-trade" : st.label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    isPositionOpen && !isActive && "cursor-not-allowed opacity-50",
                  )}
                >
                  <Activity className={cn("size-3", isActive ? "animate-pulse" : "opacity-40")} />
                  <span className="hidden sm:inline">{st.label}</span>
                  <span className="inline sm:hidden">{st.short}</span>
                </button>
              );
            })}
          </div>

          {/* Timeframe Toggle */}
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
        </div>
      }
    >
      {isPositionOpen && (
        <div className="flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs text-warn">
          <ShieldAlert className="size-4 shrink-0" />
          <span>Active position open ({pos.side.toUpperCase()}). Strategy cannot be switched until this trade closes to protect exchange-side orders.</span>
        </div>
      )}

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
          strategy={activeStrategy}
        />
      )}
      <p className="text-xs text-muted-foreground">
        ● = bot execution timeframe.{" "}
        {activeStrategy === "stoch_sma_66" ? (
          <>
            <b className="text-foreground">Stochasticate Momentum 66:</b> Blue = 66 SMA on price, lower pane = Stoch %K (14, 2) with Upper 60 and Lower 20 levels (%D hidden). 4-bar extreme stop loss, 1:2 R:R bracket target.
          </>
        ) : (
          <>
            <b className="text-foreground">Trade Regime Follower:</b> Blue = EMA 20, dashed amber = EMA 50, lower pane = ADX with the trend threshold. Times shown in your local time.
          </>
        )}
      </p>
    </Panel>
  );
}
