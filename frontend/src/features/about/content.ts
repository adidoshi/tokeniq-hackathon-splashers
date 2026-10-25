/**
 * Copy for the About page. Edit here, not in the component.
 * Facts mirror CLAUDE.md (strategy, risk layers, fail-safes); keep them honest, no inflated results.
 */

export interface TeamMember {
  name: string;
  role: string;
  blurb: string;
  focus: string[];
}

export const TEAM: TeamMember[] = [
  {
    name: "Aditya Doshi",
    role: "Full-stack dev · trader · product",
    blurb: "Shaped the product and built the live dashboard: real-time desk, replay and backtest views, theming and the motion that makes the bot's decisions visible. Brings a trader's eye to what the screen must show.",
    focus: ["Next.js 16", "TypeScript", "Product", "Trading"],
  },
  {
    name: "Atharva Bhosale",
    role: "Python dev · trader · engineering student",
    blurb: "Builds the trading side in Python: the strategy logic, risk rules and the Delta Exchange integration, backed by hands-on trading experience.",
    focus: ["Python", "FastAPI", "Delta API", "Trading"],
  },
];

export const DONE: { title: string; text: string }[] = [
  { title: "Autonomous trading loop", text: "Polls Delta, reads each closed candle, runs the strategy, sizes the trade and places the order through the API. No manual trading." },
  { title: "Exchange-side stop on every entry", text: "Each entry carries its stop as a Delta bracket order (trailing or fixed), so a crashed bot never leaves a position unprotected." },
  { title: "Two live strategies, one switch", text: "trend_regime and Stochasticate Momentum 66 are both live-enabled. Switch between them from the dashboard; the engine refuses while a position is open." },
  { title: "Backtest and replay on real data", text: "The same strategy and risk code runs on real Delta history for BTC, ETH, SOL and XAUT. Signals fire on bar close, fills happen at the next open, fees are charged both sides." },
  { title: "Live dashboard", text: "Prices, equity and the decision log update over one WebSocket. Every signal, blocked entry, order and closed trade is explained as it happens." },
  { title: "Deployed and tested", text: "Backend on Render (Singapore, close to Delta India), dashboard on Vercel. 40+ tests run against a fake exchange, including stop fills, restart recovery and the kill switch." },
];

/** One box in the architecture diagram. `tone` picks the accent colour token. */
export interface ArchNode {
  title: string;
  detail: string;
  tone?: "brand" | "long" | "warn" | "short";
}

export const ARCHITECTURE: { exchange: ArchNode[]; loop: ArchNode[]; serve: ArchNode[]; dashboard: ArchNode[] } = {
  exchange: [
    { title: "Public WebSocket", detail: "ticks + 1m candles, 35s heartbeat, reconnect 1s → 30s" },
    { title: "REST API", detail: "HMAC-SHA256 signed, clock-offset synced, retries + 429 backoff" },
  ],
  loop: [
    { title: "Refresh", detail: "candles + account balance and position" },
    { title: "Reconcile", detail: "a stop that fired on Delta closes the trade in our log", tone: "warn" },
    { title: "Daily-loss check", detail: "−3% → flatten and halt for the UTC day", tone: "short" },
    { title: "Strategy", detail: "compute + signal on the last closed candle" },
    { title: "Entry gate", detail: "every checklist condition must pass" },
    { title: "Risk manager", detail: "1% risk sizing, 5× cap, trade limits, cooldown", tone: "long" },
  ],
  serve: [
    { title: "SQLite store", detail: "trades, events, kill-switch state" },
    { title: "FastAPI", detail: "REST /status /bot/* /backtest /replay" },
    { title: "/ws stream", detail: "events + status snapshot every 2s" },
  ],
  dashboard: [
    { title: "Live Desk", detail: "chart, trades, entry gate, decision log" },
    { title: "Session Replay", detail: "a past session through the live code" },
    { title: "Backtest Lab", detail: "in- vs out-of-sample, 4 assets" },
  ],
};

export const BACKEND: { title: string; text: string }[] = [
  { title: "Delta client", text: "Async REST with HMAC signing (method + timestamp + path + query + body). Delta signatures expire in 5s, so the client tracks the server clock offset and re-syncs on request_expired." },
  { title: "Engine", text: "One loop per poll: refresh, reconcile, risk checks, then act only on newly closed candles. Paper mode (DRY_RUN) runs the exact same path without sending orders." },
  { title: "Restart recovery", text: "On boot the engine adopts any open Delta position and places a stop if it is missing, marking it tracked only once it is protected." },
  { title: "Backtester", text: "Replays history through the same Strategy and RiskManager classes: signal on close, fill at next open, stop checked before target, 0.053% taker fee per side." },
  { title: "Non-blocking simulations", text: "Backtests run in a worker thread, one at a time, and finished results are cached for 10 minutes, so the bot's ticks and /health keep flowing on a small instance." },
  { title: "Strategy registry", text: "Every strategy implements one interface (compute, signal, should_exit, get_checklist). Any of them can be backtested; only live_enabled ones may trade." },
];

export const RISK_LAYERS = [
  "1% of equity risked per trade, sized from the stop distance",
  "5× leverage cap",
  "10 trades a day maximum, 15-minute cooldown after a loss",
  "−3% daily loss limit: flatten and halt until the next UTC day",
  "Kill switch: cancel orders, reduce-only close, stays off after a restart",
];

export const FAIL_SAFES = [
  "Clock-skew correction",
  "Retries with backoff and 429 handling",
  "WebSocket heartbeat and reconnect",
  "Stale-data and empty-candle guards",
  "Circuit breaker after 5 errors in a row",
  "Reconciliation with the exchange every tick",
  "Restart recovery of open positions",
  "Strategy switch refused with a position open",
];

export interface StrategyCard {
  id: string;
  name: string;
  badge: string;
  thesis: string;
  rules: string[];
  evidence: string;
}

export const STRATEGIES: StrategyCard[] = [
  {
    id: "trend_regime",
    name: "Trend regime follower",
    badge: "default · validated on 1h",
    thesis: "Crypto trends persist, but EMA crossovers bleed in chop. The bot trades the trend only when ADX says the market is trending.",
    rules: [
      "Long when EMA20 > EMA50, close > EMA20 and ADX ≥ 20 (short is the mirror)",
      "Stand aside when ATR is more than 3× its 100-bar median",
      "Exit on a 3×ATR trailing stop held on Delta, or when the EMAs cross back",
    ],
    evidence: "Real BTCUSD, 1h, 365 days: about +0.7% for the year and about +1% (profit factor 1.04) on the last 30% it was never tuned on. Modest, and honest.",
  },
  {
    id: "stoch_sma_66",
    name: "Stochasticate Momentum 66",
    badge: "live option · team pick",
    thesis: "Buy pullbacks inside a steady trend: the 66 SMA sets the direction, the Stochastic times the re-entry.",
    rules: [
      "Long when the 66 SMA has risen 10 bars in a row and Stochastic %K (14, 2, 3) crosses up through 20 on a green candle (short: falling SMA, %K down through 60, red candle)",
      "Stop at the 4-bar swing low/high, target at 2× the stop distance, both placed as a Delta bracket",
    ],
    evidence: "Made live by team decision. On BTC 1h it loses (about −37% over 365 days); it is positive only on ETH 4h. The Backtest Lab shows it side by side with trend_regime.",
  },
];

export const DROPPED = "Two more strategies (5/15 SMA crossover and a triple-EMA + RSI scalper) lost heavily out of sample: their fixed 0.20% stops gave about half the risk back in fees. They stay in the API as evidence; the engine refuses to trade them.";
