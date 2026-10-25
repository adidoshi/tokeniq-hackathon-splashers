"use client";

import { Panel } from "@/components/common/panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStrategyComparison } from "@/hooks/use-backtest";
import { fmtPct, fmtR, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CompareRequest } from "@/types/api";

const signed = (n: number) => cn("text-right font-semibold", n > 0 ? "text-long" : n < 0 ? "text-short" : "");
/** The settings a row actually ran with (the class summary only describes the defaults). */
function describeParams(id: string, p: Record<string, number | string | boolean>): string | null {
  if (id === "trend_regime") return `EMA ${p.fast}/${p.slow} · ADX ≥ ${p.adx_threshold} · ${p.trail_atr}× ATR trailing stop · ${p.entry_mode} entries`;
  if (id === "stoch_sma_66") return `SMA ${p.sma_period} · Stoch %K ${p.k_period} crossing ${p.level_low}/${p.level_high} · ${p.stopbars}-bar stop · 1:${p.rr_ratio} target`;
  return null;
}

const day = (iso: string) => parseTime(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The honest-evidence table for the last backtest run: the live strategies on the same candles, first 70%
 * vs the last 30% they were never tuned on, next to buy & hold for the same window.
 */
export function StrategyComparison({ req }: { req: CompareRequest }) {
  const { data, isPending, isError, error } = useStrategyComparison(req);
  const [from] = data?.period.split(" -> ") ?? [];

  return (
    <Panel
      title="Does it hold up on unseen data?"
      aside={data ? `${data.symbol} ${data.resolution} · ${day(from)} to today · unseen from ${day(data.split_at)}` : `${req.symbol} ${req.resolution}`}
    >
      {isError ? (
        <p className="text-sm text-kill">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-32" />
      ) : (
        <>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                {["Strategy", "First 70% (tuning)", "Last 30% (unseen)", "Buy & hold, last 30%", "PF, last 30%", "Avg R, last 30%", "Max DD, last 30%", "Trades, last 30%"].map((h, i) => (
                  <TableHead key={h} className={cn("eyebrow", i > 0 && "text-right")}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="tabular font-mono text-xs">
              {data.strategies.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="font-sans">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{s.display_name}</span>
                      <Badge variant="secondary">Strategy {i + 1}</Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{describeParams(s.id, s.params) ?? s.summary}</span>
                  </TableCell>
                  <TableCell className={signed(s.in_sample.return_pct)}>{fmtPct(s.in_sample.return_pct, { signed: true })}</TableCell>
                  <TableCell className={signed(s.out_of_sample.return_pct)}>{fmtPct(s.out_of_sample.return_pct, { signed: true })}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmtPct(s.out_of_sample.buy_hold_pct, { signed: true })}</TableCell>
                  <TableCell className="text-right">{s.out_of_sample.profit_factor ?? "-"}</TableCell>
                  <TableCell className={signed(s.out_of_sample.avg_r)}>{fmtR(s.out_of_sample.avg_r)}</TableCell>
                  <TableCell className="text-right text-short">{fmtPct(s.out_of_sample.max_drawdown_pct)}</TableCell>
                  <TableCell className="text-right">{s.out_of_sample.trades}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Settings are picked on the first 70%; the last 30% (from {day(data.split_at)}) is the test they never saw.
            Live trading is always unseen data. The strategy you ran uses your settings, the other its defaults;
            both pay {data.commission_pct.toFixed(3)}% fee per side.
          </p>
        </>
      )}
    </Panel>
  );
}
