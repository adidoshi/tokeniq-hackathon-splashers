import { http } from "@/services/http";
import type { BacktestRequest, BacktestResult, CompareResult, ReplayResult } from "@/types/api";

export const backtestService = {
  /** Runs one strategy over real-market history on the server (takes a few seconds). */
  run: (req: BacktestRequest) => http.post<BacktestResult>("/backtest", req),
  /** Every strategy on the same data, in-sample (first 70%) vs out-of-sample (last 30%). */
  compare: (resolution = "1h", days = 365) => http.post<CompareResult>("/backtest/compare", { resolution, days }),
  /** A past session through the live strategy + risk code, for client-side playback. */
  replay: (days = 7, resolution = "1h", equity = 200) =>
    http.post<ReplayResult>("/replay", { days, resolution, equity }),
};
