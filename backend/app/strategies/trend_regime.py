"""Trend-following with a regime filter.

Thesis (the pitch): crypto trends persist, but EMA crossovers bleed money in chop.
So we only follow the trend when the market is *proven* to be trending (ADX), and we
stand aside during volatility shocks (ATR far above normal). Stops scale with
volatility (ATR) so risk per trade is constant regardless of market conditions.

  trend state LONG  : EMA_fast > EMA_slow and close > EMA_fast and ADX > threshold
  trend state SHORT : EMA_fast < EMA_slow and close < EMA_fast and ADX > threshold
  entry_mode "fresh": enter only on the bar the state turns on (don't chase extended moves)
  entry_mode "state": enter whenever the state is on
  exits: stop = sl_atr x ATR, or a trailing stop of trail_atr x ATR (replaces sl_atr, exactly
         how Delta's bracket_trail_amount works); optional fixed target tp_atr x ATR;
         and exit when the EMAs cross back (trend over).
Defaults = variant v3 from scripts/compare.py (fresh entry + 3 ATR trailing stop, no target).
"""
import pandas as pd

from app.indicators import adx, atr, ema
from app.strategies.base import Side, Signal, Strategy

DEFAULTS = dict(fast=20, slow=50, adx_period=14, adx_threshold=20.0, atr_period=14,
                sl_atr=1.5, tp_atr=0.0, trail_atr=3.0, shock_mult=3.0, entry_mode="fresh")


class TrendRegimeStrategy(Strategy):
    name = "trend_regime"
    display_name = "Trend regime follower"
    summary = "EMA 20/50 trend, only when ADX > 20, no trades in volatility shocks, 3x ATR trailing stop"
    live_enabled = True  # the only strategy near breakeven out of sample
    defaults = DEFAULTS
    choices = {"entry_mode": ("fresh", "state")}
    warmup = 100

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        p = self.params
        out = df.copy()
        out["ema_fast"] = ema(out["close"], p["fast"])
        out["ema_slow"] = ema(out["close"], p["slow"])
        out["adx"] = adx(out, p["adx_period"])
        out["atr"] = atr(out, p["atr_period"])
        out["atr_median"] = out["atr"].rolling(100, min_periods=20).median()
        return out

    def _state(self, row: pd.Series) -> tuple[Side, str]:
        p = self.params
        if row["atr"] > p["shock_mult"] * row["atr_median"]:
            return Side.FLAT, f"volatility shock: ATR {row['atr']:.0f} > {p['shock_mult']}x normal"
        if row["adx"] < p["adx_threshold"]:
            return Side.FLAT, f"no trend: ADX {row['adx']:.1f} < {p['adx_threshold']}"
        if row["ema_fast"] > row["ema_slow"] and row["close"] > row["ema_fast"]:
            return Side.LONG, f"uptrend: EMA{p['fast']}>EMA{p['slow']}, ADX {row['adx']:.1f}"
        if row["ema_fast"] < row["ema_slow"] and row["close"] < row["ema_fast"]:
            return Side.SHORT, f"downtrend: EMA{p['fast']}<EMA{p['slow']}, ADX {row['adx']:.1f}"
        return Side.FLAT, "trend unconfirmed: price between EMAs"

    def signal(self, df: pd.DataFrame, i: int) -> Signal:
        p = self.params
        row = df.iloc[i]
        ind = {k: round(float(row[k]), 2) for k in ("ema_fast", "ema_slow", "adx", "atr")}
        trail = p["trail_atr"] * row["atr"]
        base = dict(price=float(row["close"]), stop_distance=trail or p["sl_atr"] * row["atr"],
                    take_profit_distance=p["tp_atr"] * row["atr"], trail_distance=trail, indicators=ind)

        if i < self.warmup:
            return Signal(Side.FLAT, "warming up", **base)
        side, reason = self._state(row)
        if side != Side.FLAT and p["entry_mode"] == "fresh":
            prev_side, _ = self._state(df.iloc[i - 1])
            if prev_side == side:
                return Signal(Side.FLAT, f"in {side.value} trend, waiting for fresh entry", **base)
            reason = "fresh " + reason
        return Signal(side, reason, **base)

    def should_exit(self, df: pd.DataFrame, i: int, side: Side) -> str | None:
        row = df.iloc[i]
        if side == Side.LONG and row["ema_fast"] < row["ema_slow"]:
            return "trend over: EMAs crossed down"
        if side == Side.SHORT and row["ema_fast"] > row["ema_slow"]:
            return "trend over: EMAs crossed up"
        return None

    def get_checklist(self, df: pd.DataFrame, i: int) -> list[dict]:
        p = self.params
        if i < 1 or len(df) < self.warmup:
            return [{"id": "warmup", "title": "Warmup", "condition": f"{self.warmup} bars needed", "met": False, "value": f"{len(df)} bars"}]
        row = df.iloc[i]
        fast = float(row["ema_fast"])
        slow = float(row["ema_slow"])
        close = float(row["close"])
        adx_val = float(row["adx"])
        atr_val = float(row["atr"])
        atr_med = float(row["atr_median"])
        shock = atr_val > p["shock_mult"] * atr_med
        trend_on = adx_val >= p["adx_threshold"]
        ema_aligned = (fast > slow and close > fast) or (fast < slow and close < fast)

        return [
            {
                "id": "adx_trend",
                "title": "ADX Trend Strength",
                "condition": f"ADX >= {p['adx_threshold']:.0f}",
                "met": trend_on,
                "value": f"ADX: {adx_val:.1f}",
            },
            {
                "id": "ema_alignment",
                "title": "EMA 20/50 Alignment",
                "condition": "Price and EMA20 aligned with EMA50",
                "met": ema_aligned,
                "value": f"EMA20: ${fast:,.1f} | EMA50: ${slow:,.1f}",
            },
            {
                "id": "volatility_filter",
                "title": "Volatility Shock Filter",
                "condition": f"ATR <= {p['shock_mult']}x Median ATR",
                "met": not shock,
                "value": f"ATR: ${atr_val:.1f} (Median: ${atr_med:.1f})",
            },
            {
                "id": "atr_protection",
                "title": "ATR Volatility Stop",
                "condition": f"Trailing stop {p['trail_atr']}x ATR",
                "met": True,
                "value": f"Stop Distance: ${p['trail_atr'] * atr_val:,.1f}",
            },
        ]
