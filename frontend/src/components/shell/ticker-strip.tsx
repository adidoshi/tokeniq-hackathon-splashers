"use client";

import { PriceFlash } from "@/components/common/price-flash";
import { useTickers } from "@/hooks/use-market";
import { fmtPct, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Ticker } from "@/types/api";

export const quoteDigits = (n: number) => (n >= 1000 ? 1 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6);

function Item({ t }: { t: Ticker }) {
  const up = (t.change_24h_pct ?? 0) >= 0;
  return (
    <li className="flex items-center gap-2 border-r border-border/40 px-3.5 text-xs whitespace-nowrap">
      <span className={cn("font-medium", t.tradable ? "font-semibold text-primary" : "text-foreground/90")}>
        {t.symbol}
      </span>
      <PriceFlash value={t.price} format={(n) => fmtPrice(n, quoteDigits(n))} className="font-mono text-xs" />
      {t.change_24h_pct != null && (
        <span className={cn("tabular font-mono text-[11px] font-medium", up ? "text-long" : "text-short")}>
          {up ? "+" : ""}{fmtPct(t.change_24h_pct, { signed: false })}
        </span>
      )}
    </li>
  );
}

/** Scrolling terminal strip of real Delta perpetual market prices. */
export function TickerStrip() {
  const { data, isPending, isError } = useTickers();
  const rows = data?.slice(0, 24) ?? [];

  return (
    <div aria-label="Live market prices" className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-1">
      {isPending ? (
        <div className="shimmer mx-4 h-4 rounded" />
      ) : isError || !rows.length ? (
        <p className="px-4 text-xs text-muted-foreground">Market tickers connecting…</p>
      ) : (
        <ul className="ticker-track flex items-center">
          {[...rows, ...rows].map((t, i) => <Item key={`${t.symbol}-${i}`} t={t} />)}
        </ul>
      )}
    </div>
  );
}
