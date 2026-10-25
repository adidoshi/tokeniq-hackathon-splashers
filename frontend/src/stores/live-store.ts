import { create } from "zustand";

import type { BotEvent, Tick } from "@/types/api";

/**
 * Client-only live state. Server data (status, events, trades) lives in the
 * TanStack Query cache instead; this store holds what only the browser knows:
 * the socket's health, the latest price tick (updates several times a second)
 * and the newest event pushed live (not replayed history), which drives the toasts and glow.
 */
export type Connection = "connecting" | "open" | "closed";

interface LiveState {
  connection: Connection;
  tick: (Tick & { at: number }) | null;
  liveEvent: BotEvent | null;
  setConnection: (connection: Connection) => void;
  setTick: (tick: Tick) => void;
  setLiveEvent: (event: BotEvent) => void;
}

export const useLiveStore = create<LiveState>()((set) => ({
  connection: "connecting",
  tick: null,
  liveEvent: null,
  setConnection: (connection) => set({ connection }),
  setTick: (tick) => set({ tick: { ...tick, at: Date.now() } }),
  setLiveEvent: (liveEvent) => set({ liveEvent }),
}));
