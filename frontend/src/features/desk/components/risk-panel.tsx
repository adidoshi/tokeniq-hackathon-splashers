"use client";

import { Panel } from "@/components/common/panel";
import { Pill } from "@/components/common/pill";
import { useStatus } from "@/hooks/use-bot";
import { fmtPct, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

const FAIL_SAFES = [
  "Delta Bracket Stop",
  "Clock Sync",
  "WS Heartbeat Guard",
  "Stale Candle Gate",
  "Circuit Breaker",
  "Crash Recovery",
];

/** Institutional 5-layer Risk Management engine monitor. */
export function RiskPanel() {
  const { data: s } = useStatus();
  if (!s) return null;
  const { risk } = s;

  const state = risk.killed
    ? { label: "KILL ACTIVE", cls: "bg-kill/15 text-kill border-kill/40" }
    : risk.halted_reason
      ? { label: "HALTED", cls: "bg-warn/15 text-warn border-warn/40" }
      : { label: "ALL GUARDS NOMINAL", cls: "bg-long/10 text-long border-long/30" };

  const rows: [string, string][] = [
    ["Risk Per Trade", `${risk.risk_per_trade_pct}% (${fmtUsd((s.equity * risk.risk_per_trade_pct) / 100)})`],
    ["Leverage Cap", `${risk.max_leverage}× Notional`],
    ["Trades Today", `${risk.trades_today} / ${risk.max_trades_per_day} Max`],
    ["Daily Loss", `${fmtPct(s.daily_pnl_pct, { signed: true })} (Limit −${risk.daily_loss_limit_pct.toFixed(1)}%)`],
    ["Consecutive Errors", `${s.errors} / 5 (Circuit Breaker)`],
    ["Delta Clock Skew", `${s.clock_offset >= 0 ? "+" : ""}${s.clock_offset.toFixed(2)}s`],
  ];

  return (
    <Panel
      title="Risk Guard"
      aside={
        <span className={cn("font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider", state.cls)}>
          {state.label}
        </span>
      }
    >
      {risk.halted_reason && (
        <div className="rounded border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-xs text-warn">
          {risk.halted_reason}
        </div>
      )}

      <dl className="flex flex-col divide-y divide-border/30">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-1.5 text-xs first:pt-0 last:pb-0">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular font-mono font-medium text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-1.5 border-t border-border/40 pt-2.5">
        {FAIL_SAFES.map((f) => (
          <Pill key={f} mono>
            {f}
          </Pill>
        ))}
      </div>

      {s.last_error && (
        <p className="rounded border border-kill/30 bg-kill/10 p-2 text-xs font-mono text-kill break-words">
          Error: {s.last_error}
        </p>
      )}
    </Panel>
  );
}
