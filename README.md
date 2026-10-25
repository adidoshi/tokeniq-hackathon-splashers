# TokenIQ: autonomous BTC trading bot

An algorithmic trading system on **Delta Exchange India testnet**: a Python FastAPI engine that trades BTCUSD on
its own, behind a five-layer risk engine, with a Next.js dashboard that shows every decision live.

```
backend/   FastAPI bot: Delta client, strategies, risk engine, execution loop, backtester, API
frontend/  Next.js dashboard: Live Desk, Session Replay, Backtest Lab
docs/      audit notes and screenshots
CLAUDE.md  full project context for developers and coding agents (architecture, logic, gotchas)
```

## Quickstart

Requires [uv](https://docs.astral.sh/uv/) (installs Python 3.12) and Node 20+.

```bash
# backend
cd backend
cp .env.example .env        # testnet API key/secret from demo.delta.exchange
uv sync
uv run pytest               # 35 tests, no network
uv run uvicorn app.main:app --reload        # http://localhost:8000/docs

# frontend (second terminal)
cd frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                 # http://localhost:3000
```

### Presets (`backend/.env`)

| Setting                      | Meaning                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `PRESET=validated`           | trend_regime on **1h**, the backtested setting                                                      |
| `PRESET=demo`                | trend_regime on **1m** with faster entries, so trades happen during a pitch (labelled "demo speed") |
| `DRY_RUN=true` (default)     | paper trading. Set `false` to send real orders to Delta **testnet**                                 |
| `AUTO_START=false` (default) | the bot trades only after Start on the dashboard                                                    |

## How it works

```
Delta WS (ticks) + REST (candles, account) ─> Engine loop
   reconcile with exchange ─> daily-loss check ─> on each closed candle:
   strategy signal ─> entry gate (every condition must pass) ─> risk sizing ─> order + bracket stop on Delta
   ─> SQLite (trades, events) ─> FastAPI REST + /ws ─> dashboard
```

- **Strategy `trend_regime`** (the only live strategy):
  - EMA 20/50 trend, traded only when ADX ≥ 20;
  - stands aside in volatility shocks;
  - fresh entries only;
  - 3× ATR trailing stop held on Delta.
- **Evidence**: the Backtest Lab compares all 4 strategies on the same year, in-sample vs out-of-sample. Only trend_regime holds up out of sample; the others are kept as evidence and the engine refuses to trade them.
- **Risk**: 1% equity risk per trade (ATR-sized), 5× leverage cap, 10 trades a day, 15-minute cooldown after a loss, −3% daily loss limit (flatten and halt), kill switch.
- **Fail-safes**:
  - clock-skew sync, retries and backoff, rate-limit handling;
  - WebSocket heartbeat and reconnect;
  - stale-data and empty-data guards, circuit breaker;
  - reconciliation and restart recovery (an unprotected position gets a stop);
  - strategy switch refused while a position is open.

## API

| Method | Path                                                                                   |                                                                              |
| ------ | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/health`, `/status`, `/trades`, `/events`, `/api/strategies`, `/api/analytics/weekly` | state                                                                        |
| GET    | `/candles?resolution=1m\|5m\|15m\|1h`                                                  | real Delta candles plus strategy indicators                                  |
| POST   | `/bot/start`, `/bot/stop`, `/bot/kill`, `/bot/reset-kill`                              | controls                                                                     |
| POST   | `/bot/select-strategy`                                                                 | switch the live strategy (409 with a position open, 400 if not live-enabled) |
| POST   | `/backtest` · `/backtest/compare` · `/replay`                                          | single backtest · 4-strategy comparison · session replay data                |
| WS     | `/ws`                                                                                  | live events and a status snapshot every 2s                                   |

## Checks

```bash
cd backend && uv run pytest
cd frontend && npx tsc --noEmit && npm run lint && npm run build
```

## Git branching

- main -> develop -> feat | fix | chore | refactor -> back to develop & prod(main) merge
