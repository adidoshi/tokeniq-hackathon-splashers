/** Types mirroring the FastAPI backend responses (backend/app/engine.py snapshot, api/routes.py). */

export type Side = "long" | "short" | "flat";

export interface Indicators {
  ema_fast: number;
  ema_slow: number;
  adx: number;
  atr: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  condition: string;
  met: boolean;
  value: string;
  is_signal_bar?: boolean;
}

export interface BotStatus {
  running: boolean;
  dry_run: boolean;
  symbol: string;
  resolution: string;
  preset: "validated" | "demo";
  strategy: string;
  strategy_display_name: string;
  strategy_summary: string;
  available_strategies: string[];
  params: Record<string, number | string | boolean>;
  price: number | null;
  mark_price: number | null;
  balance: number;
  equity: number;
  daily_pnl_pct: number;
  day_start_equity: number;
  position: {
    side: Side;
    size: number;
    entry_price: number;
    stop: number | null;
    take_profit?: number | null;
    entry_time_ist?: string | null;
  };
  checklist?: ChecklistItem[];
  time_ist?: string;
  last_signal: { side: Side; reason: string; indicators: Indicators } | null;
  last_candle: string | null;
  risk: {
    killed: boolean;
    halted_reason: string;
    trades_today: number;
    max_trades_per_day: number;
    daily_loss_limit_pct: number;
    risk_per_trade_pct: number;
    max_leverage: number;
  };
  clock_offset: number;
  market_ws: boolean;
  errors: number;
  last_error: string;
}

export type EventKind = "system" | "signal" | "order" | "trade" | "risk" | "error";

export interface BotEvent {
  ts: string;
  kind: EventKind;
  message: string;
  data: Record<string, unknown>;
}

export interface Tick {
  price: number | null;
  mark: number | null;
}

/** Messages pushed by the backend on /ws. */
export type StreamMessage =
  | { kind: "status"; data: BotStatus }
  | { kind: "history"; data: BotEvent[] }
  | { kind: "tick"; ts: string; message: string; data: Tick }
  | BotEvent;

export interface Candle {
  time: number; // epoch seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** trend_regime indicator columns */
  ema_fast?: number;
  ema_slow?: number;
  adx?: number;
  atr?: number;
  /** stoch_sma_66 indicator columns */
  sma_66?: number;
  stoch_k?: number;
  stoch_d?: number;
}

export interface Trade {
  id: number;
  symbol: string;
  side: Exclude<Side, "flat">;
  size: number;
  entry_time: string;
  entry_price: number;
  entry_reason: string;
  exit_time: string | null;
  exit_price: number | null;
  exit_reason: string;
  pnl: number | null;
  dry_run: boolean;
  order_id: string;
  entry_time_ist?: string | null;
  exit_time_ist?: string | null;
}

export interface BacktestRequest {
  symbol?: string;
  strategy?: string;
  days: number;
  resolution?: string;
  equity: number;
  commission_pct?: number;
  params: Record<string, number | string | boolean>;
}

export interface BacktestMetrics {
  start_equity: number;
  end_equity: number;
  return_pct: number;
  buy_hold_pct: number;
  trades: number;
  win_rate_pct: number;
  profit_factor: number | null;
  avg_r: number;
  max_drawdown_pct: number;
  sharpe: number;
  period: string;
}

export interface BacktestTrade {
  side: Exclude<Side, "flat">;
  size: number;
  entry_time: string;
  entry: number;
  exit_time: string;
  exit: number;
  exit_reason: string;
  pnl: number;
  r_multiple: number;
  entry_reason: string;
}

export interface BacktestResult {
  symbol?: string;
  strategy?: string;
  resolution?: string;
  days?: number;
  commission_pct?: number;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equity_curve: { time: string; equity: number }[];
  params: Record<string, number | string | boolean>;
}

export interface ActionResult {
  result: string;
}

export interface WeeklyMetric {
  day: string;
  date: string;
  trades: number;
  pnl: number;
  win_rate: number;
}


export interface StrategyInfo {
  id: string;
  display_name: string;
  summary: string;
  live_enabled: boolean;
  defaults: Record<string, number | string>;
  active: boolean;
}

export interface CompareMetrics {
  return_pct: number;
  buy_hold_pct: number;
  trades: number;
  win_rate_pct: number;
  profit_factor: number | null;
  avg_r: number;
  max_drawdown_pct: number;
}

export interface CompareRequest {
  symbol: string;
  resolution: string;
  days: number;
  commission_pct: number;
  /** per strategy id; strategies left out run on their defaults */
  params: Record<string, BacktestRequest["params"]>;
}

export interface CompareResult {
  symbol: string;
  resolution: string;
  days: number;
  period: string;
  split_at: string;
  commission_pct: number;
  strategies: (Omit<StrategyInfo, "active"> & {
    params: Record<string, number | string | boolean>;
    /** true when the row ran on the params from the backtest form */
    custom: boolean;
    in_sample: CompareMetrics;
    out_of_sample: CompareMetrics;
  })[];
}

export interface ReplaySummary {
  start_equity: number;
  end_equity: number;
  pnl: number;
  return_pct: number;
  buy_hold_pct: number;
  trades: number;
  win_rate_pct: number;
  max_drawdown_pct: number;
  best_trade: number;
  worst_trade: number;
}

export interface ReplayResult {
  symbol: string;
  resolution: string;
  days: number;
  strategy: string;
  strategy_display_name: string;
  params: Record<string, number | string | boolean>;
  candles: Candle[];
  trades: BacktestTrade[];
  equity_curve: { time: string; equity: number }[];
  summary: ReplaySummary;
}

/** One Delta perpetual from GET /market/tickers. Only the bot's own symbol is tradable. */
export interface Ticker {
  symbol: string;
  price: number;
  change_24h_pct: number | null;
  volume_usd: number | null;
  tradable: boolean;
}
