import { http } from "@/services/http";
import type { ActionResult, BotEvent, BotStatus, StrategyInfo, Trade, WeeklyMetric } from "@/types/api";

/** Bot state + controls. One function per backend endpoint, no React here. */
export const botService = {
  getStatus: () => http.get<BotStatus>("/status"),
  getEvents: () => http.get<BotEvent[]>("/events"),
  getTrades: (limit = 100) => http.get<Trade[]>(`/trades?limit=${limit}`),
  getWeeklyAnalytics: () => http.get<WeeklyMetric[]>("/api/analytics/weekly"),
  getStrategies: () => http.get<StrategyInfo[]>("/api/strategies"),

  start: () => http.post<ActionResult>("/bot/start"),
  stop: () => http.post<ActionResult>("/bot/stop"),
  kill: () => http.post<ActionResult>("/bot/kill"),
  resetKill: () => http.post<ActionResult>("/bot/reset-kill"),
  selectStrategy: (strategy: string, params: Record<string, unknown> = {}) =>
    http.post<{ result: string; strategy: string; params: Record<string, unknown> }>("/bot/select-strategy", {
      strategy,
      params,
    }),
};
