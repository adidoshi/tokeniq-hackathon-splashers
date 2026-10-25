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
          <Pill>0.053% taker fee each side</Pill>
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
