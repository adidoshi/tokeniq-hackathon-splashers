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

  useEffect(() => {
    mutate(toRequest(DEFAULT_BACKTEST));
  }, [mutate]);

  const result = backtest.data;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground uppercase">
            Backtest &amp; Quantitative Lab
          </h1>
          <p className="text-xs text-muted-foreground">
            Vectorized and event-driven simulation on real Delta Exchange India BTC candles
            {result ? ` · ${result.metrics.period.replace(/:00\+00:00/g, "").replace(" -> ", " to ")}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill mono>Next-Bar Open</Pill>
          <Pill mono>Pessimistic SL Check</Pill>
          <Pill tone="ok" mono>
            {result?.commission_pct !== undefined
              ? `${result.commission_pct.toFixed(3)}% Fee/Side`
              : "0.053% Fee/Side"}
          </Pill>
          {result?.resolution && <Pill tone="accent" mono>{result.resolution} Candles</Pill>}
        </div>
      </div>

      <StrategyComparison />

      <div className="flex flex-wrap items-start gap-4">
        <BacktestForm onRun={run} running={backtest.isPending} />
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          {backtest.isError ? (
            <Panel title="Simulation Failed">
              <p className="text-xs font-mono text-kill">{backtest.error.message}</p>
            </Panel>
          ) : (
            <>
              {result && !backtest.isPending && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/70 bg-card p-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {result.strategy === "stoch_sma_66" || result.strategy === "strategy_guide" ? "Strategy Guide" : "Trade Regime Follower"}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-mono font-bold text-primary">{result.resolution}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-mono">{result.days} Days</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-mono text-muted-foreground">
                      Fee: <strong className="text-foreground">{result.commission_pct ?? 0.053}%</strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    {result.strategy === "stoch_sma_66" || result.strategy === "strategy_guide" ? (
                      <>
                        <span>SMA: {result.params.sma_period ?? 100}</span>
                        <span>%K: {result.params.k_period ?? 16}</span>
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
                <Skeleton className="h-[300px] rounded" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
