import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  ok: "bg-long",
  warn: "bg-warn",
  danger: "bg-kill",
  accent: "bg-primary",
};

const TONE_STYLE: Record<Tone, string> = {
  neutral: "border-border/70 bg-muted/40 text-muted-foreground",
  ok: "border-long/25 bg-long/10 text-long font-medium",
  warn: "border-warn/30 bg-warn/10 text-warn font-medium",
  danger: "border-kill/30 bg-kill/10 text-kill font-medium",
  accent: "border-primary/30 bg-primary/10 text-primary font-medium",
};

interface PillProps {
  tone?: Tone;
  dot?: boolean;
  mono?: boolean;
  solid?: boolean;
  children: ReactNode;
  className?: string;
}

/** Institutional status tag / badge with restrained border and status dot. */
export function Pill({ tone = "neutral", dot, mono, solid, children, className }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] transition-colors whitespace-nowrap",
        TONE_STYLE[tone],
        mono && "font-mono text-[10px]",
        solid && "font-semibold uppercase tracking-wider",
        solid && tone === "accent" && "bg-primary text-primary-foreground border-transparent",
        solid && tone === "danger" && "bg-kill text-white border-transparent",
        solid && tone === "warn" && "bg-warn text-slate-950 border-transparent",
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full shrink-0", DOT[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}
