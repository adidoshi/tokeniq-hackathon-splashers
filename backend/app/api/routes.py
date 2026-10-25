"""REST API for the dashboard. Node analogy: an Express Router.

`Depends(get_engine)` is FastAPI's dependency injection: each handler declares what it
needs and FastAPI provides it (like middleware attaching `req.engine`).

Rules: validate every input (400), never return another symbol's data or synthetic candles,
and surface exchange failures as 502 with a message instead of silently falling back.
"""
import math
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.backtest import RESOLUTION_SECONDS, fetch_history, run_backtest
from app.delta.client import DeltaClient
from app.engine import Engine
from app.indicators import candles_to_df
from app.risk import RiskManager
from app.strategies import STRATEGIES, describe

router = APIRouter()
PROD_URL = "https://api.india.delta.exchange"  # public candles for backtests (no keys)
CONTRACT_VALUES = {"BTCUSD": 0.001, "ETHUSD": 0.01}  # Delta contract sizes (base asset per contract)
CHART_COLUMNS = ("open", "high", "low", "close", "volume", "ema_fast", "ema_slow", "adx", "atr")


def get_engine(request: Request) -> Engine:
    return request.app.state.engine


def _check_resolution(res: str) -> str:
    if res not in RESOLUTION_SECONDS:
        raise HTTPException(400, f"resolution '{res}' is not available from Delta; use one of {list(RESOLUTION_SECONDS)}")
    return res


# ---------------- bot state + controls ----------------
@router.get("/status")
async def status(engine: Engine = Depends(get_engine)):
    return engine.snapshot()


@router.post("/bot/start")
async def start(engine: Engine = Depends(get_engine)):
    return {"result": await engine.start()}


@router.post("/bot/stop")
async def stop(engine: Engine = Depends(get_engine)):
    return {"result": await engine.stop()}


@router.post("/bot/kill")
async def kill(engine: Engine = Depends(get_engine)):
    return {"result": await engine.kill("manual (dashboard)")}


@router.post("/bot/reset-kill")
async def reset_kill(engine: Engine = Depends(get_engine)):
    return {"result": engine.reset_kill()}


class StrategySwitchRequest(BaseModel):
    strategy: str
    params: dict = {}


@router.post("/bot/select-strategy")
async def select_strategy(req: StrategySwitchRequest, engine: Engine = Depends(get_engine)):
    """Switch the live strategy. 409 with a position open, 400 for unknown/backtest-only/bad params."""
    try:
        engine.set_strategy(req.strategy, req.params)
    except RuntimeError as e:
        raise HTTPException(409, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"result": "switched", "strategy": engine.strategy.name, "params": engine.strategy.params}


@router.get("/api/strategies")
async def strategies(engine: Engine = Depends(get_engine)):
    """Every registered strategy: what it does, its defaults, whether it may trade live, which is active."""
    return [{**describe(cls), "active": name == engine.strategy.name} for name, cls in STRATEGIES.items()]


# ---------------- journal ----------------
def to_ist_str(dt: datetime | None) -> str | None:
    if not dt:
        return None
    ist = timezone(timedelta(hours=5, minutes=30))
    aware = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return aware.astimezone(ist).strftime("%d %b, %H:%M:%S IST")


@router.get("/trades")
async def trades(limit: int = Query(50, ge=1, le=500), engine: Engine = Depends(get_engine)):
    out = []
    for t in engine.store.recent_trades(limit):
        item = t.model_dump()
        item["entry_time_ist"] = to_ist_str(t.entry_time)
        item["exit_time_ist"] = to_ist_str(t.exit_time)
        out.append(item)
    return out


@router.get("/events")
async def events(engine: Engine = Depends(get_engine)):
    return list(engine.events)[::-1]


@router.get("/api/analytics/weekly")
async def analytics_weekly(engine: Engine = Depends(get_engine)):
    """Closed-trade P&L per UTC day for the last 7 days."""
    recent = engine.store.recent_trades(500)
    today = datetime.now(timezone.utc).date()
    days = []
    for back in range(6, -1, -1):
        day = today - timedelta(days=back)
        closed = [t for t in recent if t.exit_time is not None and t.exit_time.date() == day]
        wins = [t for t in closed if (t.pnl or 0) > 0]
        days.append({"day": day.strftime("%a"), "date": day.isoformat(), "trades": len(closed),
                     "pnl": round(sum(t.pnl or 0 for t in closed), 4),
                     "win_rate": round(len(wins) / len(closed) * 100, 1) if closed else 0.0})
    return days


# ---------------- market data ----------------
def _chart_rows(df: pd.DataFrame, limit: int) -> list[dict]:
    data = df.tail(limit)
    out = data[[c for c in CHART_COLUMNS if c in data]].round(2)
    out.insert(0, "time", [int(t.timestamp()) for t in data.index])
    return out.fillna(0).to_dict(orient="records")


@router.get("/candles")
async def candles(resolution: str | None = None, limit: int = Query(300, ge=10, le=1000),
                  engine: Engine = Depends(get_engine)):
    """Real Delta OHLCV for the bot's symbol + the live strategy's indicator columns."""
    res = _check_resolution(resolution or engine.s.resolution)
    warmup = engine.strategy.warmup
    if res == engine.s.resolution and engine.candles is not None and len(engine.candles) > 0:
        df = engine.candles
    else:
        now = int(time.time())
        start = now - RESOLUTION_SECONDS[res] * (limit + warmup + 50)
        try:
            df = candles_to_df(await engine.client.get_candles(engine.s.symbol, res, start, now))
        except Exception as e:
            raise HTTPException(502, f"Delta did not return {engine.s.symbol} {res} candles: {type(e).__name__}: {e}")
    if len(df) == 0:
        raise HTTPException(502, f"Delta returned no {engine.s.symbol} {res} candles")
    return _chart_rows(engine.strategy.compute(df), limit)


_TICKER_CACHE: dict = {"at": 0.0, "rows": []}
_TICKER_TTL = 4.0


def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


async def _fetch_tickers() -> list[dict]:
    """Public 24h tickers from Delta production (no keys), cached for a few seconds."""
    if time.time() - _TICKER_CACHE["at"] < _TICKER_TTL and _TICKER_CACHE["rows"]:
        return _TICKER_CACHE["rows"]
    client = DeltaClient(PROD_URL)
    try:
        rows = await client.get_tickers()
    except Exception as e:
        raise HTTPException(502, f"could not load tickers from Delta: {type(e).__name__}: {e}")
    finally:
        await client.close()
    _TICKER_CACHE.update(at=time.time(), rows=rows)
    return rows


@router.get("/market/tickers")
async def market_tickers(engine: Engine = Depends(get_engine)):
    """Real Delta perpetual tickers for the asset search / ticker strip. Only the engine's symbol is tradable."""
    out = []
    for r in await _fetch_tickers():
        symbol = r.get("symbol")
        price = _num(r.get("close")) or _num(r.get("mark_price"))
        if not symbol or not price:
            continue
        open_ = _num(r.get("open"))
        change = (price - open_) / open_ * 100 if open_ else None
        out.append({"symbol": symbol, "price": price,
                    "change_24h_pct": round(change, 2) if change is not None else None,
                    "volume_usd": _num(r.get("turnover_usd")),
                    "tradable": symbol == engine.s.symbol})
    if not out:
        raise HTTPException(502, "Delta returned no tickers")
    out.sort(key=lambda t: (not t["tradable"], -(t["volume_usd"] or 0)))
    return out


# ---------------- backtests ----------------
_HISTORY_CACHE: OrderedDict[tuple, tuple[float, pd.DataFrame]] = OrderedDict()
_CACHE_SIZE, _CACHE_TTL = 16, 300.0


async def _history(symbol: str, resolution: str, days: int) -> pd.DataFrame:
    """Real-market candles from Delta production (public), with a small LRU cache."""
    key = (symbol, resolution, days)
    hit = _HISTORY_CACHE.get(key)
    if hit and time.time() - hit[0] < _CACHE_TTL:
        _HISTORY_CACHE.move_to_end(key)
        return hit[1]
    client = DeltaClient(PROD_URL)
    try:
        df = await fetch_history(client, symbol, resolution, days)
    except Exception as e:
        raise HTTPException(502, f"could not load {symbol} {resolution} history from Delta: {type(e).__name__}: {e}")
    finally:
        await client.close()
    if len(df) < 50:
        raise HTTPException(502, f"Delta returned only {len(df)} {symbol} {resolution} candles for {days} days")
    _HISTORY_CACHE[key] = (time.time(), df)
    while len(_HISTORY_CACHE) > _CACHE_SIZE:
        _HISTORY_CACHE.popitem(last=False)
    return df


MAX_DAYS = {"1m": 14, "3m": 30, "5m": 60, "15m": 180, "30m": 365}


def _days_for(resolution: str, days: int) -> int:
    return max(1, min(days, MAX_DAYS.get(resolution, 730)))


def _make_strategy(name: str, params: dict):
    if name not in STRATEGIES:
        raise HTTPException(400, f"unknown strategy '{name}'; available: {list(STRATEGIES)}")
    try:
        return STRATEGIES[name](**params)
    except ValueError as e:
        raise HTTPException(400, str(e))


def _contract_value(symbol: str, engine: Engine) -> float:
    if symbol == engine.s.symbol:
        return engine.contract_value
    if symbol not in CONTRACT_VALUES:
        raise HTTPException(400, f"symbol '{symbol}' not supported for backtests; use {sorted({engine.s.symbol, *CONTRACT_VALUES})}")
    return CONTRACT_VALUES[symbol]


def _downsample(curve: list, points: int = 500) -> list[dict]:
    step = max(1, len(curve) // points)
    out = [{"time": t, "equity": v} for t, v in curve[::step]]
    if curve and out[-1]["time"] != curve[-1][0]:
        out.append({"time": curve[-1][0], "equity": curve[-1][1]})  # always end on the final equity
    return out


class BacktestRequest(BaseModel):
    symbol: str | None = None
    strategy: str | None = None
    days: int = Field(180, ge=1, le=730)
    resolution: str | None = None
    equity: float = Field(10000.0, gt=0)
    params: dict = {}


@router.post("/backtest")
async def backtest(req: BacktestRequest, engine: Engine = Depends(get_engine)):
    symbol = (req.symbol or engine.s.symbol).upper().strip()
    resolution = _check_resolution(req.resolution or "1h")
    strategy = _make_strategy(req.strategy or engine.strategy.name, req.params)
    days = _days_for(resolution, req.days)
    df = await _history(symbol, resolution, days)
    result = run_backtest(df, strategy, RiskManager.from_settings(engine.s), req.equity,
                          _contract_value(symbol, engine), resolution=resolution).to_dict()
    result["equity_curve"] = _downsample(result["equity_curve"])
    result["trades"] = result["trades"][-100:]
    result.update(params=strategy.params, symbol=symbol, strategy=strategy.name, resolution=resolution, days=days)
    return result


class CompareRequest(BaseModel):
    resolution: str = "1h"
    days: int = Field(365, ge=30, le=730)
    equity: float = Field(10000.0, gt=0)


METRIC_KEYS = ("return_pct", "trades", "win_rate_pct", "profit_factor", "avg_r", "max_drawdown_pct")


@router.post("/backtest/compare")
async def compare(req: CompareRequest, engine: Engine = Depends(get_engine)):
    """Every strategy on the same data: first 70% (in-sample) vs last 30% (out-of-sample)."""
    resolution = _check_resolution(req.resolution)
    days = _days_for(resolution, req.days)
    df = await _history(engine.s.symbol, resolution, days)
    cut = int(len(df) * 0.7)
    rows = []
    for name, cls in STRATEGIES.items():
        parts = {"in_sample": df.iloc[:cut], "out_of_sample": df.iloc[max(0, cut - cls.warmup):]}
        row = {**describe(cls)}
        for label, part in parts.items():
            m = run_backtest(part, cls(), RiskManager.from_settings(engine.s), req.equity,
                             engine.contract_value, resolution=resolution).metrics
            row[label] = {k: m[k] for k in METRIC_KEYS}
        rows.append(row)
    return {"symbol": engine.s.symbol, "resolution": resolution, "days": days,
            "split_at": str(df.index[cut]), "strategies": rows}


class ReplayRequest(BaseModel):
    days: int = Field(7, ge=1, le=30)
    resolution: str = "1h"
    equity: float = Field(200.0, gt=0)


@router.post("/replay")
async def replay(req: ReplayRequest, engine: Engine = Depends(get_engine)):
    """A past session pushed through the live strategy + risk code, for the dashboard to play back.

    Uses the strategy's validated defaults (not demo-speed params). Extra history is loaded
    before the window so indicators are warmed up when the session starts.
    """
    resolution = _check_resolution(req.resolution)
    cls = type(engine.strategy)
    warm_days = math.ceil(cls.warmup * RESOLUTION_SECONDS[resolution] / 86400) + 1
    df = await _history(engine.s.symbol, resolution, _days_for(resolution, req.days + warm_days))
    strategy = cls()
    result = run_backtest(df, strategy, RiskManager.from_settings(engine.s), req.equity,
                          engine.contract_value, resolution=resolution)
    window_start = df.index[-1] - timedelta(days=req.days)
    computed = strategy.compute(df)
    window = computed[computed.index > window_start]
    trades = [t.__dict__ for t in result.trades if pd.Timestamp(t.entry_time) > window_start]
    curve = [{"time": t, "equity": v} for t, v in result.equity_curve if pd.Timestamp(t) > window_start]
    start_equity = curve[0]["equity"] if curve else req.equity
    end_equity = curve[-1]["equity"] if curve else req.equity
    closed = [t for t in trades if t["exit_time"]]
    wins = [t for t in closed if t["pnl"] > 0]
    peak, max_dd = start_equity, 0.0
    for p in curve:
        peak = max(peak, p["equity"])
        max_dd = min(max_dd, (p["equity"] - peak) / peak * 100)
    summary = {
        "start_equity": round(start_equity, 2), "end_equity": round(end_equity, 2),
        "pnl": round(end_equity - start_equity, 2),
        "return_pct": round((end_equity / start_equity - 1) * 100, 2) if start_equity else 0.0,
        "buy_hold_pct": round((window["close"].iloc[-1] / window["open"].iloc[0] - 1) * 100, 2) if len(window) else 0.0,
        "trades": len(closed), "win_rate_pct": round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
        "max_drawdown_pct": round(max_dd, 2),
        "best_trade": max((t["pnl"] for t in closed), default=0.0),
        "worst_trade": min((t["pnl"] for t in closed), default=0.0),
    }
    return {"symbol": engine.s.symbol, "resolution": resolution, "days": req.days,
            "strategy": strategy.name, "strategy_display_name": strategy.display_name, "params": strategy.params,
            "candles": _chart_rows(window, len(window)), "trades": trades, "equity_curve": curve, "summary": summary}
