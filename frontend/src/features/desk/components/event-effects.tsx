"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { describeEvent, FX_STYLE, type EventFx } from "@/features/desk/lib/event-display";
import { fmtUsd } from "@/lib/format";
import { useLiveStore } from "@/stores/live-store";
import type { BotEvent } from "@/types/api";

function announce(fx: EventFx, e: BotEvent, text: string, pnl?: number) {
  const money = pnl === undefined ? "" : ` ${fmtUsd(pnl, { signed: true })}`;
  switch (fx) {
    case "profit": return toast.success(`Profit booked${money}`, { description: text });
    case "loss": return toast.error(`Trade closed at a loss${money}`, { description: text });
    case "stop": return toast.error(`Stop-loss hit${money}`, { description: text });
    case "entry": return toast.info(`Trade taken: ${String(e.data.side ?? "").toUpperCase()}`, { description: text });
    case "matched": return toast.info("All entry criteria matched", { description: "Every checklist condition passed; risk checks run next." });
    case "blocked": return toast.warning("Entry blocked by risk guard", { description: text });
    case "kill": return toast.error("Kill switch activated", { description: text });
  }
}

/**
 * Reacts to events pushed live over the WebSocket (never the history replay on connect):
 * a toast naming what happened plus a short full-screen edge glow in the matching colour.
 * The glow is a keyed element, so every new event replays its CSS animation without any state.
 */
export function EventEffects() {
  const event = useLiveStore((s) => s.liveEvent);

  useEffect(() => {
    if (!event) return;
    const d = describeEvent(event);
    if (d.fx) announce(d.fx, event, d.text, d.pnl);
  }, [event]);

  const fx = event ? describeEvent(event).fx : undefined;
  if (!event || !fx || FX_STYLE[fx].edge === "transparent") return null;
  return (
    <div
      key={`${event.ts}-${event.message}`}
      aria-hidden="true"
      className="edge-flash"
      style={{ boxShadow: `inset 0 0 140px 12px ${FX_STYLE[fx].edge}` }}
    />
  );
}
