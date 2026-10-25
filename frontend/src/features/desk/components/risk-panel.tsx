"use client";

import { Panel } from "@/components/common/panel";
import { Pill } from "@/components/common/pill";
import { useStatus } from "@/hooks/use-bot";
import { fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const FAIL_SAFES = ["Stop held on Delta", "Clock sync", "WS auto-reconnect", "Stale-data guard", "Circuit breaker", "Restart recovery"];

/** The five risk layers (backend/app/risk.py), each with its live value. */
export function RiskPanel() {
  const { data: s } = useStatus();
  if (!s) return null;
  const { risk } = s;
  const state = risk.killed ? { label: "Kill switch active", cls: "text-kill" }
    : risk.halted_reason ? { label: "Halted", cls: "text-warn" }
      : { label: "All clear", cls: "text-long" };

  const rows: [string, string][] = [
    ["Risk per trade", `${risk.risk_per_trade_pct}% = ${fmtUsd((s.equity * risk.risk_per_trade_pct) / 100)}`],
    ["Leverage cap", `${risk.max_leverage}×`],
    ["Trades today", `${risk.trades_today} / ${risk.max_trades_per_day}`],
    ["Daily loss", `${fmtPct(s.daily_pnl_pct, { signed: true })} of −${risk.daily_loss_limit_pct.toFixed(1)}%`],
    ["Errors in a row", `${s.errors} / 5 → circuit breaker`],
    ["Clock vs Delta", `${s.clock_offset >= 0 ? "+" : ""}${s.clock_offset.toFixed(2)} s`],
  ];

  return (
    <Panel title="Risk guard" aside={<span className={cn("font-semibold tracking-wide uppercase", state.cls)}>{state.label}</span>}>
      {risk.halted_reason && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-warn">{risk.halted_reason}</p>}
      <dl className="flex flex-col gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-xs">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular font-mono">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        {FAIL_SAFES.map((f) => <Pill key={f}>{f}</Pill>)}
      </div>
      {s.last_error && <p className="text-xs break-words text-kill">Last error: {s.last_error}</p>}
    </Panel>
  );
}
