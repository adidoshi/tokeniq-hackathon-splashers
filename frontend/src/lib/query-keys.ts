/**
 * Central TanStack Query keys. Keys are arrays; invalidating a prefix (e.g. ["trades"])
 * refreshes every query that starts with it.
 */
export const queryKeys = {
  status: ["status"] as const,
  events: ["events"] as const,
  trades: (limit: number) => ["trades", limit] as const,
  candles: (limit: number, resolution?: string) => ["candles", limit, resolution ?? "live"] as const,
  weekly: ["analytics", "weekly"] as const,
  tickers: ["market", "tickers"] as const,
  strategies: ["strategies"] as const,
  compare: (resolution: string, days: number) => ["compare", resolution, days] as const,
  replay: (days: number, resolution: string) => ["replay", days, resolution] as const,
};
