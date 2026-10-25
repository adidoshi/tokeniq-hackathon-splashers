"""66 SMA Trend + Stochastic (14, 3) Momentum Strategy with 1:2 Risk/Reward Target.

Rules:
1. Long Signal:
   - 66 Simple Moving Average is rising (SMA_66[i] > SMA_66[i-1]).
   - Stochastic %K crosses above 35 from below (was <= 35, now > 35).
   - Trigger candle is green (close > open).
   - Stop Loss is set at the low of the trigger candle wick.
   - Take Profit is set at 1:2 Risk/Reward target (2.0 * stop distance).
   - Executed on candle close / filled at next candle open.

2. Short Signal:
   - 66 Simple Moving Average is falling (SMA_66[i] < SMA_66[i-1]).
   - Stochastic %K crosses below 75 from above (was >= 75, now < 75).
   - Trigger candle is red (close < open).
   - Stop Loss is set at the high of the trigger candle wick.
   - Take Profit is set at 1:2 Risk/Reward target (2.0 * stop distance).
   - Executed on candle close / filled at next candle open.

3. Discretionary Exit:
   - Long exits early if 66 SMA flips from rising to falling.
   - Short exits early if 66 SMA flips from falling to rising.
"""
from typing import Any
import pandas as pd

from app.indicators import sma, stochastic
from app.strategies.base import Side, Signal, Strategy

DEFAULTS = {
    "sma_period": 66,
    "k_period": 14,
    "d_period": 3,
    "smooth_k": 3,
    "level_high": 75.0,
    "level_low": 35.0,
    "rr_ratio": 2.0,
    "min_sl_pct": 0.0010,  # 0.10% safety floor if candle body/wick is tiny
}


class StochasticSMAStrategy(Strategy):
    name = "stoch_sma_66"
    display_name = "66 SMA + Stochastic momentum"
    summary = "66 SMA direction + Stochastic 14/3 crossing 35/75, stop at the trigger candle, 1:2 target"
    live_enabled = False  # backtest evidence only: loses out of sample on every timeframe
    defaults = DEFAULTS
    warmup = 75  # 66 bars for SMA + rolling slope and stochastic lookback

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        p = self.params
        out = df.copy()
        out["sma_66"] = sma(out["close"], p["sma_period"])
        k, d = stochastic(out, p["k_period"], p["d_period"], p["smooth_k"])
        out["stoch_k"] = k
        out["stoch_d"] = d
        return out

    def signal(self, df: pd.DataFrame, i: int) -> Signal:
        p = self.params
        if i < self.warmup or i < 1:
            return Signal(Side.FLAT, "warming up indicators (needs 66 SMA + Stoch)")

        row = df.iloc[i]
        prev_row = df.iloc[i - 1]

        sma_now = float(row["sma_66"])
        sma_prev = float(prev_row["sma_66"])
        stoch_now = float(row["stoch_k"])
        stoch_prev = float(prev_row["stoch_k"])
        stoch_d = float(row["stoch_d"])

        close = float(row["close"])
        open_ = float(row["open"])
        high = float(row["high"])
        low = float(row["low"])

        is_rising = sma_now > sma_prev
        is_falling = sma_now < sma_prev
        is_green = close > open_
        is_red = close < open_

        lvl_high = float(p["level_high"])
        lvl_low = float(p["level_low"])
        rr_ratio = float(p["rr_ratio"])
        min_sl = float(p["min_sl_pct"])

        ind = {
            "sma_66": round(sma_now, 2),
            "sma_66_prev": round(sma_prev, 2),
            "sma_trend": "RISING" if is_rising else ("FALLING" if is_falling else "FLAT"),
            "stoch_k": round(stoch_now, 2),
            "stoch_d": round(stoch_d, 2),
            "stoch_prev": round(stoch_prev, 2),
            "close": round(close, 2),
            "candle_type": "GREEN" if is_green else ("RED" if is_red else "DOJI"),
            "rr_ratio": rr_ratio,
        }

        # Long Signal Check:
        # 1. 66 SMA rising
        # 2. Stoch %K crossed above 35 from below
        # 3. Trigger candle is green
        bullish_cross = (stoch_prev <= lvl_low) and (stoch_now > lvl_low)
        if is_rising and bullish_cross and is_green:
            stop_distance = max(close - low, close * min_sl)
            tp_distance = stop_distance * rr_ratio
            stop_price = close - stop_distance
            tp_price = close + tp_distance

            ind["sl_price"] = round(stop_price, 2)
            ind["tp_price"] = round(tp_price, 2)
            ind["stop_distance"] = round(stop_distance, 2)
            ind["tp_distance"] = round(tp_distance, 2)

            return Signal(
                side=Side.LONG,
                reason=(
                    f"66 SMA rising + Stoch %K crossed above {lvl_low:.0f} ({stoch_prev:.1f} -> {stoch_now:.1f}) "
                    f"on green candle (SL @ wick low ${stop_price:,.1f}, 1:{rr_ratio:.0f} TP @ ${tp_price:,.1f})"
                ),
                price=close,
                stop_distance=stop_distance,
                take_profit_distance=tp_distance,
                trail_distance=0.0,
                indicators=ind,
            )

        # Short Signal Check:
        # 1. 66 SMA falling
        # 2. Stoch %K crossed below 75 from above
        # 3. Trigger candle is red
        bearish_cross = (stoch_prev >= lvl_high) and (stoch_now < lvl_high)
        if is_falling and bearish_cross and is_red:
            stop_distance = max(high - close, close * min_sl)
            tp_distance = stop_distance * rr_ratio
            stop_price = close + stop_distance
            tp_price = close - tp_distance

            ind["sl_price"] = round(stop_price, 2)
            ind["tp_price"] = round(tp_price, 2)
            ind["stop_distance"] = round(stop_distance, 2)
            ind["tp_distance"] = round(tp_distance, 2)

            return Signal(
                side=Side.SHORT,
                reason=(
                    f"66 SMA falling + Stoch %K crossed below {lvl_high:.0f} ({stoch_prev:.1f} -> {stoch_now:.1f}) "
                    f"on red candle (SL @ wick high ${stop_price:,.1f}, 1:{rr_ratio:.0f} TP @ ${tp_price:,.1f})"
                ),
                price=close,
                stop_distance=stop_distance,
                take_profit_distance=tp_distance,
                trail_distance=0.0,
                indicators=ind,
            )

        # Awaiting setup / standing aside
        if is_rising:
            state_desc = f"66 SMA rising (uptrend) - Stoch %K: {stoch_now:.1f} (waiting for <= {lvl_low:.0f} bounce)"
        elif is_falling:
            state_desc = f"66 SMA falling (downtrend) - Stoch %K: {stoch_now:.1f} (waiting for >= {lvl_high:.0f} pullback)"
        else:
            state_desc = f"66 SMA flat - Stoch %K: {stoch_now:.1f}"

        return Signal(Side.FLAT, state_desc, price=close, indicators=ind)

    def should_exit(self, df: pd.DataFrame, i: int, side: Side) -> str | None:
        if i < 1:
            return None
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]
        sma_now = float(row["sma_66"])
        sma_prev = float(prev_row["sma_66"])

        if side == Side.LONG and sma_now < sma_prev:
            return "66 SMA direction reversed to falling"
        if side == Side.SHORT and sma_now > sma_prev:
            return "66 SMA direction reversed to rising"
        return None

    def get_checklist(self, df: pd.DataFrame, i: int) -> list[dict[str, Any]]:
        if i < 1 or len(df) < self.warmup:
            return [
                {
                    "id": "warmup",
                    "title": "Indicator Warmup",
                    "condition": f"Accumulate at least {self.warmup} closed candles",
                    "met": False,
                    "value": f"{len(df)} / {self.warmup} bars",
                }
            ]

        p = self.params
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]
        sma_now = float(row["sma_66"])
        sma_prev = float(prev_row["sma_66"])
        stoch_now = float(row["stoch_k"])
        stoch_prev = float(prev_row["stoch_k"])
        close = float(row["close"])
        open_ = float(row["open"])

        is_rising = sma_now > sma_prev
        is_falling = sma_now < sma_prev
        is_green = close > open_
        is_red = close < open_

        lvl_high = float(p["level_high"])
        lvl_low = float(p["level_low"])

        bull_cross = (stoch_prev <= lvl_low) and (stoch_now > lvl_low)
        bear_cross = (stoch_prev >= lvl_high) and (stoch_now < lvl_high)

        trend_met = is_rising or is_falling
        cross_met = bull_cross or bear_cross
        color_met = (is_rising and is_green) or (is_falling and is_red)

        return [
            {
                "id": "sma_66_trend",
                "title": "66 SMA Trend Filter",
                "condition": "66 SMA is rising for longs, or falling for shorts",
                "met": trend_met,
                "value": f"SMA(66): ${sma_now:,.1f} ({'Rising (+)' if is_rising else ('Falling (-)' if is_falling else 'Flat')})",
            },
            {
                "id": "stoch_reversal",
                "title": f"Stochastic 14/3 Reversal ({lvl_low:.0f} / {lvl_high:.0f})",
                "condition": f"Cross above {lvl_low:.0f} for Long or below {lvl_high:.0f} for Short",
                "met": cross_met,
                "is_signal_bar": cross_met,
                "value": f"Stoch %K: {stoch_now:.1f} (prev: {stoch_prev:.1f})",
            },
            {
                "id": "candle_color",
                "title": "Trigger Candle Color Confirmation",
                "condition": "Green candle for Long breakout, Red candle for Short breakdown",
                "met": color_met,
                "value": f"Candle: {'Green (Close > Open)' if is_green else ('Red (Close < Open)' if is_red else 'Doji')}",
            },
            {
                "id": "wick_sl",
                "title": "Wick-Based Stop Loss Boundary",
                "condition": "SL placed at candle low wick (Long) or high wick (Short)",
                "met": True,
                "value": f"Low Wick: ${float(row['low']):,.1f} | High Wick: ${float(row['high']):,.1f}",
            },
            {
                "id": "target_rr",
                "title": "1:2 Risk / Reward Target",
                "condition": f"Target mathematically placed at {p['rr_ratio']:.1f}x stop distance",
                "met": True,
                "value": "1:2 Ratio (Exchange Bracket Order)",
            },
        ]

