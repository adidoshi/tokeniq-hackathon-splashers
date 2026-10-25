"use client";

import { cn } from "@/lib/utils";
import type { BotStatus } from "@/types/api";

type Tone = "run" | "idle" | "warn" | "kill";

const TONE: Record<Tone, { box: string; dot: string; ring: string }> = {
  run: { box: "border-long/40 bg-long/10 text-long", dot: "bg-long", ring: "var(--glow-long)" },
  idle: { box: "border-border bg-muted text-muted-foreground", dot: "bg-dim", ring: "transparent" },
  warn: { box: "border-warn/40 bg-warn/10 text-warn", dot: "bg-warn", ring: "transparent" },
  kill: { box: "border-kill-line bg-kill-soft text-kill", dot: "bg-kill", ring: "var(--glow-short)" },
};

/** The bot's state as a glowing badge: pulsing ring while it runs, orbiting spinner on top of the dot. */
export function LiveBadge({ status }: { status: BotStatus }) {
  const tone: Tone = status.risk.killed ? "kill" : status.risk.halted_reason ? "warn" : status.running ? "run" : "idle";
  const label = status.risk.killed ? "Kill switch" : status.risk.halted_reason ? "Halted" : status.running ? "Bot running" : "Bot paused";
  const t = TONE[tone];
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-heading text-xs font-semibold tracking-wider uppercase", t.box)}
    >
      <span className="relative flex size-3 items-center justify-center">
        <span
          className={cn("size-2 rounded-full", t.dot, tone !== "idle" && tone !== "warn" && "pulse-ring")}
          style={{ ["--ring-color" as string]: t.ring }}
        />
        {tone === "run" && <span className="spin-orbit absolute inset-[-3px] rounded-full border border-transparent border-t-long" aria-hidden="true" />}
      </span>
      {label}
      <span className="font-normal tracking-normal text-muted-foreground normal-case">
        {status.dry_run ? "paper" : "testnet"}
        {status.preset === "demo" ? " · demo speed" : ""}
      </span>
    </span>
  );
}
