"""Event-driven backtester that reuses the live Strategy + RiskManager.

Realism rules (say these out loud in the demo, judges notice):
- Signals are computed on a candle's CLOSE, filled at the NEXT candle's OPEN (no lookahead).
- Stop-loss / take-profit checked intrabar on high/low; if both hit in one candle we assume
  the stop hit first (pessimistic).
- Taker fee charged on entry and exit (0.053% = Delta's 0.045% + 18% GST, as seen in order history).
"""
import math
import time
from dataclasses import asdict, dataclass, field

import pandas as pd

from app.delta.client import DeltaClient
from app.indicators import candles_to_df
from app.risk import RiskManager
from app.strategies.base import Side, Strategy

# Exactly the resolutions Delta's /v2/history/candles serves. Delta has NO sub-minute history,
# so anything like "5s" could only be fabricated - never add it back.
RESOLUTION_SECONDS = {"1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600,
                      "2h": 7200, "4h": 14400, "6h": 21600, "1d": 86400}


async def fetch_history(client: DeltaClient, symbol: str, resolution: str, days: int) -> pd.DataFrame:
    """Page through /v2/history/candles (max 2000 per call)."""
    step = RESOLUTION_SECONDS[resolution] * 2000
    end = int(time.time())
    start = end - days * 86400
    rows: list[dict] = []
    t = start
    while t < end:
        rows += await client.get_candles(symbol, resolution, t, min(t + step, end))
        t += step
    df = candles_to_df(rows)
    return df[~df.index.duplicated()]


@dataclass
class Trade:
    side: str
    size: int
    entry_time: str
    entry: float
    exit_time: str = ""
    exit: float = 0.0
    exit_reason: str = ""
    pnl: float = 0.0
    r_multiple: float = 0.0
    entry_reason: str = ""


@dataclass
class BacktestResult:
    metrics: dict
    trades: list[Trade] = field(default_factory=list)
    equity_curve: list[tuple[str, float]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"metrics": self.metrics, "trades": [asdict(t) for t in self.trades],
                "equity_curve": self.equity_curve}


def run_backtest(df: pd.DataFrame, strategy: Strategy, risk: RiskManager, start_equity: float = 10000.0,
                 contract_value: float = 0.001, fee_rate: float = 0.00053, resolution: str = "5m") -> BacktestResult:
    data = strategy.compute(df)
    equity = start_equity
    pos: Trade | None = None
    sl = initial_sl = risk_usd = trail = 0.0
    tp: float | None = None
    pending_entry = None  # Signal to fill at next open
    pending_exit = ""     # reason to exit at next open
    trades: list[Trade] = []
    curve: list[tuple[str, float]] = []

    def close(price: float, ts, reason: str) -> None:
        nonlocal equity, pos
        direction = 1 if pos.side == Side.LONG.value else -1
        gross = direction * (price - pos.entry) * pos.size * contract_value
        fees = fee_rate * price * pos.size * contract_value
        pos.pnl = round(pos.pnl + gross - fees, 4)  # pos.pnl already holds the entry fee (negative)
        pos.exit, pos.exit_time, pos.exit_reason = price, str(ts), reason
        pos.r_multiple = round(pos.pnl / risk_usd, 2) if risk_usd else 0.0
        equity += gross - fees
        risk.on_trade_closed(pos.pnl, ts.to_pydatetime())
        trades.append(pos)
        pos = None

    for i in range(len(data)):
        bar = data.iloc[i]
        ts = data.index[i]
        now = ts.to_pydatetime()

        # 1) fills at this bar's open (orders decided on the previous close)
        if pos and pending_exit:
            close(bar["open"], ts, pending_exit)
        pending_exit = ""
        if pending_entry and pos is None:
            sig, size = pending_entry
            entry = bar["open"]
            direction = 1 if sig.side == Side.LONG else -1
            sl = initial_sl = entry - direction * sig.stop_distance
            tp = entry + direction * sig.take_profit_distance if sig.take_profit_distance > 0 else None
            trail = sig.trail_distance
            risk_usd = sig.stop_distance * size * contract_value
            fee = fee_rate * entry * size * contract_value
            equity -= fee
            pos = Trade(sig.side.value, size, str(ts), entry, pnl=-fee, entry_reason=sig.reason)
            risk.on_trade_opened()
        pending_entry = None

        # 2) intrabar stop / target (stop first = pessimistic), then ratchet trailing stop
        if pos:
            stop_reason = "trailing_stop" if sl != initial_sl else "stop_loss"
            if pos.side == Side.LONG.value:
                if bar["low"] <= sl:
                    close(min(sl, bar["open"]), ts, stop_reason)  # gap through stop -> fill at open
                elif tp is not None and bar["high"] >= tp:
                    close(tp, ts, "take_profit")
                elif trail:
                    sl = max(sl, bar["high"] - trail)
            else:
                if bar["high"] >= sl:
                    close(max(sl, bar["open"]), ts, stop_reason)
                elif tp is not None and bar["low"] <= tp:
                    close(tp, ts, "take_profit")
                elif trail:
                    sl = min(sl, bar["low"] + trail)

        # 3) mark-to-market equity + account-level risk
        direction = 0 if pos is None else (1 if pos.side == Side.LONG.value else -1)
        mtm = equity + (direction * (bar["close"] - pos.entry) * pos.size * contract_value if pos else 0)
        curve.append((str(ts), round(mtm, 4)))
        if risk.check_account(now, mtm) and pos:
            pending_exit = "daily_loss_limit"
            continue

        # 4) decide on this close
        sig = strategy.signal(data, i)
        if pos and sig.side not in (Side.FLAT, Side(pos.side)):
            pending_exit = "opposite_signal"
        elif pos:
            pending_exit = strategy.should_exit(data, i, Side(pos.side)) or ""
        if sig.side != Side.FLAT and (pos is None or pending_exit):
            ok, _ = risk.can_open(now, mtm)
            size = risk.size(mtm, bar["close"], sig.stop_distance, contract_value) if ok else 0
            if size > 0:
                pending_entry = (sig, size)

    if pos:
        close(data["close"].iloc[-1], data.index[-1], "end_of_data")

    return BacktestResult(_metrics(trades, curve, start_equity, data, resolution), trades, curve)


def _metrics(trades: list[Trade], curve, start_equity: float, data: pd.DataFrame, resolution: str) -> dict:
    eq = pd.Series([v for _, v in curve])
    wins = [t.pnl for t in trades if t.pnl > 0]
    losses = [t.pnl for t in trades if t.pnl <= 0]
    rets = eq.pct_change().dropna()
    bars_per_year = 365 * 86400 / RESOLUTION_SECONDS.get(resolution, 300)
    sharpe = float(rets.mean() / rets.std() * math.sqrt(bars_per_year)) if len(rets) > 1 and rets.std() > 0 else 0.0
    max_dd = float(((eq - eq.cummax()) / eq.cummax()).min() * 100) if len(eq) else 0.0
    buy_hold = float((data["close"].iloc[-1] / data["open"].iloc[0] - 1) * 100) if len(data) else 0.0
    return {
        "start_equity": float(start_equity),
        "end_equity": round(float(eq.iloc[-1]), 2) if len(eq) else float(start_equity),
        "return_pct": round(float((eq.iloc[-1] / start_equity - 1) * 100), 2) if len(eq) else 0.0,
        "buy_hold_pct": round(buy_hold, 2),
        "trades": len(trades),
        "win_rate_pct": round(float(len(wins) / len(trades) * 100), 1) if trades else 0.0,
        "profit_factor": round(float(sum(wins) / abs(sum(losses))), 2) if losses and sum(losses) != 0 else None,
        "avg_r": round(float(sum(t.r_multiple for t in trades) / len(trades)), 2) if trades else 0.0,
        "max_drawdown_pct": round(float(max_dd), 2),
        "sharpe": round(float(sharpe), 2),
        "period": f"{data.index[0]} -> {data.index[-1]}" if len(data) else "N/A",
    }
