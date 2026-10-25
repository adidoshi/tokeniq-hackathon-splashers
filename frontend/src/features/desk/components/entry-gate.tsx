"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { Panel } from "@/components/common/panel";
import { useStatus } from "@/hooks/use-bot";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Every condition evaluated by the strategy before placing an order. All must pass simultaneously. */
export function EntryGate() {
  const { data: s } = useStatus();
  const items = s?.checklist ?? [];
  const met = items.filter((c) => c.met).length;
  const sig = s?.last_signal;

  return (
    <Panel
      title="Entry Gate"
      aside={
        items.length ? (
          <span className={cn("font-mono font-semibold text-xs", met === items.length ? "text-long" : "text-muted-foreground")}>
            {met}/{items.length} criteria met
          </span>
        ) : null
      }
    >
      {s?.running && (
        <div role="img" aria-label="Scanning incoming candles" className="relative -mt-1 h-0.5 overflow-hidden rounded-full bg-muted">
          <span className="bar-sweep absolute inset-y-0 w-1/3 rounded-full bg-primary" />
        </div>
      )}

      {s && (
        <div className="rounded-md border border-border/70 bg-muted/30 p-2.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground">{s.strategy_display_name}</span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">{s.resolution} interval</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground leading-normal">{s.strategy_summary}</p>
          {sig && (
            <div className="mt-2 flex items-baseline gap-1.5 border-t border-border/40 pt-1.5 text-[11px]">
              <span className="text-muted-foreground">Last Signal:</span>
              <span className={cn("font-mono font-semibold uppercase", SIDE_TEXT_CLASS[sig.side])}>
                {sig.side === "flat" ? "FLAT" : sig.side}
              </span>
              <span className="truncate text-muted-foreground">· {sig.reason}</span>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Checklist will populate as soon as market candles are cached.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/40">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5 py-2 first:pt-1 last:pb-0">
              {c.met ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-long" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-medium leading-none", c.met ? "text-foreground" : "text-muted-foreground")}>
                    {c.title}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[10px] uppercase font-semibold px-1 rounded",
                      c.met ? "bg-long/10 text-long" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {c.met ? "PASS" : "WAIT"}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">{c.condition}</span>
                <span className="font-mono text-[11px] text-foreground/90 break-words">{c.value}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
