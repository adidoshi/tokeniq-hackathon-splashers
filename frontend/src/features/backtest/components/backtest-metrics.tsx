import { StatTile } from "@/components/common/stat-tile";
import { fmtPct, fmtR } from "@/lib/format";
import type { BacktestMetrics as Metrics } from "@/types/api";

export function BacktestMetrics({ metrics: m, loading }: { metrics?: Metrics; loading?: boolean }) {
  return (
    <section aria-label="Results" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
      <StatTile tone="accent" label="Return" loading={loading} value={m && fmtPct(m.return_pct, { signed: true })} sub={m && `Buy & hold ${fmtPct(m.buy_hold_pct, { signed: true })}`} />
      <StatTile label="Profit factor" loading={loading} value={m && (m.profit_factor ?? "-")} sub="Gross win ÷ gross loss" />
      <StatTile label="Win rate" loading={loading} value={m && fmtPct(m.win_rate_pct, { digits: 1 })} sub={m && `${m.trades} trades`} />
      <StatTile label="Avg trade" loading={loading} value={m && fmtR(m.avg_r)} sub="R = amount risked" />
      <StatTile label="Max drawdown" loading={loading} value={m && fmtPct(m.max_drawdown_pct)} valueClassName="text-short" sub="Peak to trough" />
      <StatTile label="Sharpe" loading={loading} value={m && m.sharpe.toFixed(2)} sub="Annualised" />
    </section>
  );
}
