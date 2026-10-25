"use client";

import { Panel } from "@/components/common/panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStrategyComparison } from "@/hooks/use-backtest";
import { fmtPct, fmtR, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const signed = (n: number) => cn("text-right font-semibold", n > 0 ? "text-long" : n < 0 ? "text-short" : "");

/**
 * The honest-evidence table: all four strategies on the same year of data, first 70% vs the last 30%
 * they were never chosen on. Only strategies that hold up out of sample are allowed to trade live.
 */
export function StrategyComparison() {
  const { data, isPending, isError, error } = useStrategyComparison("1h", 365);

  return (
    <Panel
      title="Which strategy may trade? In-sample vs out-of-sample"
      aside={data ? `${data.symbol} 1h · 365 days · split ${parseTime(data.split_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : null}
    >
      {isError ? (
        <p className="text-sm text-kill">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-44" />
      ) : (
        <>
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                {["Strategy", "Return in", "Return out", "PF out", "Avg R out", "Max DD out", "Trades out"].map((h, i) => (
                  <TableHead key={h} className={cn("eyebrow", i > 0 && "text-right")}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="tabular font-mono text-xs">
              {data.strategies.map((s) => (
                <TableRow key={s.id} className={cn(s.live_enabled && "bg-accent-soft")}>
                  <TableCell className="font-sans">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{s.display_name}</span>
                      <Badge variant={s.live_enabled ? "default" : "secondary"}>{s.live_enabled ? "LIVE" : "evidence only"}</Badge>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{s.summary}</span>
                  </TableCell>
                  <TableCell className={signed(s.in_sample.return_pct)}>{fmtPct(s.in_sample.return_pct, { signed: true })}</TableCell>
                  <TableCell className={signed(s.out_of_sample.return_pct)}>{fmtPct(s.out_of_sample.return_pct, { signed: true })}</TableCell>
                  <TableCell className="text-right">{s.out_of_sample.profit_factor ?? "-"}</TableCell>
                  <TableCell className={signed(s.out_of_sample.avg_r)}>{fmtR(s.out_of_sample.avg_r)}</TableCell>
                  <TableCell className="text-right text-short">{fmtPct(s.out_of_sample.max_drawdown_pct)}</TableCell>
                  <TableCell className="text-right">{s.out_of_sample.trades}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Same data, fees (0.053% per side) and risk rules for every strategy. Fixed 0.20% stops lose about half their
            risk to fees on each trade; only the regime-filtered trend follower survives the out-of-sample period, so it
            is the only one the live engine accepts.
          </p>
        </>
      )}
    </Panel>
  );
}
