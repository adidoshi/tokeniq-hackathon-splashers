"use client";

import { CircleCheck, CircleX } from "lucide-react";

import { Panel } from "@/components/common/panel";
import { useStatus } from "@/hooks/use-bot";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Every condition the bot checks before an order, with its live value. All must pass. */
export function EntryGate() {
  const { data: s } = useStatus();
  const items = s?.checklist ?? [];
  const met = items.filter((c) => c.met).length;
  const sig = s?.last_signal;

  return (
    <Panel
      className={items.length > 0 && met === items.length ? "glow-pulse" : undefined}
      title="Entry gate"
      aside={items.length ? <span className={cn("font-semibold", met === items.length ? "text-long" : "text-warn")}>{met}/{items.length} met</span> : null}
    >
      {s?.running && (
        <div role="img" aria-label="Bot is scanning each closed candle" className="relative -mt-1.5 h-0.5 overflow-hidden rounded-full bg-muted">
          <span className="bar-sweep absolute inset-y-0 w-1/3 rounded-full bg-secondary" />
        </div>
      )}
      {s && (
        <div className="rounded-xl border border-accent-line bg-accent-soft px-3.5 py-3">
          <p className="text-xs font-semibold text-primary">{s.strategy_display_name}</p>
          <p className="text-xs text-muted-foreground">{s.strategy_summary}</p>
          {sig && (
            <p className="mt-1.5 text-xs">
              Last decision: <b className={SIDE_TEXT_CLASS[sig.side]}>{sig.side === "flat" ? "hold" : sig.side}</b> · {sig.reason}
            </p>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Conditions appear once candles have loaded.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {c.met
                ? <CircleCheck key="met" className="pop-in mt-0.5 size-4 shrink-0 text-long" />
                : <CircleX key="unmet" className="mt-0.5 size-4 shrink-0 text-kill" />}
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold">{c.title}</span>
                <span className="text-[11px] text-muted-foreground">{c.condition}</span>
                <span className="font-mono text-[11px] break-words text-foreground">{c.value}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
