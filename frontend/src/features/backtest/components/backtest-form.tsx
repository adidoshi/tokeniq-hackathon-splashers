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
  trailAtr: number;
  adxThreshold: number;
  entryMode: "fresh" | "state";
}

export const DEFAULT_BACKTEST: BacktestFormValues = {
  strategy: "trend_regime", resolution: "1h", days: 365, equity: 10000, trailAtr: 3, adxThreshold: 20, entryMode: "fresh",
};

export function toRequest(v: BacktestFormValues): BacktestRequest {
  // the tunable fields belong to trend_regime; other strategies run on their own defaults
  const params: BacktestRequest["params"] = v.strategy === "trend_regime"
    ? { trail_atr: v.trailAtr, adx_threshold: v.adxThreshold, entry_mode: v.entryMode }
    : {};
  return { strategy: v.strategy, days: v.days, resolution: v.resolution, equity: v.equity, params };
}

const TIMEFRAMES = ["5m", "15m", "1h", "4h"];
const NUMBER_FIELDS = [
  { id: "bt-days", key: "days", label: "History (days)", step: 1, min: 7, max: 730 },
  { id: "bt-equity", key: "equity", label: "Starting equity ($)", step: 10, min: 10, max: 100000 },
  { id: "bt-trail", key: "trailAtr", label: "Trailing stop (× ATR)", step: 0.5, min: 0.5, max: 10 },
  { id: "bt-adx", key: "adxThreshold", label: "ADX threshold", step: 1, min: 0, max: 60 },
] as const;

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

  return (
    <form onSubmit={submit} aria-label="Backtest parameters" className="flex-[1_1_300px]">
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
          {NUMBER_FIELDS.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5">
              <Label htmlFor={f.id} className="text-xs font-normal text-muted-foreground">{f.label}</Label>
              <Input
                id={f.id}
                type="number"
                step={f.step}
                min={f.min}
                max={f.max}
                value={values[f.key]}
                onChange={(e) => set(f.key, Number(e.target.value))}
                className="h-11 font-mono text-xs"
              />
            </div>
          ))}
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

        <Button type="submit" size="lg" disabled={running} className="h-11 font-heading font-bold tracking-widest uppercase">
          {running ? "Running…" : "Run backtest"}
        </Button>

        <div className="flex flex-col gap-2 border-t pt-3.5">
          <span className="eyebrow text-warn">Why 1h, not 5m</span>
          <p className="text-[13px] leading-relaxed text-body-soft">
            On 5m candles the stop sits about $150 away, so the round-trip fee ate half the risk on every trade. On 1h
            the stop is wider and fees drop to a small fraction of it.
          </p>
        </div>
      </Panel>
    </form>
  );
}
