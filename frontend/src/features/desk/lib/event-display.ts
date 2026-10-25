import type { BotEvent } from "@/types/api";

/** What just happened, in trader terms. Drives toasts, the edge glow and the decision-log row accent. */
export type EventFx = "entry" | "profit" | "loss" | "stop" | "matched" | "blocked" | "kill";

export type ExecutionStatus = "executed" | "pending" | "rejected" | "failed" | "signal";

/** Turns a raw engine event into what the decision log shows: a chip label, a tone and plain text. */
export interface EventDisplay {
  label: string;
  tone: "accent" | "long" | "short" | "warn" | "danger" | "muted" | "plain";
  text: string;
  pnl?: number;
  fx?: EventFx;
  executionStatus?: ExecutionStatus;
  statusLabel?: string;
}

const TONE_CLASS: Record<EventDisplay["tone"], string> = {
  accent: "text-primary",
  long: "text-long",
  short: "text-short",
  warn: "text-warn",
  danger: "text-kill",
  muted: "text-muted-foreground",
  plain: "text-foreground",
};

export const toneClass = (tone: EventDisplay["tone"]) => TONE_CLASS[tone];

/** edge = CSS colour for the full-screen glow; row = left-border class for the decision-log row. */
export const FX_STYLE: Record<EventFx, { edge: string; row: string }> = {
  entry: { edge: "var(--glow-brand)", row: "border-l-secondary" },
  profit: { edge: "var(--glow-long)", row: "border-l-long" },
  loss: { edge: "var(--glow-short)", row: "border-l-short" },
  stop: { edge: "var(--glow-short)", row: "border-l-short" },
  matched: { edge: "var(--glow-brand)", row: "border-l-tertiary" },
  blocked: { edge: "transparent", row: "border-l-warn" },
  kill: { edge: "var(--glow-short)", row: "border-l-kill" },
};

export function describeEvent(e: BotEvent): EventDisplay {
  switch (e.kind) {
    case "signal": {
      // engine format: "LONG: fresh uptrend: EMA20>EMA50, ADX 22.2"
      const [side, ...rest] = e.message.split(": ");
      const text = rest.join(": ");
      const tone = side === "LONG" ? "long" : side === "SHORT" ? "short" : text.startsWith("no trend") ? "muted" : "accent";
      const isAudit = e.message.startsWith("CHECKLIST AUDIT");
      const matched = isAudit && e.data.met === true;
      return {
        label: `Signal · ${side.toLowerCase()}`,
        tone,
        text: capitalize(text),
        fx: matched ? "matched" : undefined,
        executionStatus: isAudit ? (matched ? "pending" : "rejected") : "signal",
        statusLabel: isAudit ? (matched ? "CRITERIA MET" : "CRITERIA UNMET") : undefined,
      };
    }
    case "order": {
      const side = e.data.side;
      const tone = side === "long" ? "long" : side === "short" ? "short" : "plain";
      const flatten = e.message.startsWith("FLATTEN");
      return {
        label: flatten ? "Order · flatten" : `Order · enter ${side ?? ""}`,
        tone,
        text: e.message,
        fx: flatten ? undefined : "entry",
        executionStatus: "executed",
        statusLabel: "EXECUTED · DELTA EXCHANGE INDIA",
      };
    }
    case "trade": {
      // P&L is rendered separately (coloured), so drop the engine's trailing "PnL +0.12"
      const pnl = typeof e.data.pnl === "number" ? e.data.pnl : undefined;
      const stopped = /stop/i.test(String(e.data.reason ?? "")) && (pnl ?? 0) < 0;
      return {
        label: "Trade · closed",
        tone: "plain",
        text: e.message.replace(/\s*PnL [+-]?[\d.]+(\s+at\s.*)?$/, ""),
        pnl,
        fx: pnl === undefined ? undefined : stopped ? "stop" : pnl >= 0 ? "profit" : "loss",
        executionStatus: "executed",
        statusLabel: "EXECUTED · DELTA EXCHANGE INDIA",
      };
    }
    case "risk": {
      const kill = e.message.startsWith("KILL");
      const blocked = e.message.startsWith("Entry blocked") || e.message.startsWith("Entry skipped");
      return {
        label: kill ? "Risk · kill switch" : blocked ? "Risk · entry blocked" : "Risk",
        tone: kill ? "danger" : "warn",
        text: e.message,
        fx: kill ? "kill" : blocked ? "blocked" : undefined,
        executionStatus: "rejected",
        statusLabel: kill ? "KILL SWITCH" : "BLOCKED BY RISK",
      };
    }
    case "error":
      return {
        label: "Error",
        tone: "danger",
        text: e.message,
        executionStatus: "failed",
        statusLabel: "FAILED",
      };
    default:
      return { label: "System", tone: "muted", text: e.message };
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
