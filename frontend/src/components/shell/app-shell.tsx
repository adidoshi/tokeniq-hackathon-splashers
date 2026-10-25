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
    hint: "Bot trading now",
  },
  {
    href: "/replay",
    label: "Session Replay",
    icon: History,
    hint: "Past week, sped up",
  },
  {
    href: "/backtest",
    label: "Backtest Lab",
    icon: FlaskConical,
    hint: "Evidence & comparison",
  },
  {
    href: "/about",
    label: "Team & Build",
    icon: Users,
    hint: "Who built this, what's done",
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
        className="h-9 rounded-xl"
        disabled={reset.isPending}
        onClick={() => reset.mutate()}
      >
        <RotateCcw /> Reset kill switch
      </Button>
    );
  }
  return (
    <>
      {status.running ? (
        <Button
          variant="outline"
          className="h-9 rounded-xl"
          disabled={stop.isPending}
          onClick={() => stop.mutate()}
        >
          <Pause /> Pause bot
        </Button>
      ) : (
        <Button
          className="h-9 rounded-xl px-3.5 font-semibold"
          disabled={start.isPending}
          onClick={() => start.mutate()}
        >
          <Play /> Start bot
        </Button>
      )}
      <KillSwitchDialog status={status} />
    </>
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
          ? "Connecting to bot…"
          : "Bot backend offline"}
      </Pill>
    );
  }
  const price = tick?.price ?? status.price ?? status.mark_price;

  return (
    <>
      <div className="hidden items-baseline gap-2 md:flex">
        <span className="text-xs font-medium text-muted-foreground">
          {status.symbol}
        </span>
        <PriceFlash
          value={price}
          format={(n) => fmtPrice(n)}
          className="font-mono text-sm font-semibold text-primary"
        />
      </div>
      <div className="hidden items-baseline gap-2 lg:flex">
        <span className="text-xs font-medium text-muted-foreground">
          Equity
        </span>
        <span className="tabular font-mono text-sm font-semibold text-primary">
          <AnimatedNumber value={status.equity} format={(n) => fmtUsd(n)} />
        </span>
      </div>
      <Pill
        tone={status.market_ws && connection === "open" ? "ok" : "warn"}
        dot
      >
        {connection !== "open"
          ? "Live updates paused"
          : status.market_ws
            ? "Market feed live"
            : "Market feed down"}
      </Pill>
      <LiveBadge status={status} />
    </>
  );
}

function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-card/60 px-4 py-3 text-xs text-muted-foreground lg:px-6">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Developed by{" "}
          <b className="font-heading text-heading">Team Splashers</b>
        </span>
        <span aria-hidden="true">·</span>
        <span>© 2026</span>
        <span aria-hidden="true">·</span>
        <span>Algo trading hackathon</span>
      </span>
      <span className="flex items-center gap-2.5">
        Organised by <PartnerLogos size="sm" />
      </span>
    </footer>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 backdrop-blur-md lg:px-6">
        <Link href="/" className="flex items-center gap-3">
          <SplashersMark />
          <span className="hidden flex-col border-l pl-3 leading-tight sm:flex">
            <span className="font-heading text-sm font-bold text-heading">
              TokenIQ Hackathon
            </span>
            <span className="text-[11px] text-muted-foreground">
              Autonomous BTC desk · Delta India testnet
            </span>
          </span>
        </Link>
        <PartnerLogos size="sm" className="hidden xl:inline-flex" />
        <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1 sm:px-4 lg:flex lg:justify-center">
          <AssetSearch />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {hydrated ? (
            <>
              <HeaderStatus />
              <Controls />
            </>
          ) : (
            <Skeleton className="h-9 w-72 rounded-xl" />
          )}
          <ThemeToggle />
        </div>
      </header>
      <TickerStrip />

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Sections"
          className="flex shrink-0 gap-1 border-b bg-card p-2 md:w-56 md:flex-col md:border-r md:border-b-0 md:p-3"
        >
          {NAV.map(({ href, label, icon: Icon, hint }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-primary",
                  active && "bg-accent-soft text-primary",
                )}
              >
                <Icon className={cn("size-4", active && "text-secondary")} />
                <span className="flex flex-col">
                  {label}
                  <span className="hidden text-[10px] font-normal text-muted-foreground md:block">
                    {hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
