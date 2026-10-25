"use client";

import { Panel } from "@/components/common/panel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useStrategyComparison } from "@/hooks/use-backtest";
import { fmtPct, fmtR, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const signed = (n: number) => cn("text-right font-bold", n > 0 ? "text-long" : n < 0 ? "text-short" : "text-muted-foreground");

/** Institutional evidence matrix: comparing in-sample (70%) vs out-of-sample (30%) performance. */
export function StrategyComparison() {
  const { data, isPending, isError, error } = useStrategyComparison("1h", 365);

  return (
    <Panel
      title="Out-of-Sample Strategy Matrix"
      aside={data ? `${data.symbol} 1h · 365 Days · Split ${parseTime(data.split_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}` : null}
    >
      {isError ? (
        <p className="text-xs text-kill">{error.message}</p>
      ) : isPending ? (
        <Skeleton className="h-40 rounded" />
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="overflow-x-auto rounded border border-border/60">
            <Table className="min-w-[720px]">
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border/60 hover:bg-transparent">
                  {["Strategy Model", "In-Sample Ret", "Out-of-Sample Ret", "OOS PF", "OOS Avg R", "OOS Max DD", "OOS Trades"].map((h, i) => (
                    <TableHead
                      key={h}
                      className={cn(
                        "h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                        i > 0 && "text-right"
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="tabular font-mono text-xs divide-y divide-border/30">
                {data.strategies.map((s) => (
                  <TableRow key={s.id} className={cn("transition-colors hover:bg-muted/40", s.live_enabled && "bg-primary/5")}>
                    <TableCell className="font-sans py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{s.display_name}</span>
                        <Badge
                          variant={s.live_enabled ? "default" : "secondary"}
                          className={cn(
                            "text-[9px] font-mono font-bold tracking-wider uppercase py-0",
                            s.live_enabled ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}
                        >
                          {s.live_enabled ? "LIVE DESK" : "EVIDENCE ONLY"}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{s.summary}</span>
                    </TableCell>
                    <TableCell className={signed(s.in_sample.return_pct)}>{fmtPct(s.in_sample.return_pct, { signed: true })}</TableCell>
                    <TableCell className={signed(s.out_of_sample.return_pct)}>{fmtPct(s.out_of_sample.return_pct, { signed: true })}</TableCell>
                    <TableCell className="text-right text-foreground font-semibold">{s.out_of_sample.profit_factor ?? "—"}</TableCell>
                    <TableCell className={signed(s.out_of_sample.avg_r)}>{fmtR(s.out_of_sample.avg_r)}</TableCell>
                    <TableCell className="text-right text-short font-semibold">{fmtPct(s.out_of_sample.max_drawdown_pct)}</TableCell>
                    <TableCell className="text-right text-foreground">{s.out_of_sample.trades}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Standardised on identical BTCUSD historical market data with taker commission accounted per fill. Evaluates pure mathematical edge under out-of-sample forward conditions.
          </p>
        </div>
      )}
    </Panel>
  );
}
