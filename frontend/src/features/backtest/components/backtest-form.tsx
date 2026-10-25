"use client";

import { useState, type FormEvent } from "react";

import { Panel } from "@/components/common/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useStrategies } from "@/hooks/use-bot";
import type { BacktestRequest } from "@/types/api";

export interface BacktestFormValues {
  strategy: string;
  resolution: string;
  days: number;
  equity: number;
  commissionPct: number;
  // trend_regime
  trailAtr: number;
  adxThreshold: number;
  entryMode: "fresh" | "state";
  // stoch_sma_66
  smaPeriod: number;
  kPeriod: number;
  smoothK: number;
  dPeriod: number;
  levelHigh: number;
  levelLow: number;
  stopbars: number;
  rrRatio: number;
  exitOnTrendFlip: boolean;
}

export const DEFAULT_BACKTEST: BacktestFormValues = {
  strategy: "trend_regime",
  resolution: "1h",
  days: 365,
  equity: 10000,
  commissionPct: 0.053,
  trailAtr: 3,
  adxThreshold: 20,
  entryMode: "fresh",
  smaPeriod: 66,
  kPeriod: 14,
  smoothK: 2,
  dPeriod: 3,
  levelHigh: 60,
  levelLow: 20,
  stopbars: 4,
  rrRatio: 2.0,
  exitOnTrendFlip: false,
};

export function toRequest(v: BacktestFormValues): BacktestRequest {
  let params: BacktestRequest["params"] = {};
  if (v.strategy === "trend_regime") {
    params = {
      trail_atr: Number(v.trailAtr) || 3,
      adx_threshold: Number(v.adxThreshold) || 20,
      entry_mode: v.entryMode,
    };
  } else if (v.strategy === "stoch_sma_66") {
    params = {
      sma_period: Number(v.smaPeriod) || 66,
      k_period: Number(v.kPeriod) || 14,
      smooth_k: Number(v.smoothK) || 2,
      d_period: Number(v.dPeriod) || 3,
      level_high: Number(v.levelHigh) || 60,
      level_low: Number(v.levelLow) || 20,
      stopbars: Number(v.stopbars) || 4,
      rr_ratio: Number(v.rrRatio) || 2.0,
      exit_on_trend_flip: Boolean(v.exitOnTrendFlip),
    };
  }
  return {
    strategy: v.strategy,
    days: Number(v.days) || 30,
    resolution: v.resolution,
    equity: Number(v.equity) || 10000,
    commission_pct: Number(v.commissionPct) ?? 0.053,
    params,
  };
}

const TIMEFRAMES = ["5m", "15m", "1h", "2h", "3h", "4h", "1d"];

const COMMISSION_PRESETS = [
  { label: "0.053% (Delta)", value: 0.053 },
  { label: "0.050% (Std)", value: 0.050 },
  { label: "0.020% (Maker)", value: 0.020 },
  { label: "0.000% (Zero Fee)", value: 0.0 },
];

interface Props {
  onRun: (values: BacktestFormValues) => void;
  running: boolean;
}

export function BacktestForm({ onRun, running }: Props) {
  const [values, setValues] = useState<BacktestFormValues>(DEFAULT_BACKTEST);
  const { data: strategies } = useStrategies();
  const set = <K extends keyof BacktestFormValues>(key: K, value: BacktestFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onRun(values);
  };

  const isStoch = values.strategy === "stoch_sma_66";
  const isTrend = values.strategy === "trend_regime";

  return (
    <form onSubmit={submit} aria-label="Backtest parameters" className="flex-[1_1_320px]">
      <Panel title="Parameters">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground" id="bt-strategy-label">Strategy</span>
          <ToggleGroup
            aria-labelledby="bt-strategy-label"
            variant="outline"
            orientation="vertical"
            value={[values.strategy]}
            onValueChange={(v) => v[0] && set("strategy", v[0])}
            className="w-full"
          >
            {(strategies ?? []).map((st) => (
              <ToggleGroupItem key={st.id} value={st.id} className="justify-between text-xs data-pressed:bg-primary data-pressed:text-primary-foreground">
                {st.display_name}
                <span className="text-[10px] opacity-80">{st.live_enabled ? "live" : "evidence"}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground" id="bt-tf-label">Timeframe</span>
          <ToggleGroup
            aria-labelledby="bt-tf-label"
            variant="outline"
            value={[values.resolution]}
            onValueChange={(v) => v[0] && set("resolution", v[0])}
          >
            {TIMEFRAMES.map((tf) => (
              <ToggleGroupItem key={tf} value={tf} className="font-mono text-xs data-pressed:bg-foreground data-pressed:text-background">
                {tf}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bt-days" className="text-xs font-normal text-muted-foreground">History (days)</Label>
            <Input
              id="bt-days"
              type="number"
              step={1}
              min={1}
              max={730}
              value={values.days}
              onChange={(e) => set("days", Number(e.target.value))}
              className="h-10 font-mono text-xs"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bt-equity" className="text-xs font-normal text-muted-foreground">Starting equity ($)</Label>
            <Input
              id="bt-equity"
              type="number"
              step={10}
              min={10}
              max={100000}
              value={values.equity}
              onChange={(e) => set("equity", Number(e.target.value))}
              className="h-10 font-mono text-xs"
            />
          </div>
        </div>

        {/* Commission Fee Section */}
        <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-surface/50 p-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="bt-commission" className="text-xs font-normal text-muted-foreground">
              Taker Fee (% per side)
            </Label>
            <span className="font-mono text-xs font-semibold text-primary">
              {values.commissionPct.toFixed(3)}%
            </span>
          </div>
          <Input
            id="bt-commission"
            type="number"
            step={0.001}
            min={0}
            max={2}
            value={values.commissionPct}
            onChange={(e) => set("commissionPct", Number(e.target.value))}
            className="h-9 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-1.5">
            {COMMISSION_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={values.commissionPct === preset.value ? "secondary" : "outline"}
                size="sm"
                className="h-6 px-2 text-[10px] font-mono"
                onClick={() => set("commissionPct", preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Strategy-Specific Parameters */}
        {isTrend && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bt-trail" className="text-xs font-normal text-muted-foreground">Trailing stop (× ATR)</Label>
                <Input
                  id="bt-trail"
                  type="number"
                  step={0.5}
                  min={0.5}
                  max={10}
                  value={values.trailAtr}
                  onChange={(e) => set("trailAtr", Number(e.target.value))}
                  className="h-10 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bt-adx" className="text-xs font-normal text-muted-foreground">ADX threshold</Label>
                <Input
                  id="bt-adx"
                  type="number"
                  step={1}
                  min={0}
                  max={60}
                  value={values.adxThreshold}
                  onChange={(e) => set("adxThreshold", Number(e.target.value))}
                  className="h-10 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground" id="bt-mode-label">Entry mode</span>
              <ToggleGroup
                aria-labelledby="bt-mode-label"
                variant="outline"
                value={[values.entryMode]}
                onValueChange={(v) => v[0] && set("entryMode", v[0] as BacktestFormValues["entryMode"])}
              >
                <ToggleGroupItem value="fresh" className="data-pressed:bg-foreground data-pressed:text-background">Fresh only</ToggleGroupItem>
                <ToggleGroupItem value="state" className="data-pressed:bg-foreground data-pressed:text-background">Any trend bar</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </>
        )}

        {isStoch && (
          <div className="flex flex-col gap-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">Stochasticate Parameters</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      smaPeriod: 66,
                      rrRatio: 2.0,
                      kPeriod: 14,
                      smoothK: 2,
                      dPeriod: 3,
                      levelHigh: 60,
                      levelLow: 20,
                      stopbars: 4,
                    }))
                  }
                >
                  66 SMA
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() =>
                    setValues((v) => ({
                      ...v,
                      smaPeriod: 100,
                      rrRatio: 2.0,
                      kPeriod: 14,
                      smoothK: 2,
                      dPeriod: 3,
                      levelHigh: 60,
                      levelLow: 20,
                      stopbars: 4,
                    }))
                  }
                >
                  100 SMA
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="bt-sma" className="text-[11px] text-muted-foreground">Moving Average Period</Label>
                <Input
                  id="bt-sma"
                  type="number"
                  step={1}
                  min={10}
                  max={300}
                  value={values.smaPeriod}
                  onChange={(e) => set("smaPeriod", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bt-rr" className="text-[11px] text-muted-foreground">Risk:Reward Ratio</Label>
                <Input
                  id="bt-rr"
                  type="number"
                  step={0.5}
                  min={1}
                  max={5}
                  value={values.rrRatio}
                  onChange={(e) => set("rrRatio", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bt-k-len" className="text-[11px] text-muted-foreground">%K Lookback</Label>
                <Input
                  id="bt-k-len"
                  type="number"
                  step={1}
                  min={5}
                  max={50}
                  value={values.kPeriod}
                  onChange={(e) => set("kPeriod", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bt-k-smooth" className="text-[11px] text-muted-foreground">%K Smoothing</Label>
                <Input
                  id="bt-k-smooth"
                  type="number"
                  step={1}
                  min={1}
                  max={10}
                  value={values.smoothK}
                  onChange={(e) => set("smoothK", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bt-lvl-high" className="text-[11px] text-muted-foreground">Upper Level (Short)</Label>
                <Input
                  id="bt-lvl-high"
                  type="number"
                  step={1}
                  min={50}
                  max={90}
                  value={values.levelHigh}
                  onChange={(e) => set("levelHigh", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="bt-lvl-low" className="text-[11px] text-muted-foreground">Lower Level (Long)</Label>
                <Input
                  id="bt-lvl-low"
                  type="number"
                  step={1}
                  min={10}
                  max={50}
                  value={values.levelLow}
                  onChange={(e) => set("levelLow", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <Label htmlFor="bt-stopbars" className="text-[11px] text-muted-foreground">SL Lookback Bars (Swing Extreme)</Label>
                <Input
                  id="bt-stopbars"
                  type="number"
                  step={1}
                  min={1}
                  max={20}
                  value={values.stopbars}
                  onChange={(e) => set("stopbars", Number(e.target.value))}
                  className="h-9 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        )}

        <Button type="submit" size="lg" disabled={running} className="h-11 font-heading font-bold tracking-widest uppercase">
          {running ? "Running…" : "Run backtest"}
        </Button>

        <div className="flex flex-col gap-2 border-t pt-3.5">
          <span className="eyebrow text-warn">Fee &amp; Execution Note</span>
          <p className="text-[13px] leading-relaxed text-body-soft">
            {isStoch ? (
              `Stochasticate Momentum 66 uses ${values.stopbars}-bar swing extreme stop loss and 1:${values.rrRatio} bracket target. Fills at next candle open, with ${values.commissionPct.toFixed(3)}% taker fee accounted per side.`
            ) : (
              `On 5m candles the stop sits about $150 away, so the round-trip fee ate half the risk on every trade. Applied commission: ${values.commissionPct.toFixed(3)}% per side.`
            )}
          </p>
        </div>
      </Panel>
    </form>
  );
}