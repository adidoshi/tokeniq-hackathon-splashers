# TokenIQ: autonomous BTC trading bot (Delta Exchange India testnet)

Hackathon project: "Build a live algorithmic trading system using Python & Delta Exchange APIs".
Judging: Strategy logic 30% · Risk management 20% · Technical code 20% · Automation 15% · Demo 15%.
Bonus: dashboard, deployment, error handling and fail-safes. Live trading must go through the API (no manual trading).

Monorepo: `backend/` (Python 3.12, FastAPI, uv) and `frontend/` (Next.js 16, TypeScript). Frontend-specific
rules are in `frontend/AGENTS.md`. Pitch notes: `docs/` and the "TokenIQ Pitch Playbook" doc.

## Safety rules (never break these)
- **Defaults never trade real orders.** `dry_run=True`, `auto_start=False` in `backend/app/config.py`. Testnet orders need an explicit `DRY_RUN=false` in `backend/.env`.
- **Testnet keys only** (`demo.delta.exchange`). Never put live-account keys anywhere; never point `DELTA_BASE_URL` at production for trading (production is used only for *public* candles in backtests).
- **No fake data.** No synthetic candles, hardcoded metrics, placeholder "confidence" scores or static "Connected" badges. Show a loading or empty state instead. Delta has no sub-minute candle history, so there are no 5s/15s timeframes.
- **Only `live_enabled` strategies trade.** Every strategy can be backtested; the engine refuses others. A strategy is live-enabled only after it holds up out of sample (`POST /backtest/compare`).
- **Exchange-side protection first.** Every entry carries its stop as a Delta bracket order, so a crashed bot never leaves a position unprotected.

## Commands
```bash
# backend (run from backend/)
uv sync
uv run pytest                                   # 35+ tests, no network (FakeDelta)
uv run uvicorn app.main:app --reload            # API on :8000, docs at /docs
uv run python -m scripts.check_connection --order   # place + cancel a test order on testnet
uv run python -m scripts.test_bracket           # verify exchange-side trailing stop (opens+closes 1 contract)
uv run python -m scripts.compare --resolution 1h --days 365

# frontend (run from frontend/)
npm install && npm run dev                      # :3000, needs NEXT_PUBLIC_API_URL (frontend/.env.local)
npx tsc --noEmit && npm run lint && npm run build
```
Presets (`backend/.env`): `PRESET=validated` = trend_regime on 1h (the backtested setting).
`PRESET=demo` = trend_regime on 1m with `entry_mode=state`, `trail_atr=2` so judges see trades within minutes
(the UI labels it "demo speed"; it is not the validated edge).

## Architecture and data flow
```
Delta WS (ticks, 1m candles) ─┐
Delta REST (candles, account) ┴─> Engine loop (every poll_seconds)
   refresh candles + account -> reconcile with exchange -> daily-loss check
   -> on each newly CLOSED candle: strategy.compute/signal -> exits -> entry gate (checklist)
   -> RiskManager.can_open + size -> order with bracket stop (trailing or fixed)
   -> SQLite store (trades, events) -> FastAPI REST + /ws -> Next.js dashboard
```
Backend modules (`backend/app/`):
- `delta/client.py`: async REST client. HMAC-SHA256 signing (`method + timestamp + path + query + body`), server clock-offset sync, retries with exponential backoff, 429 handling via `X-RATE-LIMIT-RESET`.
- `delta/ws.py`: public market WebSocket with a heartbeat watchdog (35s) and reconnect backoff (1s → 30s).
- `indicators.py`: EMA, SMA, ATR, ADX, RSI and Stochastic in plain pandas (causal only).
- `strategies/`: the `Strategy` interface (`compute`, `signal`, `should_exit`, `get_checklist`, `defaults`, `live_enabled`, `validate_params`) and the registry in `__init__.py`.
- `risk.py`: fixed-fractional sizing, leverage cap, max trades/day, cooldown after a loss, daily loss limit (flatten + halt), kill switch.
- `engine.py`: the live loop, paper trading (DRY_RUN), reconciliation, restart recovery, circuit breaker, status snapshot.
- `backtest.py`: replays history through the same Strategy + RiskManager (signal on close, fill at the next open, stop before target, fees both sides).
- `api/routes.py`: REST (`/status`, `/bot/*`, `/trades`, `/events`, `/candles`, `/backtest`, `/backtest/compare`, `/replay`, `/api/strategies`, `/api/analytics/weekly`). `api/stream.py`: `/ws` (events + status every 2s).
- `store.py`: SQLModel/SQLite trade and event log.

## Strategy: trend_regime (the only live strategy)
- **Thesis:** crypto trends persist, but EMA crossovers bleed in chop, so we trade the trend only in a proven trending regime.
- **Entry state:** LONG when EMA20 > EMA50, close > EMA20 and ADX ≥ 20. SHORT is the mirror. Stand aside when ATR > 3× its 100-bar median (volatility shock).
- **`entry_mode=fresh`** (validated) enters only on the bar the state switches on; `state` enters whenever the state is on (demo).
- **Exit:** a 3×ATR trailing stop held on Delta (`bracket_trail_amount`); also exit when the EMAs cross back.
- **Evidence (real BTCUSD, 1h, 365 days, 70/30 split):** out-of-sample about +1%, PF 1.04.
- **The other three strategies** (`sma_cross_5_15`, `stoch_sma_66`, `scalping_strategy`) lose 27–86% out of sample. Their fixed 0.20% stops lose about half their risk to fees, and they have no regime filter. They stay as backtest evidence only.
- **On 1m** every strategy loses about 3% a day after fees, capped by the daily loss limit. That's why 1m is "demo speed" only.

## Risk layers (`risk.py`)
1. Risk 1% of equity per trade: `size = floor(min(equity·1% / (stop_distance·contract_value), equity·leverage / (price·contract_value)))`.
2. Leverage cap 5×.
3. Max 10 trades a day; 15-minute cooldown after a loss.
4. Daily loss limit −3%: flatten and halt until the next UTC day.
5. Kill switch: cancel all orders, reduce-only close, stays off until reset (survives restart).

## Fail-safes
- Clock-skew correction, with a re-sync on `request_expired`.
- Retries and backoff; 429 handling.
- WebSocket heartbeat and reconnect.
- Stale-data guard (no trading on a closed candle more than 3 bars old).
- Empty-candle guard.
- Circuit breaker: 5 errors in a row → 60s pause.
- Reconciliation every tick: an exchange stop that fired gets the trade recorded as closed.
- Restart recovery: adopt the open position and place a stop if missing (ATR from raw candles; marked tracked only once protected, retried next tick on failure).
- Strategy switch refused while a position is open.
- Boot survives a failed initial candle fetch.

## Delta API gotchas (learned the hard way)
- **Signatures expire in 5s.** The dev PC clock was 10s off: always use the client's clock offset.
- **`bracket_trail_amount` must be negative for buy entries** and positive for sells. The client sets the sign; always pass a positive distance.
- **Real taker fee is 0.053% per side** (0.045% + 18% GST), taken from the testnet order history. `FEE_RATE` and the backtest default use it.
- **`/v2/history/candles` returns at most 2000 candles per call.** `fetch_history` pages through.
- **No sub-minute history** (1m minimum).
- **BTCUSD on India testnet** is product id 84; 1 contract = 0.001 BTC; tick size 0.1; settles in USD.
- **India testnet URLs:** REST `https://cdn-ind.testnet.deltaex.org`, public WS `wss://socket-ind-pub.testnet.deltaex.org`.
- **The old WebSocket `auth` method is deprecated.** Use `key-auth` (`GET + timestamp + /live`).

## Stack gotchas
- pandas 3 stores datetimes in µs: convert timestamps with `int(ts.timestamp())`, never `// 10**9`.
- Next.js 16 has breaking changes: read `frontend/node_modules/next/dist/docs/` before using a new API. `cacheComponents` is on, so no `Date.now()`/`new Date()` during server render.
- shadcn here is **base-nova on Base UI**: composition uses `render={<Button/>}`, not `asChild`; ToggleGroup values are arrays.
- lightweight-charts v5: `chart.addSeries(CandlestickSeries, …, paneIndex)` and `createSeriesMarkers`. Canvas can't resolve CSS variables, so read fonts with `getComputedStyle`.
- Windows dev box: `python3` opens the Microsoft Store stub. Use `backend/.venv/Scripts/python.exe` or `uv run`.

## Adding a strategy
1. Create `backend/app/strategies/<name>.py`. Subclass `Strategy` and set `name`, `display_name`, `summary`, `defaults`, `warmup`, `live_enabled=False`. Implement `compute` (causal), `signal` (bar i = last closed), `should_exit` and `get_checklist`.
2. Register it in `strategies/__init__.py`.
3. Add tests that check every rule on every signal (not "side in (LONG, SHORT, FLAT)").
4. Run `POST /backtest/compare` (or `scripts/compare.py`). Set `live_enabled=True` only if it holds up out of sample.

## Conventions
- Backend: validate all API input (400/409/422), surface exchange failures as 502 with a message, never fall back to another symbol's data. Engine errors go to `emit("error", …)`.
- Tests use `FakeDelta` (`backend/tests/test_engine.py`) and must not hit the network.
- Commit messages: imperative and scoped (`backend: …`, `frontend: …`).
