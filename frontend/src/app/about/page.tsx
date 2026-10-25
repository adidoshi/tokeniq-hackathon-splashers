import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Panel } from "@/components/common/panel";
import { PartnerLogos } from "@/components/common/partner-logos";
import { SplashersMark } from "@/components/common/splashers-mark";
import { DONE, FAIL_SAFES, FLOW, RISK_LAYERS, STRATEGY, TEAM } from "@/features/about/content";

export const metadata: Metadata = { title: "Team & Architecture · Algo Trading Terminal for Delta Exchange India" };

/** Technical specification & team credentials overview. */
export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      {/* Institutional Header Summary */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <SplashersMark className="[&_svg]:size-8" />
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-base font-bold text-foreground uppercase tracking-tight">
                Team Splashers · Algo Trading Terminal for Delta Exchange India
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Powered by Token IQ · Delta Exchange India Testnet Execution
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="opacity-75">Hackathon Partner:</span>
            <PartnerLogos size="sm" />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          TokenIQ is an autonomous institutional quantitative trading system combining a low-latency Python/FastAPI execution daemon with a Next.js 16 real-time trading workstation. The platform executes algorithmic orders via authenticated Delta Exchange REST and WebSocket APIs, enforcing hardcoded capital preservation rules, exchange-side bracket stop losses, and transparent narrative decision logging.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 shadow-xs"
          >
            <span>Open Live Trading Desk</span>
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/backtest"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <span>View Quantitative Evidence</span>
          </Link>
        </div>
      </section>

      {/* Engineering Team */}
      <Panel title="Engineering Team">
        <ul className="grid gap-3 sm:grid-cols-2">
          {TEAM.map((m) => (
            <li key={m.name} className="flex flex-col justify-between gap-2.5 rounded-md border border-border/70 bg-muted/20 p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded border border-border bg-muted font-heading text-xs font-bold text-foreground">
                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="flex flex-col">
                  <span className="font-heading text-xs font-bold text-foreground">{m.name}</span>
                  <span className="text-[10px] uppercase font-semibold text-primary tracking-wider">{m.role}</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{m.blurb}</p>
              <ul className="flex flex-wrap gap-1 border-t border-border/30 pt-2">
                {m.focus.map((f) => (
                  <li key={f} className="rounded border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[9px] font-medium text-muted-foreground">
                    {f}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Built System Capabilities */}
      <Panel title="System Architecture &amp; Delivery" aside="Verified on Delta Exchange India testnet">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {DONE.map((d, i) => (
            <li key={d.title} className="flex gap-2.5 rounded-md border border-border/70 bg-muted/20 p-3">
              <span className="font-mono text-xs font-bold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-bold text-foreground">{d.title}</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{d.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Pipeline Flow */}
      <Panel title="End-to-End Execution Flow">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs">
          {FLOW.map((step, i) => (
            <li key={step} className="flex items-center gap-1.5">
              <span className="rounded border border-border/70 bg-muted/30 px-2.5 py-1.5 font-mono text-[11px] font-medium text-foreground">
                {step}
              </span>
              {i < FLOW.length - 1 && <ArrowRight className="size-3 text-muted-foreground/60" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </Panel>

      {/* Strategy and Risk Details */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Active Trading Strategy: ${STRATEGY.name}`}>
          <div className="flex flex-col gap-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">{STRATEGY.thesis}</p>
            <div className="rounded border border-border/60 bg-muted/20 p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Execution Rules:</span>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-xs text-foreground/90">
                {STRATEGY.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
            <p className="rounded border border-primary/30 bg-primary/5 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
              {STRATEGY.evidence}
            </p>
          </div>
        </Panel>

        <Panel title="Institutional Risk Layers" aside={<ShieldCheck className="size-4 text-long" />}>
          <div className="flex flex-col gap-2.5 text-xs">
            <ul className="flex flex-col divide-y divide-border/30">
              {RISK_LAYERS.map((r, i) => (
                <li key={r} className="flex items-start gap-2 py-1.5 first:pt-0 last:pb-0">
                  <span className="font-mono text-[10px] font-bold text-primary">{i + 1}.</span>
                  <span className="text-muted-foreground">{r}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1 border-t border-border/40 pt-2">
              {FAIL_SAFES.map((f) => (
                <span key={f} className="rounded border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
