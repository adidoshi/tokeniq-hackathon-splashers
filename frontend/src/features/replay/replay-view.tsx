"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Panel } from "@/components/common/panel";
import { StatTile } from "@/components/common/stat-tile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CandleChart } from "@/features/charts/candle-chart";
import { barTime, toTradeMarkers } from "@/features/desk/lib/chart-data";
import { useReplay } from "@/hooks/use-backtest";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtPct, fmtPrice, fmtUsd, humanize, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReplayResult } from "@/types/api";

const SPEEDS = [
  { id: "1x", label: "1×", barsPerSecond: 2 },
  { id: "5x", label: "5×", barsPerSecond: 10 },
  { id: "20x", label: "20×", barsPerSecond: 40 },
] as const;
const WINDOWS = [3, 7, 14] as const;
const CONTEXT_BARS = 24;

const when = (iso: string) => parseTime(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ReplayView() {
  const [strategy, setStrategy] = useState<string>("trend_regime");
  const [days, setDays] = useState<number>(7);
  const { data, isPending, isError, error } = useReplay(days, "1h", 200, strategy);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground uppercase">
            Session Replay Engine
          </h1>
          <p className="text-xs text-muted-foreground">
            Deterministic step-by-step playback of live engine rules against real Delta Exchange historical bars
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup aria-label="Strategy" variant="outline" size="sm" value={[strategy]} onValueChange={(v) => v[0] && setStrategy(v[0])}>
            <ToggleGroupItem value="trend_regime" className="text-xs rounded data-pressed:bg-primary data-pressed:text-primary-foreground">
              Trade Regime Follower
            </ToggleGroupItem>
            <ToggleGroupItem value="stoch_sma_66" className="text-xs rounded data-pressed:bg-primary data-pressed:text-primary-foreground">
              Strategy Guide
            </ToggleGroupItem>
          </ToggleGroup>

          <ToggleGroup aria-label="Session length" variant="outline" size="sm" value={[String(days)]} onValueChange={(v) => v[0] && setDays(Number(v[0]))}>
            {WINDOWS.map((d) => (
              <ToggleGroupItem key={d} value={String(d)} className="text-xs rounded data-pressed:bg-primary data-pressed:text-primary-foreground">
                {d}D Window
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      {isError ? (
        <Panel title="Replay unavailable"><p className="text-xs text-kill font-mono">{error.message}</p></Panel>
      ) : isPending || !data ? (
        <Skeleton className="h-[520px] rounded" />
      ) : (
        <ReplayPlayer key={`${days}-${strategy}`} data={data} />
      )}
    </div>
  );
}

function ReplayPlayer({ data }: { data: ReplayResult }) {
  const total = data.candles.length;
  const [shown, setShown] = useState(Math.min(CONTEXT_BARS, total));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("5x");
  const done = shown >= total;
  const barsPerSecond = SPEEDS.find((s) => s.id === speed)!.barsPerSecond;

  useEffect(() => {
    if (!playing || done) return;
    const id = setInterval(() => setShown((n) => Math.min(n + 1, total)), 1000 / barsPerSecond);
    return () => clearInterval(id);
  }, [playing, done, barsPerSecond, total]);

  const candles = useMemo(() => data.candles.slice(0, shown), [data.candles, shown]);
  const now = candles.at(-1)?.time ?? 0;
  const markers = useMemo(
    () => toTradeMarkers(data.trades, data.resolution, data.candles[0]?.time ?? 0, now),
    [data, now],
  );

  const curve = useMemo(
    () => data.equity_curve.map((p) => ({ t: parseTime(p.time).getTime() / 1000, v: p.equity })),
    [data.equity_curve],
  );
  const pastCurve = curve.filter((p) => p.t <= now);
  const startEquity = data.summary.start_equity;
  const equity = pastCurve.at(-1)?.v ?? startEquity;
  const pnl = equity - startEquity;

  const entered = data.trades.filter((t) => barTime(t.entry_time, data.resolution) <= now);
  const closed = entered.filter((t) => t.exit_time && barTime(t.exit_time, data.resolution) <= now);
  const open = entered.find((t) => !t.exit_time || barTime(t.exit_time, data.resolution) > now);
  const wins = closed.filter((t) => t.pnl > 0).length;

  const feed = [
    ...entered.map((t) => ({ at: t.entry_time, kind: "enter" as const, t })),
    ...closed.map((t) => ({ at: t.exit_time, kind: "exit" as const, t })),
  ].sort((a, b) => parseTime(b.at).getTime() - parseTime(a.at).getTime()).slice(0, 8);

  const restart = () => {
    setShown(Math.min(CONTEXT_BARS, total));
    setPlaying(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={`${data.symbol} · ${data.resolution} · ${data.strategy_display_name}`}
        aside={candles.length ? `${when(new Date(now * 1000).toISOString())} · Bar ${shown}/${total}` : null}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-2.5">
          {done ? (
            <Button size="sm" onClick={restart} className="h-8 gap-1 rounded text-xs font-semibold">
              <RotateCcw className="size-3.5" /> Replay Again
            </Button>
          ) : (
            <Button size="sm" onClick={() => setPlaying((p) => !p)} className="h-8 gap-1 rounded text-xs font-semibold">
              {playing ? <><Pause className="size-3.5" /> Pause</> : <><Play className="size-3.5 fill-current" /> {shown > CONTEXT_BARS ? "Resume" : "Play Session"}</>}
            </Button>
          )}
          <ToggleGroup aria-label="Playback speed" variant="outline" size="sm" value={[speed]} onValueChange={(v) => v[0] && setSpeed(v[0] as typeof speed)}>
            {SPEEDS.map((s) => (
              <ToggleGroupItem key={s.id} value={s.id} className="font-mono text-xs rounded data-pressed:bg-primary data-pressed:text-primary-foreground">
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="relative ml-auto h-1.5 min-w-40 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={shown} aria-label="Session progress">
            <div className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all" style={{ width: `${(shown / total) * 100}%` }} />
          </div>
        </div>
        <CandleChart
          candles={candles}
          markers={markers}
          initialBars={total}
          adxThreshold={Number(data.params.adx_threshold ?? 20)}
          strategy={data.strategy}
        />
      </Panel>

      {done && <SessionSummary data={data} />}

      <div className="flex flex-wrap items-start gap-4">
        <section aria-label="Running totals" className="grid min-w-0 flex-[999_1_560px] grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
          <StatTile
            label="Session P&L"
            value={<span className={cn("font-bold", pnl > 0 && "text-long", pnl < 0 && "text-short")}>{fmtUsd(pnl, { signed: true })}</span>}
            sub={`Equity ${fmtUsd(equity)} from ${fmtUsd(startEquity)}`}
          />
          <StatTile
            label="Trades Closed"
            value={closed.length}
            sub={closed.length ? `${wins} Won · ${closed.length - wins} Lost` : "No fills yet"}
          />
          <StatTile
            label="Open Position"
            value={open ? <span className={cn("font-mono font-bold", SIDE_TEXT_CLASS[open.side])}>{open.side.toUpperCase()} {open.size}</span> : "FLAT"}
            sub={open ? `Fill ${fmtPrice(open.entry)}` : "Awaiting signal setup"}
          />
          <EquitySpark curve={pastCurve} start={startEquity} />
        </section>
        <Panel title="Session Blotter Feed" className="flex-[1_1_320px]">
          {feed.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Standing aside in chop. Algorithmic trade signals fire on candle close.</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border/30">
              {feed.map((f, i) => (
                <li key={`${f.at}-${f.kind}-${i}`} className="grid grid-cols-[82px_1fr] gap-2 py-1.5 text-xs">
                  <span className="font-mono text-[10px] text-muted-foreground pt-0.5">{when(f.at)}</span>
                  {f.kind === "enter" ? (
                    <span className="leading-snug">
                      <strong className={SIDE_TEXT_CLASS[f.t.side]}>ENTER {f.t.side.toUpperCase()}</strong> {f.t.size} @ {fmtPrice(f.t.entry)}
                    </span>
                  ) : (
                    <span className="leading-snug">
                      EXIT @ {fmtPrice(f.t.exit)} · <span className="text-muted-foreground">{humanize(f.t.exit_reason)}</span>{" "}
                      <strong className={f.t.pnl >= 0 ? "text-long" : "text-short"}>{fmtUsd(f.t.pnl, { signed: true })}</strong>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function EquitySpark({ curve, start }: { curve: { t: number; v: number }[]; start: number }) {
  const w = 200, h = 40;
  const values = curve.map((p) => p.v);
  const lo = Math.min(start, ...values), hi = Math.max(start, ...values);
  const y = (v: number) => (hi === lo ? h / 2 : h - ((v - lo) / (hi - lo)) * (h - 4) - 2);
  const pts = curve.map((p, i) => `${(i / Math.max(1, curve.length - 1)) * w},${y(p.v)}`).join(" ");
  const up = (values.at(-1) ?? start) >= start;
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1.5 rounded-lg border border-border bg-card p-3 sm:p-3.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Equity Trajectory</span>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" role="img" aria-label="Session equity so far" preserveAspectRatio="none">
        <line x1="0" x2={w} y1={y(start)} y2={y(start)} stroke="var(--border)" strokeDasharray="3 3" />
        {curve.length > 1 && <polyline points={pts} fill="none" stroke={up ? "var(--long)" : "var(--short)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className="text-[10px] text-muted-foreground">Dashed line = initial equity baseline</span>
    </div>
  );
}

function SessionSummary({ data }: { data: ReplayResult }) {
  const s = data.summary;
  return (
    <Panel title={`Session Summary · Last ${data.days} Days`} aside="Pessimistic intra-candle stops and taker fees deducted" className="border-primary/40 bg-primary/5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
        <StatTile label="Session Return" value={fmtPct(s.return_pct, { signed: true })} valueClassName={cn("font-bold", s.return_pct > 0 ? "text-long" : "text-short")} sub={`Buy & hold ${fmtPct(s.buy_hold_pct, { signed: true })}`} />
        <StatTile label="Net P&L" value={fmtUsd(s.pnl, { signed: true })} valueClassName={cn("font-bold", s.pnl >= 0 ? "text-long" : "text-short")} sub={`${fmtUsd(s.start_equity)} → ${fmtUsd(s.end_equity)}`} />
        <StatTile label="Total Trades" value={s.trades} sub={`Win Rate ${fmtPct(s.win_rate_pct, { digits: 0 })}`} />
        <StatTile label="Max Drawdown" value={fmtPct(s.max_drawdown_pct)} valueClassName="text-short font-bold" sub="Peak to trough" />
        <StatTile label="Best / Worst" value={<span className="text-sm font-bold">{fmtUsd(s.best_trade, { signed: true })} / {fmtUsd(s.worst_trade, { signed: true })}</span>} sub="Per trade extremes" />
      </div>
    </Panel>
  );
}
