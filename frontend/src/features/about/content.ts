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
  { title: "Exchange-side stop on every entry", text: "Each entry carries its trailing stop as a Delta bracket order, so a crashed bot never leaves a position unprotected." },
  { title: "Backtest and replay on real data", text: "The same strategy and risk code runs on real Delta history for BTC, ETH, SOL and XAUT. Signals fire on bar close, fills happen at the next open, fees are charged both sides." },
  { title: "Live dashboard", text: "Prices, equity and the decision log update over one WebSocket. Every signal, blocked entry, order and closed trade is explained as it happens." },
  { title: "Tested without the network", text: "The test suite runs against a fake exchange, including stop fills, restart recovery and the kill switch." },
];

export const FLOW = ["Delta WebSocket + REST", "Engine loop", "Strategy + entry checklist", "Risk manager", "Bracket order on Delta", "SQLite log", "Dashboard"];

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
];

export const STRATEGY = {
  name: "trend_regime",
  thesis: "Crypto trends persist, but EMA crossovers bleed in chop. The bot trades the trend only when ADX says the market is trending.",
  rules: [
    "Long when EMA20 > EMA50, close > EMA20 and ADX ≥ 20 (short is the mirror)",
    "Stand aside when ATR is more than 3× its 100-bar median",
    "Exit on a 3×ATR trailing stop held on Delta, or when the EMAs cross back",
  ],
  evidence: "On real BTCUSD (1h, 365 days): about +0.7% over the full year while buy & hold fell 28%, and about +1.7% (profit factor 1.06) on the last 30% it was never tuned on. Modest, and honest. Two other strategies we tested lost heavily out of sample, so they were dropped.",
};
