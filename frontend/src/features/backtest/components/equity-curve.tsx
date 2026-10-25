"use client";

import { AreaSeries, ColorType, createChart, LineStyle, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useEffect, useRef } from "react";

import { Panel } from "@/components/common/panel";
import { toTime } from "@/features/desk/lib/chart-data";
import { useChartColors } from "@/hooks/use-chart-colors";
import type { ChartColors } from "@/lib/constants";
import { fmtUsd, parseTime } from "@/lib/format";
import type { BacktestResult } from "@/types/api";

export function EquityCurve({ result }: { result: BacktestResult }) {
  const { mode, colors } = useChartColors();
  return <EquityCurveInner key={mode} result={result} colors={colors} />;
}

function EquityCurveInner({ result, colors }: { result: BacktestResult; colors: ChartColors }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<{ chart: IChartApi; series: ISeriesApi<"Area"> } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: colors.surface },
        textColor: colors.text,
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains").trim() || "monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: colors.accent,
      topColor: `${colors.accent}38`,
      bottomColor: `${colors.accent}05`,
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    refs.current = { chart, series };
    return () => {
      chart.remove();
      refs.current = null;
    };
  }, [colors]);

  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const seen = new Set<number>();
    const data = result.equity_curve
      .map((p) => ({ time: toTime(Math.floor(parseTime(p.time).getTime() / 1000)), value: p.equity }))
      .filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true)));
    r.series.setData(data);
    r.series.createPriceLine({
      price: result.metrics.start_equity, color: colors.text, lineStyle: LineStyle.Dotted, title: "start",
    });
    r.chart.timeScale().fitContent();
  }, [result, colors.text]);

  const peak = Math.max(...result.equity_curve.map((p) => p.equity));
  return (
    <Panel
      title="Equity curve"
      aside={`${fmtUsd(result.metrics.start_equity)} start · ${fmtUsd(result.metrics.end_equity)} end · peak ${fmtUsd(peak)}`}
    >
      <div className="relative h-[260px] w-full overflow-hidden rounded-lg">
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </Panel>
  );
}
