import { StatTile } from "@/components/common/stat-tile";
import { fmtPct, fmtR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BacktestMetrics as Metrics } from "@/types/api";

export function BacktestMetrics({ metrics: m, loading }: { metrics?: Metrics; loading?: boolean }) {
  const returnColor = m ? (m.return_pct > 0 ? "text-long" : m.return_pct < 0 ? "text-short" : "text-foreground") : "";
  const pfColor = m && m.profit_factor != null ? (m.profit_factor >= 1.2 ? "text-long" : m.profit_factor >= 1.0 ? "text-foreground" : "text-short") : "";

  return (
    <section aria-label="Results" className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2.5">
      <StatTile
        label="Net Return"
        loading={loading}
        value={m && <span className={cn("font-bold", returnColor)}>{fmtPct(m.return_pct, { signed: true })}</span>}
        sub={m && `Benchmark ${fmtPct(m.buy_hold_pct, { signed: true })}`}
      />
      <StatTile
        label="Profit Factor"
        loading={loading}
        value={m && <span className={cn("font-bold", pfColor)}>{m.profit_factor ?? "—"}</span>}
        sub="Gross Win ÷ Gross Loss"
      />
      <StatTile
        label="Win Rate"
        loading={loading}
        value={m && fmtPct(m.win_rate_pct, { digits: 1 })}
        sub={m && `${m.trades} closed fills`}
      />
      <StatTile
        label="Avg Trade"
        loading={loading}
        value={m && fmtR(m.avg_r)}
        sub="R = Capital at risk"
      />
      <StatTile
        label="Max Drawdown"
        loading={loading}
        value={m && fmtPct(m.max_drawdown_pct)}
        valueClassName="text-short font-bold"
        sub="Peak to trough drop"
      />
      <StatTile
        label="Sharpe Ratio"
        loading={loading}
        value={m && m.sharpe.toFixed(2)}
        sub="Annualised risk-adj."
      />
    </section>
  );
}
