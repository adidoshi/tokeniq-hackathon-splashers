"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { backtestService } from "@/services/backtest.service";

/** A single backtest is an action the user triggers, so it's a mutation rather than a query. */
export function useBacktest() {
  return useMutation({ mutationFn: backtestService.run });
}

/** Deterministic for a given window, so cache it for the session. */
export function useStrategyComparison(resolution = "1h", days = 365) {
  return useQuery({
    queryKey: queryKeys.compare(resolution, days),
    queryFn: () => backtestService.compare(resolution, days),
    staleTime: 10 * 60_000,
  });
}

export function useReplay(days: number, resolution = "1h", equity = 200, strategy?: string) {
  return useQuery({
    queryKey: queryKeys.replay(days, resolution, strategy),
    queryFn: () => backtestService.replay(days, resolution, equity, strategy),
    staleTime: 10 * 60_000,
  });
}
