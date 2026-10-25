"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PriceFlash } from "@/components/common/price-flash";
import { quoteDigits } from "@/components/shell/ticker-strip";
import { useTickers } from "@/hooks/use-market";
import { fmtPct, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Search Delta perpetuals by symbol. View-only: the bot trades one symbol (the tradable one is tagged). */
export function AssetSearch() {
  const { data, isPending, isError } = useTickers();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    return (data ?? []).filter((t) => !q || t.symbol.includes(q)).slice(0, 12);
  }, [data, query]);

  return (
    <div ref={box} className="relative w-full max-w-64 min-w-40">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search assets (BTC, ETH…)"
        aria-label="Search crypto assets"
        className="h-8 w-full rounded-md border border-border/80 bg-muted/40 pr-3 pl-8 text-xs text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:bg-background"
      />
      {open && (
        <div className="absolute top-10 right-0 left-0 z-50 min-w-72 overflow-hidden rounded-md border border-border bg-popover shadow-xl">
          {isPending ? (
            <div className="shimmer m-3 h-20 rounded" />
          ) : isError ? (
            <p className="p-3 text-xs text-kill">Could not load assets from Delta.</p>
          ) : !matches.length ? (
            <p className="p-3 text-xs text-muted-foreground">No asset matches “{query}”.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1 divide-y divide-border/30">
              {matches.map((t) => {
                const up = (t.change_24h_pct ?? 0) >= 0;
                return (
                  <li
                    key={t.symbol}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs transition-colors hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{t.symbol}</span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.2 text-[9px] font-medium uppercase tracking-wider",
                          t.tradable ? "border-long/40 text-long bg-long/10" : "border-border text-muted-foreground"
                        )}
                      >
                        {t.tradable ? "Bot Trades" : "View"}
                      </span>
                    </span>
                    <span className="flex items-baseline gap-2 font-mono text-xs">
                      <PriceFlash value={t.price} format={(n) => fmtPrice(n, quoteDigits(n))} />
                      {t.change_24h_pct != null && (
                        <span className={cn("tabular w-14 text-right", up ? "text-long" : "text-short")}>
                          {up ? "+" : ""}{fmtPct(t.change_24h_pct, { signed: false })}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
