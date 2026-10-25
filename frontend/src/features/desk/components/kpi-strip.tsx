"use client";

import { AnimatedNumber } from "@/components/common/animated-number";
import { StatTile } from "@/components/common/stat-tile";
import { useStatus, useWeeklyAnalytics } from "@/hooks/use-bot";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtPct, fmtPrice, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** The four numbers a judge reads first: money, today's risk budget, exposure, activity. */
export function KpiStrip() {
  const { data: s, isPending } = useStatus();
  const { data: week } = useWeeklyAnalytics();

  const dayPnl = s && s.day_start_equity > 0 ? s.equity - s.day_start_equity : 0;
  const limit = s?.risk.daily_loss_limit_pct ?? 3; // already a percent (3.0 = 3%)
  const used = s ? Math.min(1, Math.max(0, -s.daily_pnl_pct) / limit) : 0;
  const weekPnl = week?.reduce((sum, d) => sum + d.pnl, 0) ?? 0;
  const weekTrades = week?.reduce((sum, d) => sum + d.trades, 0) ?? 0;

  return (
    <section aria-label="Account summary" className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
      <StatTile
        label="Equity"
        loading={isPending}
        value={s && <AnimatedNumber value={s.equity} format={(n) => fmtUsd(n)} />}
        sub={s && (
          <>
            Wallet {fmtUsd(s.balance)} · open P&L{" "}
            <b className={cn("font-mono", s.equity - s.balance > 0 && "text-long", s.equity - s.balance < 0 && "text-short")}>
              <AnimatedNumber value={s.equity - s.balance} format={(n) => fmtUsd(n, { signed: true })} />
            </b>
          </>
        )}
      />
      <StatTile
        label="Today (UTC)"
        loading={isPending}
        value={s && <span className={cn(dayPnl > 0 && "text-long", dayPnl < 0 && "text-short")}><AnimatedNumber value={dayPnl} format={(n) => fmtUsd(n, { signed: true })} /></span>}
        sub={
          s && (
            <span className="flex flex-col gap-1.5">
              <span role="img" aria-label={`Daily loss ${fmtPct(s.daily_pnl_pct)} of the ${limit}% limit`} className="relative h-1.5 rounded-full bg-muted">
                <span className={cn("absolute inset-y-0 left-0 rounded-full", used > 0.66 ? "bg-kill" : "bg-warn")} style={{ width: `${used * 100}%` }} />
              </span>
              {fmtPct(s.daily_pnl_pct, { signed: true })} of the −{limit.toFixed(1)}% daily loss limit
            </span>
          )
        }
      />
      <StatTile
        label="Position"
        loading={isPending}
        tone={s && s.position.side !== "flat" ? "accent" : "default"}
        className={s && s.position.side !== "flat" ? "glow-pulse" : undefined}
        value={
          s && (
            <span className={cn("font-heading font-semibold", SIDE_TEXT_CLASS[s.position.side])}>
              {s.position.side === "flat" ? "FLAT" : `${s.position.side.toUpperCase()} ${s.position.size}`}
            </span>
          )
        }
        sub={
          s && (s.position.side === "flat"
            ? "Waiting for a signal that passes the entry gate"
            : `Entry ${fmtPrice(s.position.entry_price)}${s.position.stop ? ` · stop ${fmtPrice(s.position.stop)}` : " · stop on Delta"}`)
        }
      />
      <StatTile
        label="Trades today"
        loading={isPending}
        value={s && <>{s.risk.trades_today} <span className="text-base text-muted-foreground">/ {s.risk.max_trades_per_day}</span></>}
        sub={`Last 7 days: ${weekTrades} closed · ${fmtUsd(weekPnl, { signed: true })}`}
      />
    </section>
  );
}
