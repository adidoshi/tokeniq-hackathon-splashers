"use client";

import { cn } from "@/lib/utils";
import type { BotStatus } from "@/types/api";

type Tone = "run" | "idle" | "warn" | "kill";

const TONE: Record<Tone, { box: string; dot: string }> = {
  run: { box: "border-long/30 bg-long/10 text-long", dot: "bg-long pulse-ring" },
  idle: { box: "border-border bg-muted/60 text-muted-foreground", dot: "bg-muted-foreground/60" },
  warn: { box: "border-warn/30 bg-warn/10 text-warn", dot: "bg-warn" },
  kill: { box: "border-kill/40 bg-kill/15 text-kill font-semibold", dot: "bg-kill" },
};

/** Institutional live badge indicating bot execution state and execution environment. */
export function LiveBadge({ status }: { status: BotStatus }) {
  const tone: Tone = status.risk.killed
    ? "kill"
    : status.risk.halted_reason
      ? "warn"
      : status.running
        ? "run"
        : "idle";

  const label = status.risk.killed
    ? "KILL SWITCH ACTIVE"
    : status.risk.halted_reason
      ? "HALTED"
      : status.running
        ? "ALGO RHYTHM LIVE"
        : "ALGO RHYTHM STANDBY";

  const t = TONE[tone];
  return (
    <div className="flex items-center gap-2">
      <span
        role="status"
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-mono font-medium tracking-wide whitespace-nowrap transition-colors",
          t.box
        )}
      >
        <span className={cn("size-2 rounded-full shrink-0", t.dot)} aria-hidden="true" />
        <span>{label}</span>
      </span>

      <span
        title="Execution routes through Delta Exchange India testnet environment"
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-emerald-400 uppercase shadow-xs whitespace-nowrap"
      >
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] shrink-0" aria-hidden="true" />
        TESTNET DEMO
      </span>
    </div>
  );
}
