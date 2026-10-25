"use client";

import { Panel } from "@/components/common/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { describeEvent, FX_STYLE, toneClass } from "@/features/desk/lib/event-display";
import { useEvents } from "@/hooks/use-bot";
import { fmtUsd, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const clock = (iso: string) => parseTime(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Decision audit log showing every engine evaluation, order execution, and risk action. */
export function DecisionLog() {
  const { data: events, isPending } = useEvents();

  return (
    <Panel title="Decision Log" aside="Real-Time Narrative">
      {isPending ? (
        <div className="flex flex-col gap-1.5 py-1">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 rounded" />)}
        </div>
      ) : !events?.length ? (
        <p className="text-xs text-muted-foreground py-3">
          Standby mode. Start the bot to trace real-time signals, risk guards, order submissions, and bracket fills.
        </p>
      ) : (
        <ol className="flex max-h-[420px] flex-col overflow-y-auto pr-1 divide-y divide-border/30">
          {events.map((e) => {
            const d = describeEvent(e);
            return (
              <li
                key={`${e.ts}-${e.kind}-${e.message}`}
                className={cn(
                  "slide-in-row grid grid-cols-[58px_1fr] items-start gap-2.5 border-l-2 py-2 pl-2 transition-colors hover:bg-muted/30",
                  d.fx ? FX_STYLE[d.fx].row : "border-l-transparent"
                )}
              >
                <time dateTime={e.ts} className="tabular font-mono text-[11px] text-muted-foreground pt-0.5">
                  {clock(e.ts)}
                </time>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("text-[10px] font-mono font-semibold tracking-wider uppercase", toneClass(d.tone))}>
                      {d.label}
                    </span>
                    {d.executionStatus === "executed" && (
                      <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-mono font-bold tracking-wider text-emerald-400 uppercase">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/logos/delta-exchange-logo-white.svg"
                          alt="Delta Exchange India"
                          className="h-2.5 w-auto hidden dark:inline-block shrink-0"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/logos/delta-exchange-logo.svg"
                          alt="Delta Exchange India"
                          className="h-2.5 w-auto inline-block dark:hidden shrink-0"
                        />
                        <span>EXECUTED</span>
                      </span>
                    )}
                    {d.executionStatus === "pending" && (
                      <span className="inline-flex items-center rounded border border-amber-500/35 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider text-amber-400 uppercase">
                        PENDING
                      </span>
                    )}
                    {d.executionStatus === "rejected" && (
                      <span className="inline-flex items-center rounded border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider text-rose-400 uppercase">
                        REJECTED
                      </span>
                    )}
                    {d.executionStatus === "failed" && (
                      <span className="inline-flex items-center rounded border border-rose-600/40 bg-rose-600/15 px-1.5 py-0.5 text-[9px] font-mono font-semibold tracking-wider text-rose-300 uppercase">
                        FAILED
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-foreground/90 break-words leading-relaxed">
                    {d.text}
                    {d.pnl !== undefined && (
                      <strong className={cn("ml-1.5 font-mono text-xs font-semibold", d.pnl >= 0 ? "text-long" : "text-short")}>
                        {fmtUsd(d.pnl, { signed: true })}
                      </strong>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
