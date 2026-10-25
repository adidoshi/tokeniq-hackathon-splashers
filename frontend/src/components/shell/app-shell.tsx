"use client";

import {
  FlaskConical,
  History,
  LayoutDashboard,
  Pause,
  Play,
  RotateCcw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AnimatedNumber } from "@/components/common/animated-number";
import { LiveBadge } from "@/components/common/live-badge";
import { PartnerLogos } from "@/components/common/partner-logos";
import { Pill } from "@/components/common/pill";
import { PriceFlash } from "@/components/common/price-flash";
import { SplashersMark } from "@/components/common/splashers-mark";
import { AssetSearch } from "@/components/shell/asset-search";
import { KillSwitchDialog } from "@/components/shell/kill-switch-dialog";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { TickerStrip } from "@/components/shell/ticker-strip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBotAction, useStatus } from "@/hooks/use-bot";
import { useHydrated } from "@/hooks/use-hydrated";
import { fmtPrice, fmtUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLiveStore } from "@/stores/live-store";

const NAV = [
  {
    href: "/",
    label: "Live Desk",
    icon: LayoutDashboard,
    hint: "Live Trading & Signals",
  },
  {
    href: "/replay",
    label: "Session Replay",
    icon: History,
    hint: "Playback Past Sessions",
  },
  {
    href: "/backtest",
    label: "Backtest Lab",
    icon: FlaskConical,
    hint: "Strategy Evidence & Stats",
  },
  {
    href: "/about",
    label: "Team & Architecture",
    icon: Users,
    hint: "Technical Documentation",
  },
] as const;

function Controls() {
  const { data: status } = useStatus();
  const start = useBotAction("start");
  const stop = useBotAction("stop");
  const reset = useBotAction("resetKill");
  if (!status) return null;
  if (status.risk.killed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-md border-kill/40 bg-kill/10 text-kill hover:bg-kill/20 text-xs font-semibold"
        disabled={reset.isPending}
        onClick={() => reset.mutate()}
      >
        <RotateCcw className="size-3.5" />
        <span>Reset Kill Switch</span>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      {status.running ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-md border-warn/40 text-warn hover:bg-warn/10 text-xs font-semibold"
          disabled={stop.isPending}
          onClick={() => stop.mutate()}
        >
          <Pause className="size-3.5" />
          <span>Pause</span>
        </Button>
      ) : (
        <Button
          size="sm"
          className="h-8 gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs"
          disabled={start.isPending}
          onClick={() => start.mutate()}
        >
          <Play className="size-3.5 fill-current" />
          <span>Start Bot</span>
        </Button>
      )}
      <KillSwitchDialog status={status} />
    </div>
  );
}

function HeaderStatus() {
  const { data: status } = useStatus();
  const connection = useLiveStore((s) => s.connection);
  const tick = useLiveStore((s) => s.tick);

  if (!status) {
    return (
      <Pill tone={connection === "connecting" ? "warn" : "danger"} dot>
        {connection === "connecting"
          ? "Connecting…"
          : "Backend Offline"}
      </Pill>
    );
  }
  const price = tick?.price ?? status.price ?? status.mark_price;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-baseline gap-1.5 border-r border-border/50 pr-3 md:flex">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          {status.symbol}
        </span>
        <PriceFlash
          value={price}
          format={(n) => fmtPrice(n)}
          className="font-mono text-xs font-bold text-foreground"
        />
      </div>
      <div className="hidden items-baseline gap-1.5 border-r border-border/50 pr-3 lg:flex">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase">
          Equity
        </span>
        <span className="tabular font-mono text-xs font-bold text-foreground">
          <AnimatedNumber value={status.equity} format={(n) => fmtUsd(n)} />
        </span>
      </div>
      <LiveBadge status={status} />
    </div>
  );
}

function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/40 px-4 py-2.5 text-[11px] text-muted-foreground lg:px-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Developed by <strong className="font-semibold text-foreground">Team Splashers</strong>
        </span>
        <span aria-hidden="true" className="opacity-40">·</span>
        <span>Algo Trading Terminal for Delta Exchange India</span>
        <span aria-hidden="true" className="opacity-40">·</span>
        <span>Powered by Token IQ</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="opacity-75">Partner</span>
        <PartnerLogos size="sm" />
      </div>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3.5 py-2 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <SplashersMark />
            <div className="hidden flex-col border-l border-border/80 pl-2.5 leading-none sm:flex">
              <span className="font-heading text-xs font-bold tracking-tight text-foreground uppercase">
                Delta Exchange India
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Algo Trading Terminal · Powered by Token IQ
              </span>
            </div>
          </Link>
          <PartnerLogos size="sm" className="hidden 2xl:inline-flex" />
        </div>

        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:px-4 lg:flex lg:justify-center">
          <AssetSearch />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hydrated ? (
            <>
              <HeaderStatus />
              <Controls />
            </>
          ) : (
            <Skeleton className="h-8 w-60 rounded-md" />
          )}
          <div className="border-l border-border/60 pl-1.5">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <TickerStrip />

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Sections"
          className="flex shrink-0 gap-1 border-b border-border bg-card/60 p-1.5 md:w-52 md:flex-col md:border-r md:border-b-0 md:p-2"
        >
          {NAV.map(({ href, label, icon: Icon, hint }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")} />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate">{label}</span>
                  <span className="hidden text-[10px] text-muted-foreground/75 md:block truncate">
                    {hint}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-5">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
