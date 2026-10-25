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

/** RFC 4180: quote every field, double inner quotes (entry reasons contain commas). */
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

export function TradesTable() {
  const { data: trades, isPending } = useTrades(100);

  return (
    <Panel
      title="Trades"
      aside={
        trades?.length ? (
          <Button variant="outline" size="sm" onClick={() => downloadCsv(trades)}>
            <Download /> CSV
          </Button>
        ) : null
      }
    >
      {isPending ? (
        <Skeleton className="h-28" />
      ) : !trades?.length ? (
        <p className="text-sm text-muted-foreground">No trades yet. The bot only enters when every entry-gate condition passes.</p>
      ) : (
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow>
              {["Opened", "Side", "Size", "Entry → Exit", "Closed by", "P&L", "Mode"].map((h, i) => (
                <TableHead key={h} className={cn("eyebrow", [2, 3, 5].includes(i) && "text-right")}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className="tabular font-mono text-xs">
            {trades.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{when(t.entry_time)}</TableCell>
                <TableCell className={cn("font-semibold", SIDE_TEXT_CLASS[t.side])}>{t.side.toUpperCase()}</TableCell>
                <TableCell className="text-right">{t.size}</TableCell>
                <TableCell className="text-right">
                  {fmtPrice(t.entry_price)} → {t.exit_price != null ? fmtPrice(t.exit_price) : <span className="text-secondary">open</span>}
                </TableCell>
                <TableCell className="font-sans text-muted-foreground">{t.exit_reason ? humanize(t.exit_reason) : "-"}</TableCell>
                <TableCell className={cn("text-right font-semibold", t.pnl != null && (t.pnl >= 0 ? "text-long" : "text-short"))}>
                  {fmtUsd(t.pnl, { signed: true })}
                </TableCell>
                <TableCell><Badge variant={t.dry_run ? "secondary" : "outline"}>{t.dry_run ? "Paper" : "Live"}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
