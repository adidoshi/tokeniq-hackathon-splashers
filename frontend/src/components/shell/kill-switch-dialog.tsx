"use client";

import { OctagonX } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useBotAction } from "@/hooks/use-bot";
import { SIDE_TEXT_CLASS } from "@/lib/constants";
import { fmtPrice } from "@/lib/format";
import type { BotStatus } from "@/types/api";

const STEPS = [
  "Trading halts immediately. All signals rejected.",
  "All open orders are cancelled, including the exchange bracket stop.",
  "Open position is flattened with a reduce-only market order.",
  "The bot remains locked until manually reset.",
];

/** Institutional confirm dialog before emergency liquidation & kill switch. */
export function KillSwitchDialog({ status }: { status: BotStatus }) {
  const kill = useBotAction("kill");
  const { position } = status;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            className="h-8 gap-1.5 rounded-md border border-kill/50 bg-kill/90 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-kill"
          >
            <OctagonX className="size-3.5" />
            <span>Kill Switch</span>
          </Button>
        }
      />
      <AlertDialogContent className="rounded-lg border border-kill-line p-5 data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-kill-soft text-kill rounded-md">
            <OctagonX className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle className="font-heading text-base font-bold text-foreground">
            Activate Emergency Kill Switch?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            Immediately liquidates all open positions and cancels all working orders for {status.symbol} on Delta {status.dry_run ? "(paper mode)" : "testnet"}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-wrap justify-between gap-3 rounded-md border border-border bg-muted/50 px-3.5 py-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="eyebrow">Open Position</span>
            {position.side === "flat" ? (
              <span className="font-mono text-xs text-muted-foreground">Flat (No Exposure)</span>
            ) : (
              <span className={`font-mono text-xs font-semibold ${SIDE_TEXT_CLASS[position.side]}`}>
                {position.side.toUpperCase()} {position.size} @ {fmtPrice(position.entry_price)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="eyebrow">Account Mode</span>
            <span className="font-mono text-xs text-foreground">{status.dry_run ? "Paper Trading" : "Live Testnet"}</span>
          </div>
        </div>

        <ol className="flex flex-col gap-1.5 py-1">
          {STEPS.map((step, i) => (
            <li key={step} className="grid grid-cols-[18px_1fr] gap-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-mono font-semibold text-kill">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <AlertDialogFooter className="border-t border-border/40 pt-3">
          <AlertDialogCancel className="h-8 text-xs rounded-md">Cancel (Keep Running)</AlertDialogCancel>
          <AlertDialogAction
            disabled={kill.isPending}
            onClick={() => kill.mutate()}
            className="h-8 rounded-md bg-kill px-3 text-xs font-semibold text-white hover:bg-kill/85"
          >
            {kill.isPending ? "Liquidating…" : "Confirm & Flatten"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
