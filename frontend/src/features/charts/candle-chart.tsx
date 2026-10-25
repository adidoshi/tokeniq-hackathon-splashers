"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

import { toTime } from "@/features/desk/lib/chart-data";
import { useChartColors } from "@/hooks/use-chart-colors";
import { CHART_COLORS, type ChartColors } from "@/lib/constants";
import { fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Candle } from "@/types/api";

export interface ChartPriceLine {
  id: string;
  price: number;
  title: string;
  color: string;
  dashed?: boolean;
}

interface CandleChartProps {
  candles: Candle[];
  markers?: SeriesMarker<Time>[];
  priceLines?: ChartPriceLine[];
  /** latest traded price: updates the forming (last) candle between REST refreshes */
  liveTick?: number | null;
  adxThreshold?: number;
  strategy?: string;
  /** bars visible when data first loads */
  initialBars?: number;
  className?: string;
}

interface Refs {
  chart: IChartApi;
  candle: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
  // trend_regime
  emaFast?: ISeriesApi<"Line">;
  emaSlow?: ISeriesApi<"Line">;
  adx?: ISeriesApi<"Line">;
  // stoch_sma_66
  sma66?: ISeriesApi<"Line">;
  stochK?: ISeriesApi<"Line">;
  markers: ISeriesMarkersPluginApi<Time>;
  lines: Map<string, IPriceLine>;
  prev: { len: number; first: number };
  ranged: boolean;
}

const localDate = (t: Time) => new Date(Number(t) * 1000);
const tickLabel = (t: Time, type: TickMarkType) =>
  type <= TickMarkType.DayOfMonth
    ? localDate(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : localDate(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function bar(c: Candle) {
  return { time: toTime(c.time), open: c.open, high: c.high, low: c.low, close: c.close };
}
function vol(c: Candle) {
  return { time: toTime(c.time), value: c.volume, color: c.close >= c.open ? CHART_COLORS.volumeUp : CHART_COLORS.volumeDown };
}
const priceLineVal = (c: Candle, v: number | undefined) => (v != null && Number.isFinite(v) && v > 0 ? { time: toTime(c.time), value: v } : null);
const stochLineVal = (c: Candle, v: number | undefined) => (v != null && Number.isFinite(v) && v >= 0 ? { time: toTime(c.time), value: v } : null);

/**
 * TradingView lightweight-charts is imperative, so the chart is created once and data is pushed
 * in from effects. Appending a few bars uses series.update() (keeps the user's zoom/scroll);
 * anything else is a full setData().
 */
export function CandleChart(props: CandleChartProps) {
  const { mode, colors } = useChartColors();
  // canvas colours and strategy layout are fixed at creation, so a theme switch or strategy change remounts
  return <CandleChartInner key={`${mode}-${props.strategy ?? "trend_regime"}`} colors={colors} {...props} />;
}

function CandleChartInner({
  candles, markers = [], priceLines = [], liveTick, adxThreshold = 20, strategy = "trend_regime", initialBars = 120, className, colors,
}: CandleChartProps & { colors: ChartColors }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Refs | null>(null);
  const byTime = useRef(new Map<number, Candle>());
  const [hover, setHover] = useState<Candle | null>(null);

  const isStoch = strategy === "stoch_sma_66";

  // 1) create once
  useEffect(() => {
    if (!containerRef.current) return;
    const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains").trim() || "monospace";
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: colors.surface },
        textColor: colors.text, fontFamily: mono, fontSize: 11, attributionLogo: false,
        panes: { separatorColor: colors.border },
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { borderColor: colors.border, timeVisible: true, rightOffset: 6, tickMarkFormatter: tickLabel },
      localization: {
        timeFormatter: (t: Time) =>
          localDate(t).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      },
      crosshair: {
        vertLine: { color: colors.accent, style: LineStyle.Dashed, labelBackgroundColor: colors.navy },
        horzLine: { color: colors.accent, style: LineStyle.Dashed, labelBackgroundColor: colors.navy },
      },
    });

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: colors.long, downColor: colors.short, borderVisible: false,
      wickUpColor: colors.long, wickDownColor: colors.short,
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    const quiet = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;

    let emaFast: ISeriesApi<"Line"> | undefined;
    let emaSlow: ISeriesApi<"Line"> | undefined;
    let adx: ISeriesApi<"Line"> | undefined;
    let sma66: ISeriesApi<"Line"> | undefined;
    let stochK: ISeriesApi<"Line"> | undefined;

    if (isStoch) {
      // Stochasticate Momentum 66: 66 SMA on main chart (pane 0)
      sma66 = chart.addSeries(LineSeries, { color: colors.accent, lineWidth: 2, ...quiet });
      // Lower pane (pane 1): Stochastic %K (14, 2)
      stochK = chart.addSeries(LineSeries, { color: colors.long, lineWidth: 2, priceLineVisible: false }, 1);
      // Horizontal reference lines at 60 (Upper level) and 20 (Lower level)
      stochK.createPriceLine({
        price: 60,
        color: colors.short,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        title: "Upper 60",
      });
      stochK.createPriceLine({
        price: 20,
        color: colors.long,
        lineStyle: LineStyle.Dashed,
        lineWidth: 1,
        title: "Lower 20",
      });
      chart.panes()[1]?.setHeight(88);
    } else {
      // Trade Regime Follower: EMA20 & EMA50 on main chart, ADX on pane 1
      emaSlow = chart.addSeries(LineSeries, { color: colors.emaSlow, lineWidth: 2, lineStyle: LineStyle.Dashed, ...quiet });
      emaFast = chart.addSeries(LineSeries, { color: colors.accent, lineWidth: 2, ...quiet });
      adx = chart.addSeries(LineSeries, { color: colors.navy, lineWidth: 2, priceLineVisible: false }, 1);
      adx.createPriceLine({ price: adxThreshold, color: colors.warn, lineStyle: LineStyle.Dashed, lineWidth: 1, title: `trend ≥ ${adxThreshold}` });
      chart.panes()[1]?.setHeight(88);
    }

    chart.subscribeCrosshairMove((param) => {
      setHover(param.time ? byTime.current.get(Number(param.time)) ?? null : null);
    });

    refs.current = {
      chart, candle, volume, emaFast, emaSlow, adx, sma66, stochK,
      markers: createSeriesMarkers(candle, []),
      lines: new Map(), prev: { len: 0, first: 0 }, ranged: false,
    };
    return () => {
      chart.remove();
      refs.current = null;
    };
  }, [adxThreshold, colors, isStoch]);

  // 2) data: append-only updates keep the view; anything else reloads
  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    byTime.current = new Map(candles.map((c) => [c.time, c]));
    if (!candles.length) {
      r.candle.setData([]);
      r.volume.setData([]);
      if (r.emaFast) r.emaFast.setData([]);
      if (r.emaSlow) r.emaSlow.setData([]);
      if (r.adx) r.adx.setData([]);
      if (r.sma66) r.sma66.setData([]);
      if (r.stochK) r.stochK.setData([]);
      r.prev = { len: 0, first: 0 };
      r.ranged = false;
      return;
    }
    const { prev } = r;
    const appendOnly = prev.len > 0 && prev.first === candles[0].time && candles.length >= prev.len && candles.length - prev.len <= 5;
    if (appendOnly) {
      for (let i = prev.len - 1; i < candles.length; i++) {
        const c = candles[i];
        r.candle.update(bar(c));
        r.volume.update(vol(c));
        if (isStoch) {
          const s = priceLineVal(c, c.sma_66);
          const k = stochLineVal(c, c.stoch_k);
          if (s && r.sma66) r.sma66.update(s);
          if (k && r.stochK) r.stochK.update(k);
        } else {
          const f = priceLineVal(c, c.ema_fast);
          const s = priceLineVal(c, c.ema_slow);
          const a = priceLineVal(c, c.adx);
          if (f && r.emaFast) r.emaFast.update(f);
          if (s && r.emaSlow) r.emaSlow.update(s);
          if (a && r.adx) r.adx.update(a);
        }
      }
    } else {
      r.candle.setData(candles.map(bar));
      r.volume.setData(candles.map(vol));
      if (isStoch) {
        if (r.sma66) r.sma66.setData(candles.flatMap((c) => priceLineVal(c, c.sma_66) ?? []));
        if (r.stochK) r.stochK.setData(candles.flatMap((c) => stochLineVal(c, c.stoch_k) ?? []));
      } else {
        if (r.emaFast) r.emaFast.setData(candles.flatMap((c) => priceLineVal(c, c.ema_fast) ?? []));
        if (r.emaSlow) r.emaSlow.setData(candles.flatMap((c) => priceLineVal(c, c.ema_slow) ?? []));
        if (r.adx) r.adx.setData(candles.flatMap((c) => priceLineVal(c, c.adx) ?? []));
      }
    }
    r.prev = { len: candles.length, first: candles[0].time };
    if (!r.ranged) {
      // show `initialBars` wide; when there are fewer bars (replay start) leave room on the right for the rest
      const from = Math.max(0, candles.length - initialBars);
      r.chart.timeScale().setVisibleLogicalRange({ from, to: Math.max(candles.length, from + initialBars) + 4 });
      r.ranged = true;
    }
  }, [candles, initialBars, isStoch]);

  // 3) markers
  useEffect(() => {
    refs.current?.markers.setMarkers(markers);
  }, [markers]);

  // 4) entry / stop lines, updated in place (no flicker)
  useEffect(() => {
    const r = refs.current;
    if (!r) return;
    const wanted = new Set(priceLines.map((l) => l.id));
    for (const [id, pl] of r.lines) {
      if (!wanted.has(id)) {
        r.candle.removePriceLine(pl);
        r.lines.delete(id);
      }
    }
    for (const l of priceLines) {
      const opts = { price: l.price, color: l.color, title: l.title, lineWidth: 1 as const,
        lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: true };
      const existing = r.lines.get(l.id);
      if (existing) existing.applyOptions(opts);
      else r.lines.set(l.id, r.candle.createPriceLine(opts));
    }
  }, [priceLines]);

  // 5) live tick -> forming candle
  useEffect(() => {
    const r = refs.current;
    const last = candles.at(-1);
    if (!r || !last || liveTick == null) return;
    r.candle.update({ ...bar(last), high: Math.max(last.high, liveTick), low: Math.min(last.low, liveTick), close: liveTick });
  }, [liveTick, candles]);

  const shown = hover ?? candles.at(-1);
  const up = shown ? shown.close >= shown.open : true;
  return (
    <div className={cn("relative h-115 w-full overflow-hidden rounded-xl border", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {shown && (
        <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-wrap gap-x-3 gap-y-0.5 rounded-lg bg-card/85 px-2 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur-sm">
          <span>O <b className={up ? "text-long" : "text-short"}>{fmtPrice(shown.open)}</b></span>
          <span>H <b className={up ? "text-long" : "text-short"}>{fmtPrice(shown.high)}</b></span>
          <span>L <b className={up ? "text-long" : "text-short"}>{fmtPrice(shown.low)}</b></span>
          <span>C <b className={up ? "text-long" : "text-short"}>{fmtPrice(liveTick && !hover ? liveTick : shown.close)}</b></span>
          {isStoch ? (
            <>
              {shown.sma_66 ? <span className="text-secondary font-semibold">SMA66 {fmtPrice(shown.sma_66)}</span> : null}
              {shown.stoch_k != null && shown.stoch_k > 0 ? (
                <span className={cn("font-semibold", shown.stoch_k >= 60 ? "text-short" : shown.stoch_k <= 20 ? "text-long" : "text-foreground")}>
                  Stoch %K {shown.stoch_k.toFixed(1)}
                </span>
              ) : null}
            </>
          ) : (
            <>
              {shown.ema_fast ? <span className="text-secondary">EMA20 {fmtPrice(shown.ema_fast)}</span> : null}
              {shown.ema_slow ? <span className="text-ema-slow">EMA50 {fmtPrice(shown.ema_slow)}</span> : null}
              {shown.adx ? <span className="text-primary">ADX {shown.adx.toFixed(1)}</span> : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
