"use client";

import { AnimatedNumber } from "@/components/common/animated-number";
import { StatTile } from "@/components/common/stat-tile";
import { useStatus, useWeeklyAnalytics } from "@/hooks/use-bot";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtPct, fmtPrice, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The four primary terminal KPI tiles: Equity, Daily P&L Budget, Open Position, and Trade Limits. */
export function KpiStrip() {
  const { data: s, isPending } = useStatus();
  const { data: week } = useWeeklyAnalytics();

  const dayPnl = s && s.day_start_equity > 0 ? s.equity - s.day_start_equity : 0;
  const limit = s?.risk.daily_loss_limit_pct ?? 3;
  const used = s ? Math.min(1, Math.max(0, -s.daily_pnl_pct) / limit) : 0;
  const weekPnl = week?.reduce((sum, d) => sum + d.pnl, 0) ?? 0;
  const weekTrades = week?.reduce((sum, d) => sum + d.trades, 0) ?? 0;

  return (
    <section aria-label="Account summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2.5">
      <StatTile
        label="Account Equity"
        loading={isPending}
        value={s && <AnimatedNumber value={s.equity} format={(n) => fmtUsd(n)} />}
        sub={
          s && (
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span>Wallet {fmtUsd(s.balance)}</span>
              <span className="opacity-40">·</span>
              <span>Open P&L:</span>
              <strong className={cn(s.equity - s.balance > 0 && "text-long", s.equity - s.balance < 0 && "text-short")}>
                <AnimatedNumber value={s.equity - s.balance} format={(n) => fmtUsd(n, { signed: true })} />
              </strong>
            </div>
          )
        }
      />
      <StatTile
        label="Today P&L (UTC)"
        loading={isPending}
        value={
          s && (
            <span className={cn(dayPnl > 0 && "text-long", dayPnl < 0 && "text-short")}>
              <AnimatedNumber value={dayPnl} format={(n) => fmtUsd(n, { signed: true })} />
            </span>
          )
        }
        sub={
          s && (
            <div className="flex flex-col gap-1 mt-0.5">
              <div role="progressbar" aria-label={`Daily loss budget used`} className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full transition-all", used > 0.66 ? "bg-kill" : "bg-primary")}
                  style={{ width: `${Math.max(used * 100, 2)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {fmtPct(s.daily_pnl_pct, { signed: true })} of −{limit.toFixed(1)}% daily limit
              </span>
            </div>
          )
        }
      />
      <StatTile
        label="Active Position"
        loading={isPending}
        tone={s && s.position.side !== "flat" ? "accent" : "default"}
        value={
          s && (
            <span className={cn("font-mono font-bold tracking-tight text-lg sm:text-xl", SIDE_TEXT_CLASS[s.position.side])}>
              {s.position.side === "flat" ? "FLAT" : `${s.position.side.toUpperCase()} ${s.position.size} CTR`}
            </span>
          )
        }
        sub={
          s && (
            <span className="truncate">
              {s.position.side === "flat"
                ? "Waiting for entry gate trigger"
                : `Entry ${fmtPrice(s.position.entry_price)} · Stop ${s.position.stop ? fmtPrice(s.position.stop) : "Exchange Bracket"}`}
            </span>
          )
        }
      />
      <StatTile
        label="Execution Activity"
        loading={isPending}
        value={
          s && (
            <div className="flex items-baseline gap-1 font-mono">
              <span>{s.risk.trades_today}</span>
              <span className="text-xs font-normal text-muted-foreground">/ {s.risk.max_trades_per_day} max today</span>
            </div>
          )
        }
        sub={
          <span className="text-[11px] text-muted-foreground">
            7d closed: <strong className="text-foreground">{weekTrades}</strong> · Net:{" "}
            <strong className={cn(weekPnl >= 0 ? "text-long" : "text-short")}>{fmtUsd(weekPnl, { signed: true })}</strong>
          </span>
        }
      />
    </section>
  );
}
