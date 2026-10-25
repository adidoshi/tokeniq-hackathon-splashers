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
  "Trading halts. No new entries.",
  "All open orders are cancelled, including the exchange stop.",
  "The position closes with a reduce-only market order.",
  "The bot stays off until you reset the kill switch.",
];

/** Accessible confirm (focus trap, Escape to cancel) before the irreversible flatten. */
export function KillSwitchDialog({ status }: { status: BotStatus }) {
  const kill = useBotAction("kill");
  const { position } = status;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button className="h-9 rounded-xl bg-kill px-3.5 font-semibold text-white hover:bg-kill/85">
            <OctagonX /> Kill switch
          </Button>
        }
      />
      <AlertDialogContent className="border border-kill-line p-6 data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-kill-soft text-kill">
            <OctagonX />
          </AlertDialogMedia>
          <AlertDialogTitle className="font-heading text-lg font-bold">Kill the bot now?</AlertDialogTitle>
          <AlertDialogDescription>
            Closes everything for {status.symbol} on Delta {status.dry_run ? "(paper mode)" : "testnet"}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-wrap justify-between gap-3 rounded-xl border bg-muted px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Open position</span>
            {position.side === "flat" ? (
              <span className="font-mono text-sm">Flat</span>
            ) : (
              <span className={`font-mono text-sm font-semibold ${SIDE_TEXT_CLASS[position.side]}`}>
                {position.side.toUpperCase()} {position.size} @ {fmtPrice(position.entry_price)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <span className="eyebrow">Mode</span>
            <span className="font-mono text-sm">{status.dry_run ? "Paper" : "Live testnet"}</span>
          </div>
        </div>

        <ol className="flex flex-col gap-2">
          {STEPS.map((step, i) => (
            <li key={step} className="grid grid-cols-[22px_1fr] gap-2 text-sm leading-relaxed">
              <span className="font-mono text-xs leading-relaxed font-semibold text-kill">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>

        <AlertDialogFooter className="bg-muted">
          <AlertDialogCancel>Keep running</AlertDialogCancel>
          <AlertDialogAction
            disabled={kill.isPending}
            onClick={() => kill.mutate()}
            className="bg-kill font-semibold text-white hover:bg-kill/85"
          >
            {kill.isPending ? "Flattening…" : "Kill and flatten"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
