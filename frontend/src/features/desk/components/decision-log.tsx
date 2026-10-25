"use client";

import { Panel } from "@/components/common/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { describeEvent, FX_STYLE, toneClass } from "@/features/desk/lib/event-display";
import { useEvents } from "@/hooks/use-bot";
import { fmtUsd, parseTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const clock = (iso: string) => parseTime(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The bot narrating its own decisions: the best demo surface for strategy + risk logic. */
export function DecisionLog() {
  const { data: events, isPending } = useEvents();

  return (
    <Panel title="Decision log" aside="Why the bot acted · local time">
      {isPending ? (
        <div className="flex flex-col gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : !events?.length ? (
        <p className="text-sm text-muted-foreground">
          Nothing yet. Start the bot: every signal, blocked entry, order and closed trade appears here with its reason.
        </p>
      ) : (
        <ol className="flex max-h-[420px] flex-col overflow-y-auto pr-1">
          {events.map((e) => {
            const d = describeEvent(e);
            return (
              <li key={`${e.ts}-${e.kind}-${e.message}`} className={cn("slide-in-row grid grid-cols-[64px_1fr] gap-2.5 border-b border-l-2 py-2 pl-2 last:border-b-0", d.fx ? FX_STYLE[d.fx].row : "border-l-transparent")}>
                <time dateTime={e.ts} className="tabular font-mono text-[11px] text-muted-foreground">{clock(e.ts)}</time>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn("text-[10px] font-semibold tracking-wider uppercase", toneClass(d.tone))}>{d.label}</span>
                  <span className="text-xs break-words">
                    {d.text}
                    {d.pnl !== undefined && (
                      <b className={cn("ml-1.5 font-mono", d.pnl >= 0 ? "text-long" : "text-short")}>{fmtUsd(d.pnl, { signed: true })}</b>
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
