"use client";

import { PriceFlash } from "@/components/common/price-flash";
import { useTickers } from "@/hooks/use-market";
import { fmtPct, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Ticker } from "@/types/api";

/** Digits that keep cheap assets readable (0.4321) without cluttering BTC (80,123.5). */
export const quoteDigits = (n: number) => (n >= 1000 ? 1 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6);

function Item({ t }: { t: Ticker }) {
  const up = (t.change_24h_pct ?? 0) >= 0;
  return (
    <li className="flex items-center gap-2 px-4 text-xs whitespace-nowrap">
      <span className={cn("font-semibold", t.tradable ? "text-primary" : "text-foreground")}>{t.symbol}</span>
      <PriceFlash value={t.price} format={(n) => fmtPrice(n, quoteDigits(n))} className="font-mono" />
      {t.change_24h_pct != null && (
        <span className={cn("tabular font-mono", up ? "text-long" : "text-short")}>
          {up ? "▲" : "▼"} {fmtPct(t.change_24h_pct, { signed: true })}
        </span>
      )}
    </li>
  );
}

/** Scrolling strip of real Delta perpetual prices. Skeleton while loading, a clear message if Delta is unreachable. */
export function TickerStrip() {
  const { data, isPending, isError } = useTickers();
  const rows = data?.slice(0, 24) ?? [];

  return (
    <div aria-label="Live market prices" className="relative overflow-hidden border-b bg-card/60 py-1.5">
      {isPending ? (
        <div className="shimmer mx-4 h-4 rounded" />
      ) : isError || !rows.length ? (
        <p className="px-4 text-xs text-muted-foreground">Market tickers unavailable right now. Retrying…</p>
      ) : (
        <ul className="ticker-track flex">
          {[...rows, ...rows].map((t, i) => <Item key={`${t.symbol}-${i}`} t={t} />)}
        </ul>
      )}
    </div>
  );
}
