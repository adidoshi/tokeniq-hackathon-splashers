"use client";

import { Download } from "lucide-react";

import { Panel } from "@/components/common/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTrades } from "@/hooks/use-bot";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtPrice, fmtUsd, humanize, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Trade } from "@/types/api";

const when = (iso: string) => parseTime(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function toCsv(trades: Trade[]): string {
  const cols = ["entry_time", "side", "size", "entry_price", "exit_time", "exit_price", "exit_reason", "pnl", "dry_run", "entry_reason"] as const;
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...trades.map((t) => cols.map((c) => esc(t[c])).join(","))].join("\n");
}

function downloadCsv(trades: Trade[]) {
  const url = URL.createObjectURL(new Blob([toCsv(trades)], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "tokeniq-trades.csv" });
  a.click();
  URL.revokeObjectURL(url);
}

/** Institutional trade blotter showing closed trades, execution prices, exit catalysts, and net P&L. */
export function TradesTable() {
  const { data: trades, isPending } = useTrades(100);

  return (
    <Panel
      title="Trade Blotter"
      aside={
        trades?.length ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded text-xs font-mono"
            onClick={() => downloadCsv(trades)}
          >
            <Download className="size-3" />
            <span>Export CSV</span>
          </Button>
        ) : null
      }
    >
      {isPending ? (
        <div className="flex flex-col gap-2 py-2">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9 w-full rounded" />)}
        </div>
      ) : !trades?.length ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Blotter empty. The bot executes only when all algorithmic risk and technical conditions are verified.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-border/60">
          <Table className="min-w-[680px]">
            <TableHeader className="bg-muted/30">
              <TableRow className="border-b border-border/60 hover:bg-transparent">
                {["Opened", "Side", "Size", "Entry → Exit", "Exit Reason", "Net P&L", "Mode"].map((h, i) => (
                  <TableHead
                    key={h}
                    className={cn(
                      "h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                      [2, 3, 5].includes(i) && "text-right"
                    )}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="tabular font-mono text-xs divide-y divide-border/30">
              {trades.map((t) => (
                <TableRow key={t.id} className="transition-colors hover:bg-muted/40">
                  <TableCell className="text-muted-foreground py-2">{when(t.entry_time)}</TableCell>
                  <TableCell className={cn("font-bold", SIDE_TEXT_CLASS[t.side])}>
                    {t.side.toUpperCase()}
                  </TableCell>
                  <TableCell className="text-right text-foreground">{t.size}</TableCell>
                  <TableCell className="text-right">
                    <span className="text-foreground">{fmtPrice(t.entry_price)}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    {t.exit_price != null ? (
                      <span className="text-foreground">{fmtPrice(t.exit_price)}</span>
                    ) : (
                      <span className="text-primary font-semibold">Active</span>
                    )}
                  </TableCell>
                  <TableCell className="font-sans text-[11px] text-muted-foreground">
                    {t.exit_reason ? humanize(t.exit_reason) : "—"}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold",
                      t.pnl != null && (t.pnl >= 0 ? "text-long" : "text-short")
                    )}
                  >
                    {fmtUsd(t.pnl, { signed: true })}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={t.dry_run ? "secondary" : "outline"}
                      className="text-[10px] font-mono font-medium uppercase py-0"
                    >
                      {t.dry_run ? "Paper" : "Live"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}
