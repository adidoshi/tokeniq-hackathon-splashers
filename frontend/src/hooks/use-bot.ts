"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/query-keys";
import { botService } from "@/services/bot.service";
import { useLiveStore } from "@/stores/live-store";

/** Poll only as a fallback: while the WebSocket is open it keeps these queries fresh. */
function useFallbackInterval(ms: number) {
  const connection = useLiveStore((s) => s.connection);
  return connection === "open" ? false : ms;
}

export function useStatus() {
  return useQuery({
    queryKey: queryKeys.status,
    queryFn: botService.getStatus,
    refetchInterval: useFallbackInterval(5000),
  });
}

export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events,
    queryFn: botService.getEvents,
    refetchInterval: useFallbackInterval(10000),
  });
}

export function useTrades(limit = 100) {
  return useQuery({
    queryKey: queryKeys.trades(limit),
    queryFn: () => botService.getTrades(limit),
    refetchInterval: 15000,
  });
}

export function useWeeklyAnalytics() {
  return useQuery({
    queryKey: queryKeys.weekly,
    queryFn: botService.getWeeklyAnalytics,
    refetchInterval: 30000,
  });
}

export function useStrategies() {
  return useQuery({ queryKey: queryKeys.strategies, queryFn: botService.getStrategies, staleTime: 60_000 });
}

type BotAction = "start" | "stop" | "kill" | "resetKill";

const SUCCESS_MESSAGE: Record<BotAction, string> = {
  start: "Bot started",
  stop: "Bot paused. Open positions keep their exchange stops.",
  kill: "Kill switch fired: orders cancelled, position flat, trading halted",
  resetKill: "Kill switch reset. You can start the bot again.",
};

/** Start / stop / kill / reset as mutations; each refreshes status and shows a toast. */
export function useBotAction(action: BotAction) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: botService[action],
    onSuccess: (res) => {
      if (res.result.includes("reset it first")) toast.error("Kill switch is active. Reset it before starting.");
      else toast.success(SUCCESS_MESSAGE[action]);
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.status });
      void queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

export function useSelectStrategy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ strategy, params = {} }: { strategy: string; params?: Record<string, unknown> }) =>
      botService.selectStrategy(strategy, params),
    onSuccess: (res) => {
      const label = res.strategy === "stoch_sma_66" ? "Stochasticate Momentum 66" : "Trade Regime Follower";
      toast.success(`Active strategy switched to ${label}`);
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.status });
      void queryClient.invalidateQueries({ queryKey: ["candles"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}
