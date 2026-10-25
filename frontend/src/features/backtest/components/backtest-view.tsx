"use client";

import { useEffect } from "react";

import { Panel } from "@/components/common/panel";
import { Pill } from "@/components/common/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { BacktestForm, DEFAULT_BACKTEST, toRequest, type BacktestFormValues } from "@/features/backtest/components/backtest-form";
import { BacktestMetrics } from "@/features/backtest/components/backtest-metrics";
import { BacktestTrades } from "@/features/backtest/components/backtest-trades";
import { EquityCurve } from "@/features/backtest/components/equity-curve";
import { StrategyComparison } from "@/features/backtest/components/strategy-comparison";
import { useBacktest } from "@/hooks/use-backtest";

export function BacktestView() {
  const backtest = useBacktest();
  const { mutate } = backtest;
  const run = (values: BacktestFormValues) => mutate(toRequest(values));

  // open with a real result instead of an empty page
  useEffect(() => {
    mutate(toRequest(DEFAULT_BACKTEST));
  }, [mutate]);

  const result = backtest.data;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold">Backtest Lab</h1>
          <p className="text-xs text-muted-foreground">
            The live strategy and risk engine replayed on real Delta India candles
            {result ? ` · ${result.metrics.period.replace(/:00\+00:00/g, "").replace(" -> ", " to ")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill>Fills at next candle open</Pill>
          <Pill>Stop checked before target</Pill>
          <Pill>
            {result?.commission_pct !== undefined
              ? `${result.commission_pct.toFixed(3)}% fee/side applied`
              : "0.053% fee/side applied"}
          </Pill>
          {result?.resolution && <Pill tone="accent">{result.resolution} candles</Pill>}
        </div>
      </div>

      <StrategyComparison />

      <div className="flex flex-wrap items-start gap-5">
        <BacktestForm onRun={run} running={backtest.isPending} />
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5">
          {backtest.isError ? (
            <Panel title="Backtest failed">
              <p className="text-sm text-kill">{backtest.error.message}</p>
            </Panel>
          ) : (
            <>
              {result && !backtest.isPending && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {result.strategy === "stoch_sma_66" ? "Stochasticate Momentum 66" : "Trend Regime"}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-mono font-medium text-primary">{result.resolution}</span>
                    <span className="text-muted-foreground">·</span>
                    <span>{result.days} days</span>
                    <span className="text-muted-foreground">·</span>
                    <span>
                      Fee: <strong className="font-mono text-foreground">{result.commission_pct ?? 0.053}%</strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    {result.strategy === "stoch_sma_66" ? (
                      <>
                        <span>MA: {result.params.sma_period ?? 66}</span>
                        <span>%K: {result.params.k_period ?? 14} (sm: {result.params.smooth_k ?? 2})</span>
                        <span>Levels: {result.params.level_low ?? 20}/{result.params.level_high ?? 60}</span>
                        <span>R:R: 1:{result.params.rr_ratio ?? 2}</span>
                      </>
                    ) : (
                      <>
                        <span>ADX: {result.params.adx_threshold ?? 20}</span>
                        <span>ATR: {result.params.trail_atr ?? 3}x</span>
                        <span>Mode: {result.params.entry_mode ?? "fresh"}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              <BacktestMetrics metrics={result?.metrics} loading={backtest.isPending} />
              {result && !backtest.isPending ? (
                <>
                  <EquityCurve result={result} />
                  {result.trades.length > 0 && <BacktestTrades trades={result.trades} />}
                </>
              ) : (
                <Skeleton className="h-[320px] rounded-xl" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}