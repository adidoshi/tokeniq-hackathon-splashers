import { http } from "@/services/http";
import type { Candle, Ticker } from "@/types/api";

export const marketService = {
  /** Real Delta OHLCV for the bot's symbol (oldest first) with strategy indicator columns. */
  getCandles: (limit = 300, resolution?: string, strategy?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (resolution) params.set("resolution", resolution);
    if (strategy) params.set("strategy", strategy);
    return http.get<Candle[]>(`/candles?${params.toString()}`);
  },
  /** Real Delta perpetual tickers (price, 24h change, volume) for the search and the ticker strip. */
  getTickers: () => http.get<Ticker[]>("/market/tickers"),
};
