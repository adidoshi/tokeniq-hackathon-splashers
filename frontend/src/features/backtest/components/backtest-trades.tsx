import { Panel } from "@/components/common/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtDateTime, fmtPrice, fmtR, fmtUsd, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BacktestTrade } from "@/types/api";

export function BacktestTrades({ trades }: { trades: BacktestTrade[] }) {
  const rows = [...trades].reverse().slice(0, 30);
  return (
    <Panel title="Simulated Trade Blotter" aside={`Latest ${rows.length} executions · UTC`}>
      <div className="overflow-x-auto rounded border border-border/60">
        <Table className="min-w-[680px]">
          <TableHeader className="bg-muted/30">
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              {["Timestamp", "Side", "Size", "Entry → Exit", "Exit Catalyst", "Net P&L", "R Multiple"].map((h, i) => (
                <TableHead
                  key={h}
                  className={cn(
                    "h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                    i >= 2 && i !== 4 && "text-right"
                  )}
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="tabular font-mono text-xs divide-y divide-border/30">
            {rows.map((t) => (
              <TableRow key={t.entry_time} className="transition-colors hover:bg-muted/40">
                <TableCell className="text-muted-foreground py-2">{fmtDateTime(t.entry_time)}</TableCell>
                <TableCell className={cn("font-bold", SIDE_TEXT_CLASS[t.side])}>
                  {t.side === "long" ? "LONG" : "SHORT"}
                </TableCell>
                <TableCell className="text-right text-foreground">{t.size}</TableCell>
                <TableCell className="text-right">
                  <span className="text-foreground">{fmtPrice(t.entry)}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-foreground">{fmtPrice(t.exit)}</span>
                </TableCell>
                <TableCell className="font-sans text-[11px] text-muted-foreground">
                  {humanize(t.exit_reason)}
                </TableCell>
                <TableCell className={cn("text-right font-bold", t.pnl >= 0 ? "text-long" : "text-short")}>
                  {fmtUsd(t.pnl, { signed: true })}
                </TableCell>
                <TableCell className={cn("text-right font-semibold", t.r_multiple > 0 ? "text-long" : t.r_multiple < 0 ? "text-short" : "text-foreground")}>
                  {fmtR(t.r_multiple)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}
