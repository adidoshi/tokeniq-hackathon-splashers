import { ArrowRight, FlaskConical, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Panel } from "@/components/common/panel";
import { PartnerLogos } from "@/components/common/partner-logos";
import { SplashersMark } from "@/components/common/splashers-mark";
import { ArchitectureDiagram } from "@/features/about/architecture-diagram";
import { BACKEND, DONE, DROPPED, FAIL_SAFES, RISK_LAYERS, STRATEGIES, TEAM } from "@/features/about/content";

export const metadata: Metadata = { title: "Team Splashers · TokenIQ Desk" };

/** Static page: who built the bot and what is done. Copy lives in features/about/content.ts. */
export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <section className="glow-brand relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-secondary/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5">
          <SplashersMark className="[&_svg]:size-12 [&_span]:text-2xl" />
          <h1 className="max-w-2xl font-heading text-3xl font-extrabold sm:text-4xl">
            An autonomous BTC trading desk that explains every decision it makes.
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Team Splashers built a live algorithmic trading system on Python and the Delta Exchange API: it trades on its own,
            protects every position on the exchange and shows its reasoning in real time.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            Organised by <PartnerLogos />
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/" className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground">
              Open the live desk <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/backtest" className="inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-xs font-semibold">
              See the evidence
            </Link>
          </div>
        </div>
      </section>

      <Panel title="The team">
        <ul className="grid gap-3 sm:grid-cols-2">
          {TEAM.map((m) => (
            <li key={m.name} className="flex flex-col gap-2 rounded-2xl border bg-muted/40 p-4">
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary/20 font-heading text-base font-bold text-accent-text">
                {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div>
                <p className="font-heading text-sm font-bold text-heading">{m.name}</p>
                <p className="eyebrow">{m.role}</p>
              </div>
              <p className="text-xs text-muted-foreground">{m.blurb}</p>
              <ul className="flex flex-wrap gap-1.5">
                {m.focus.map((f) => <li key={f} className="rounded-full border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{f}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="What we built" aside="all of it runs against the real Delta testnet API">
        <ul className="grid gap-3 sm:grid-cols-2">
          {DONE.map((d, i) => (
            <li key={d.title} className="flex gap-3 rounded-2xl border p-4">
              <span className="font-mono text-xs font-semibold text-accent-text">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">{d.title}</p>
                <p className="text-xs text-muted-foreground">{d.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Architecture" aside="how a candle becomes a protected trade">
        <ArchitectureDiagram />
      </Panel>

      <Panel title="Strategies" aside="two live-enabled, switchable from the desk">
        <div className="grid gap-3 lg:grid-cols-2">
          {STRATEGIES.map((s) => (
            <article key={s.id} className="flex flex-col gap-3 rounded-2xl border p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-heading text-sm font-bold text-heading">{s.name}</h3>
                  <p className="font-mono text-[10px] text-muted-foreground">{s.id}</p>
                </div>
                <span className="rounded-full border border-accent-line bg-accent-soft px-2.5 py-0.5 text-[10px] font-medium text-accent-text">{s.badge}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.thesis}</p>
              <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs">
                {s.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <p className="mt-auto rounded-xl border border-accent-line bg-accent-soft p-3 text-xs">{s.evidence}</p>
            </article>
          ))}
        </div>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {DROPPED}
        </p>
      </Panel>

      <Panel title="Backend" aside="Python 3.12 · FastAPI · uv">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {BACKEND.map((b) => (
            <li key={b.title} className="flex flex-col gap-1 rounded-2xl border bg-muted/40 p-4">
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.text}</p>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Risk first" aside={<ShieldCheck className="size-4 text-long" />}>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {RISK_LAYERS.map((r, i) => (
            <li key={r} className="flex flex-col gap-1.5 rounded-xl border p-3 text-xs">
              <span className="font-mono text-[10px] font-semibold text-accent-text">LAYER {i + 1}</span>
              {r}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-1.5 border-t pt-3">
          {FAIL_SAFES.map((f) => <span key={f} className="rounded-full border px-2.5 py-1 text-[10px] text-muted-foreground">{f}</span>)}
        </div>
      </Panel>
    </div>
  );
}
