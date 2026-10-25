import { ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ARCHITECTURE, type ArchNode } from "./content";

const TONE_DOT: Record<NonNullable<ArchNode["tone"]>, string> = {
  brand: "bg-secondary",
  long: "bg-long",
  warn: "bg-warn",
  short: "bg-short",
};

function Lane({ label, sub, className, children }: { label: string; sub: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5 rounded-2xl border bg-muted/40 p-3.5", className)}>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function Node({ node, step }: { node: ArchNode; step?: number }) {
  return (
    <div className="relative flex gap-2.5 rounded-xl border bg-card p-2.5 shadow-2xs">
      {step !== undefined ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[10px] font-semibold text-accent-text">
          {step}
        </span>
      ) : (
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[node.tone ?? "brand"])} aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          {node.title}
          {step !== undefined && node.tone && <span className={cn("size-1.5 rounded-full", TONE_DOT[node.tone])} aria-hidden="true" />}
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">{node.detail}</p>
      </div>
    </div>
  );
}

/** Arrow between lanes: points right on wide screens, down when the lanes stack. */
function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-muted-foreground lg:flex-col" aria-hidden="true">
      <ArrowDown className="size-4 lg:hidden" />
      <ArrowRight className="hidden size-4 lg:block" />
      <span className="font-mono text-[10px]">{label}</span>
    </div>
  );
}

/** Static diagram of the live data flow. Content in content.ts (ARCHITECTURE), mirrors CLAUDE.md. */
export function ArchitectureDiagram() {
  const { exchange, loop, serve, dashboard } = ARCHITECTURE;
  return (
    <figure className="flex flex-col gap-3">
      <div className="grid gap-2 lg:grid-cols-[1fr_auto_1.35fr_auto_1fr_auto_1fr] lg:items-stretch">
        <Lane label="Delta Exchange" sub="India testnet">
          {exchange.map((n) => <Node key={n.title} node={n} />)}
          <div className="mt-auto flex gap-2.5 rounded-xl border border-dashed border-accent-line bg-accent-soft p-2.5">
            <ArrowLeft className="mt-0.5 size-3.5 shrink-0 text-accent-text" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold">Bracket stop lives here</p>
              <p className="text-[11px] leading-snug text-muted-foreground">protects the position even if the bot is down</p>
            </div>
          </div>
        </Lane>

        <Connector label="data" />

        <Lane label="Engine loop" sub="every poll, acts on each closed candle" className="glow-brand border-accent-line">
          <ol className="relative flex flex-col gap-2">
            <span className="absolute top-3 bottom-3 left-[1.3rem] w-px bg-accent-line" aria-hidden="true" />
            {loop.map((n, i) => <li key={n.title}><Node node={n} step={i + 1} /></li>)}
          </ol>
          <div className="mt-auto flex gap-2.5 rounded-xl bg-primary p-2.5 text-primary-foreground">
            <CornerDownLeft className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold">Order + bracket stop → Delta</p>
              <p className="text-[11px] leading-snug opacity-80">trailing or fixed stop sent with the entry; DRY_RUN paper-trades the same path</p>
            </div>
          </div>
        </Lane>

        <Connector label="log" />

        <Lane label="Store & API" sub="FastAPI + SQLite">
          {serve.map((n) => <Node key={n.title} node={n} />)}
        </Lane>

        <Connector label="/ws" />

        <Lane label="Dashboard" sub="Next.js 16 on Vercel">
          {dashboard.map((n) => <Node key={n.title} node={n} />)}
        </Lane>
      </div>
      <figcaption className="text-[11px] text-muted-foreground">
        Every entry and exit is decided by the engine and sent through the Delta API. The dashboard only reads state and sends controls (Start, Pause, Kill, strategy switch).
      </figcaption>
    </figure>
  );
}
