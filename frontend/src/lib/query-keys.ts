/**
 * Central TanStack Query keys. Keys are arrays; invalidating a prefix (e.g. ["trades"])
 * refreshes every query that starts with it.
 */
export const queryKeys = {
  status: ["status"] as const,
  events: ["events"] as const,
  trades: (limit: number) => ["trades", limit] as const,
  candles: (limit: number, resolution?: string, strategy?: string) =>
    ["candles", limit, resolution ?? "live", strategy ?? "active"] as const,
  weekly: ["analytics", "weekly"] as const,
  tickers: ["market", "tickers"] as const,
  strategies: ["strategies"] as const,
  compare: (resolution: string, days: number) => ["compare", resolution, days] as const,
  replay: (days: number, resolution: string, strategy?: string) =>
    ["replay", days, resolution, strategy ?? "active"] as const,
};
