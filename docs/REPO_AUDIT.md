# TokenIQ Repository Audit & Technical Specification

> **Audit Date:** October 2026  
> **Repository:** `trading-algo-tokeniq` (https://github.com/adidoshi/trading-algo-tokeniq)  
> **Target:** Wire single-file / Next.js production-ready "Donezo"-style institutional dashboard to real trading engine logic.

---

## 1. Executive Summary & Tech Stack

The repository is an autonomous algorithmic cryptocurrency trading platform designed for **Delta Exchange India (Testnet)**. It combines a low-latency Python FastAPI backend with an institutional quantitative dashboard frontend.

### Technology Stack
* **Backend:**
  * **Language/Runtime:** Python `>=3.12` managed via `uv`
  * **API Framework:** `FastAPI >= 0.149.0`, `Uvicorn >= 0.54.0`
  * **Networking & HTTP:** `httpx >= 0.28.1`, `websockets >= 17.3`
  * **Quantitative & Data Science:** `pandas >= 3.0.6`, `numpy >= 2.5.4`
  * **Persistence / ORM:** `sqlmodel >= 0.0.48` backed by SQLite (`sqlite:///tokeniq.db`)
  * **Configuration:** `pydantic-settings >= 2.16.0`
  * **Testing:** `pytest >= 9.1.1`, `pytest-asyncio >= 1.4.0`
* **Frontend:**
  * **Framework:** Next.js 16 (App Router with Turbopack), React 19, TypeScript 5
  * **Styling:** Tailwind CSS v4, custom CSS variables, Google Fonts (`Inter`, `JetBrains Mono`, `Material Symbols Outlined`)
  * **State & Data Fetching:** TanStack Query v5 (React Query), Zustand v5
  * **Charting:** TradingView `lightweight-charts >= 5.2.1`
  * **UI Primitives & Notifications:** `@base-ui/react`, `lucide-react`, `sonner`

---

## 2. Directory Structure

```
trading-algo-tokeniq/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes.py          # REST API endpoints (/status, /trades, /candles, /backtest, etc.)
│   │   │   └── stream.py          # WebSocket streaming endpoint (/ws)
│   │   ├── delta/
│   │   │   ├── client.py          # Delta Exchange REST API client (HMAC-SHA256 authenticated)
│   │   │   ├── ws.py              # Delta Exchange public/private WebSocket client with auto-reconnect
│   │   │   └── types.py           # Delta payload types
│   │   ├── strategies/
│   │   │   ├── base.py            # Abstract Strategy class (compute, signal)
│   │   │   └── trend_regime.py    # TrendRegimeStrategy (EMA20/50 + ADX regime gate + ATR shock filter)
│   │   ├── backtest.py            # Historical candle downloader and vector backtest simulation engine
│   │   ├── config.py              # Pydantic Settings loaded from .env and environment
│   │   ├── engine.py              # Core autonomous trading engine loop (reconciliation, signals, execution)
│   │   ├── indicators.py          # EMA, ATR, ADX calculation helpers on Pandas DataFrames
│   │   ├── main.py                # FastAPI server entry point and lifespan lifecycle manager
│   │   ├── risk.py                # Institutional RiskManager (sizing, leverage, daily loss limit, kill switch)
│   │   └── store.py               # SQLite database store (TradeRow, EventRow)
│   ├── pyproject.toml             # Python dependencies and uv settings
│   └── scripts/                   # CLI verification utilities (check_connection, test_bracket, backtest)
├── frontend/
│   ├── src/
│   │   ├── app/                   # App Router pages (/ desk, /backtest)
│   │   ├── components/            # Reusable UI components & layouts
│   │   ├── features/desk/         # Desk widgets, charts, tables, cards
│   │   ├── hooks/                 # TanStack Query & WebSocket live stream hooks
│   │   ├── services/              # HTTP clients (bot.service, backtest.service)
│   │   └── stores/                # Zustand client stores
│   └── package.json
├── index.html                     # Standalone Donezo-style institutional HTML prototype
├── docs/                          # Architecture & technical documentation
└── README.md
```

---

## 3. Real Features, Data Models & Strategies

### Real Trading Strategies
* **`trend_regime` (`TrendRegimeStrategy`):**
  * **Core Concept:** Trend-following breakout strategy combining Exponential Moving Averages with regime filtering.
  * **Trend Filter:** Fast EMA (default 20) vs Slow EMA (default 50).
  * **Regime Filter:** ADX 14 must exceed `adx_threshold` (default 20.0). In low ADX, market is declared choppy and entries are suppressed.
  * **Volatility Shock Filter:** Rejects entries if ATR exceeds `shock_mult * ATR median` (default 3.0×).
  * **Bracket Protection:** Every entry immediately generates an exchange-side trailing stop or fixed bracket order held natively on Delta Exchange.

### Real Risk Engine (`RiskManager`)
* **Risk Per Trade:** ATR-based position sizing targeting 1% account risk per trade.
* **Leverage Ceiling:** Hard cap at 5× leverage on isolated margin.
* **Daily Drawdown Limit:** Circuit breaker halts bot if daily equity drops 3.0% below day-start equity.
* **Frequency Throttle:** Hard cap at 10 (or configurable 20) trades per day.
* **Post-Loss Cooldown:** 15-minute mandatory standing aside after any losing trade.
* **Emergency Kill Switch:** Cancels all open orders on exchange, flattens any open position with market order, and halts trading.

### Real Exchange Integrations & Supported Assets
* **Exchange:** Delta Exchange India Testnet (`https://cdn-ind.testnet.deltaex.org` / `wss://socket-ind-pub.testnet.deltaex.org`).
* **Active Contract:** `BTCUSD` Perpetual (Product ID: 84, contract value: 0.001 BTC per contract, settling in USD).
* **Candle Resolutions Supported:** `5s`, `1m`, `5m`, `15m`, `30m`, `1h`, `1d`.

### Real Data Models (SQLite & FastAPI)
1. **`TradeRow` (`store.py`):**
   * `id`: Primary Key (Auto-increment)
   * `symbol`: e.g. "BTCUSD"
   * `side`: "buy" | "sell" / "long" | "short"
   * `size`: Signed contract quantity
   * `entry_time`, `entry_price`, `entry_reason`
   * `exit_time`, `exit_price`, `exit_reason`
   * `pnl`: Realized net profit/loss (USD)
   * `dry_run`: Boolean flag (true = paper, false = live exchange order)
   * `order_id`: Delta Exchange order identifier
2. **`EventRow` (`store.py`):**
   * `id`: Primary Key
   * `ts`: UTC timestamp
   * `kind`: "system" | "signal" | "order" | "trade" | "risk" | "error"
   * `message`: Human-readable audit log
   * `data`: JSON telemetry payload
3. **`BotStatus` Snapshot (`engine.py`):**
   * `running`: Boolean
   * `dry_run`: Boolean
   * `balance`, `equity`, `day_start_equity`, `daily_pnl_pct`
   * `position`: `{side, size, entry_price, stop}`
   * `last_signal`: `{side, reason, indicators: {ema_fast, ema_slow, adx, atr}}`
   * `risk`: `{killed, halted_reason, trades_today, max_trades_per_day, ...}`

---

## 4. Existing API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server, WebSocket connection, and reconnect telemetry |
| `GET` | `/status` | Complete engine state snapshot (balance, position, indicators, risk) |
| `POST` | `/bot/start` | Start autonomous evaluation loop |
| `POST` | `/bot/stop` | Pause autonomous evaluation loop |
| `POST` | `/bot/kill` | Emergency kill switch (cancel orders, flatten, halt) |
| `POST` | `/bot/reset-kill` | Reset kill switch latch to allow resuming |
| `GET` | `/trades` | List recent persistent trades from SQLite |
| `GET` | `/events` | List recent audit events |
| `GET` | `/candles` | Fetch live OHLC + EMA/ADX/ATR indicators for chart |
| `POST` | `/backtest` | Run historical backtest on Delta production history |
| `WS` | `/ws` | Streaming updates (ticks, status, events) |

---

## 5. Identified Gaps (UI Prototype vs Real Repo)

To fulfill the user's specification without inventing disconnected dummy data, the following specific endpoints must be added to the FastAPI backend:

1. **`GET /api/stats`:**
   * *UI Request:* Stat cards (Total Strategies, Closed Trades, Running Bots, Pending Orders).
   * *Real Data Source:*
     * Total Strategies: `len(STRATEGIES)` (real registered strategy registry).
     * Closed Trades: Count of trades with `exit_time is not None` from SQLite `TradeRow`.
     * Running Bots: Active bot engine status (`1` if engine running, `0` if paused).
     * Pending Orders: Open limit or bracket stop orders on Delta Exchange testnet.
2. **`GET /api/strategies`:**
   * *UI Request:* Strategies list with next run time and status.
   * *Real Data Source:* Real registry `STRATEGIES`, active indicator status, interval (`5s` or `1h`), and next candle close countdown based on `engine.res`.
3. **`GET /api/bots`:**
   * *UI Request:* Bot Collaboration cards with status (`In Progress` / `Completed` / `Pending`).
   * *Real Data Source:* Primary BTCUSD algorithmic execution engine, simulated sub-worker statuses, session uptime, and current pair parameters.
4. **`GET /api/backtests`:**
   * *UI Request:* Backtest Progress donut (completed / running / queued).
   * *Real Data Source:* Historical backtest execution store tracking runs submitted via `POST /backtest`.
5. **`GET /api/analytics/weekly`:**
   * *UI Request:* Strategy Analytics weekly bars (daily P&L or win-rate).
   * *Real Data Source:* Grouped SQLite trades aggregated by day for the past 7 days, computing daily net realized PnL and win rates.
6. **Multi-Token Display:**
   * The UI prototype displayed ETH, SOL, AVAX rows under Active Positions. In the real engine, execution is actively running on `BTCUSD` Perpetual. The API will surface the real active `BTCUSD` position and recent executions from SQLite, with an extensible schema for multi-symbol workers.

