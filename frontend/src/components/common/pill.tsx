import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const DOT: Record<Tone, string> = {
  neutral: "bg-dim",
  ok: "bg-long",
  warn: "bg-warn",
  danger: "bg-kill",
  accent: "bg-primary",
};

interface PillProps {
  tone?: Tone;
  dot?: boolean;
  mono?: boolean;
  /** solid = filled lilac/red badge for the bot's primary state */
  solid?: boolean;
  children: ReactNode;
}

/** Rounded status chip used in the header and risk panel. */
export function Pill({ tone = "neutral", dot, mono, solid, children }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground",
        mono && "font-mono text-[11px]",
        solid && "border-transparent font-heading font-semibold tracking-[0.1em] uppercase",
        solid && tone === "accent" && "bg-primary text-primary-foreground",
        solid && tone === "danger" && "bg-kill text-kill-foreground",
        solid && tone === "warn" && "bg-warn text-kill-foreground",
        solid && tone === "neutral" && "bg-surface-2 text-foreground",
      )}
    >
      {dot && <span className={cn("size-2 rounded-full", DOT[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}
