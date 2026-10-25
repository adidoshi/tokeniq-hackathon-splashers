import { Panel } from "@/components/common/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtDateTime, fmtPrice, fmtR, fmtUsd, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BacktestTrade } from "@/types/api";

export function BacktestTrades({ trades }: { trades: BacktestTrade[] }) {
  const rows = [...trades].reverse().slice(0, 25);
  return (
    <Panel title="Trades" aside={`Latest ${rows.length} of the run · UTC`}>
      <Table className="min-w-[680px]">
        <TableHeader>
          <TableRow>
            {["Opened", "Side", "Size", "Entry → Exit", "Closed by", "P&L", "R"].map((h, i) => (
              <TableHead key={h} className={cn("eyebrow", i >= 2 && i !== 4 && "text-right")}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="tabular font-mono text-xs">
          {rows.map((t) => (
            <TableRow key={t.entry_time}>
              <TableCell>{fmtDateTime(t.entry_time)}</TableCell>
              <TableCell className={SIDE_TEXT_CLASS[t.side]}>{t.side === "long" ? "▲ LONG" : "▼ SHORT"}</TableCell>
              <TableCell className="text-right">{t.size}</TableCell>
              <TableCell className="text-right">{fmtPrice(t.entry)} → {fmtPrice(t.exit)}</TableCell>
              <TableCell className="font-sans text-[13px] text-muted-foreground">{humanize(t.exit_reason)}</TableCell>
              <TableCell className={cn("text-right", t.pnl >= 0 ? "text-long" : "text-short")}>{fmtUsd(t.pnl, { signed: true })}</TableCell>
              <TableCell className="text-right">{fmtR(t.r_multiple)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
