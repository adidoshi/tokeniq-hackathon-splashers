"use client";

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { marketService } from "@/services/market.service";

export function useCandles(limit = 300, resolution?: string) {
  return useQuery({
    queryKey: queryKeys.candles(limit, resolution),
    queryFn: () => marketService.getCandles(limit, resolution),
    refetchInterval: 15000, // live ticks update the forming candle in between
  });
}

export function useTickers() {
  return useQuery({
    queryKey: queryKeys.tickers,
    queryFn: marketService.getTickers,
    refetchInterval: 5000,
  });
}
