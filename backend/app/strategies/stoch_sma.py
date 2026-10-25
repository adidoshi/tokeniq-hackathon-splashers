"""Stochasticate Momentum 66: 66 SMA Trend + Stochastic (14, 2, 3) 20/60 Levels + 4-Bar Swing Extreme SL.

Authoritative Rules (from Pine Script / Python Colab):
1. Long Entry:
   - 66 Simple Moving Average is strictly rising over ma_trend_bars (Pine v4 rising(sma(close, 66), 10)).
   - Stochastic %K (lookback 14, smoothing 2) crosses above 20 from below (k[1] <= 20 and k > 20).
   - Trigger candle is green (close > open).
   - Stop Loss is placed at the lowest low of the last 4 bars (lowest_stopbars).
   - Take Profit is placed at 1:2 Risk/Reward target (2.0 * stop distance).
   - Fills at the next candle open with exchange bracket orders.

2. Short Entry:
   - 66 Simple Moving Average is strictly falling over ma_trend_bars (Pine v4 falling(sma(close, 66), 10)).
   - Stochastic %K crosses below 60 from above (k[1] >= 60 and k < 60).
   - Trigger candle is red (close < open).
   - Stop Loss is placed at the highest high of the last 4 bars (highest_stopbars).
   - Take Profit is placed at 1:2 Risk/Reward target (2.0 * stop distance).
   - Fills at the next candle open with exchange bracket orders.

3. Discretionary Exit:
   - Long exits early if 66 SMA flips to falling.
   - Short exits early if 66 SMA flips to rising.
"""
from typing import Any
import pandas as pd

from app.indicators import sma, stochastic
from app.strategies.base import Side, Signal, Strategy

DEFAULTS = {
    "sma_period": 100,
    "ma_trend_bars": 10,
    "k_period": 16,
    "smooth_k": 2,
    "d_period": 3,
    "level_high": 60.0,
    "level_low": 20.0,
    "stopbars": 4,
    "rr_ratio": 2.0,
    "min_sl_pct": 0.0010,  # 0.10% safety floor if candle body/wick is tiny
    "exit_on_trend_flip": False,  # False preserves full 1:2 R:R bracket targets; True exits on MA flip
}


class StochasticSMAStrategy(Strategy):
    name = "stoch_sma_66"
    display_name = "Strategy Guide"
    summary = "100 SMA direction + Stochastic (16, 2) 20/60 levels, 4-bar swing SL, 1:2 R:R bracket"
    live_enabled = True
    defaults = DEFAULTS
    warmup = 130  # 100 SMA + 10 trend bars + 16 Stoch + 4 stopbars

    def __init__(self, **params):
        super().__init__(**params)
        sma_p = int(self.params.get("sma_period", 100))
        trend_b = int(self.params.get("ma_trend_bars", 10))
        k_p = int(self.params.get("k_period", 16))
        self.warmup = max(130, sma_p + trend_b + k_p + 5)

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        p = self.params
        out = df.copy()
        sma_val = sma(out["close"], p["sma_period"])
        out["sma_100"] = sma_val
        out["sma_66"] = sma_val  # alias for backward compatibility
        k, d = stochastic(out, p["k_period"], p["d_period"], p["smooth_k"])
        out["stoch_k"] = k
        out["stoch_d"] = d
        out["lowest_stopbars"] = out["low"].rolling(window=p["stopbars"]).min()
        out["highest_stopbars"] = out["high"].rolling(window=p["stopbars"]).max()
        diff = sma_val.diff()
        tb = p["ma_trend_bars"]
        out["ma_rising"] = (diff > 0).rolling(window=tb).sum() == tb
        out["ma_falling"] = (diff < 0).rolling(window=tb).sum() == tb
        return out

    def signal(self, df: pd.DataFrame, i: int) -> Signal:
        p = self.params
        if i < self.warmup or i < 1:
            return Signal(Side.FLAT, f"warming up indicators (needs {self.warmup} bars for SMA/Stoch)")

        row = df.iloc[i]
        prev_row = df.iloc[i - 1]

        sma_now_val = row.get("sma_100", row.get("sma_66"))
        sma_prev_val = prev_row.get("sma_100", prev_row.get("sma_66"))

        if (
            pd.isna(sma_now_val)
            or pd.isna(row.get("stoch_k"))
            or pd.isna(sma_prev_val)
            or pd.isna(prev_row.get("stoch_k"))
        ):
            return Signal(Side.FLAT, "warming up indicators (insufficient history for SMA/Stoch)")

        sma_now = float(sma_now_val)
        sma_prev = float(sma_prev_val)
        stoch_now = float(row["stoch_k"])
        stoch_prev = float(prev_row["stoch_k"])
        stoch_d = float(row["stoch_d"])

        close = float(row["close"])
        open_ = float(row["open"])

        is_rising = bool(row["ma_rising"])
        is_falling = bool(row["ma_falling"])
        is_green = close > open_
        is_red = close < open_

        lvl_high = float(p["level_high"])
        lvl_low = float(p["level_low"])
        rr_ratio = float(p["rr_ratio"])
        min_sl = float(p["min_sl_pct"])

        ind = {
            "sma_100": round(sma_now, 2),
            "sma_66": round(sma_now, 2),
            "sma_period": p["sma_period"],
            "sma_trend": "RISING" if is_rising else ("FALLING" if is_falling else "FLAT"),
            "stoch_k": round(stoch_now, 2),
            "stoch_d": round(stoch_d, 2),
            "stoch_prev": round(stoch_prev, 2),
            "close": round(close, 2),
            "candle_type": "GREEN" if is_green else ("RED" if is_red else "DOJI"),
            "rr_ratio": rr_ratio,
        }

        # Long Signal Check:
        # 1. 100 SMA strictly rising over ma_trend_bars
        # 2. Stoch %K crossed above level_low (20) from below
        # 3. Trigger candle is green (close > open)
        bullish_cross = (stoch_prev <= lvl_low) and (stoch_now > lvl_low)
        if is_rising and bullish_cross and is_green:
            lowest_stop = float(row["lowest_stopbars"]) if pd.notna(row["lowest_stopbars"]) else float(row["low"])
            raw_stop = close - lowest_stop
            stop_distance = max(raw_stop, close * min_sl)
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
                    f"{p['sma_period']} SMA rising ({p['ma_trend_bars']}b) + Stoch %K crossed above {lvl_low:.0f} ({stoch_prev:.1f} -> {stoch_now:.1f}) "
                    f"on green candle (SL @ {p['stopbars']}-bar low ${stop_price:,.1f}, 1:{rr_ratio:.0f} TP @ ${tp_price:,.1f})"
                ),
                price=close,
                stop_distance=stop_distance,
                take_profit_distance=tp_distance,
                trail_distance=0.0,
                indicators=ind,
            )

        # Short Signal Check:
        # 1. 100 SMA strictly falling over ma_trend_bars
        # 2. Stoch %K crossed below level_high (60) from above
        # 3. Trigger candle is red (close < open)
        bearish_cross = (stoch_prev >= lvl_high) and (stoch_now < lvl_high)
        if is_falling and bearish_cross and is_red:
            highest_stop = float(row["highest_stopbars"]) if pd.notna(row["highest_stopbars"]) else float(row["high"])
            raw_stop = highest_stop - close
            stop_distance = max(raw_stop, close * min_sl)
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
                    f"{p['sma_period']} SMA falling ({p['ma_trend_bars']}b) + Stoch %K crossed below {lvl_high:.0f} ({stoch_prev:.1f} -> {stoch_now:.1f}) "
                    f"on red candle (SL @ {p['stopbars']}-bar high ${stop_price:,.1f}, 1:{rr_ratio:.0f} TP @ ${tp_price:,.1f})"
                ),
                price=close,
                stop_distance=stop_distance,
                take_profit_distance=tp_distance,
                trail_distance=0.0,
                indicators=ind,
            )

        # Awaiting setup / standing aside
        if is_rising:
            state_desc = f"{p['sma_period']} SMA rising ({p['ma_trend_bars']}b uptrend) - Stoch %K: {stoch_now:.1f} (waiting for cross above {lvl_low:.0f})"
        elif is_falling:
            state_desc = f"{p['sma_period']} SMA falling ({p['ma_trend_bars']}b downtrend) - Stoch %K: {stoch_now:.1f} (waiting for cross below {lvl_high:.0f})"
        else:
            state_desc = f"{p['sma_period']} SMA consolidating - Stoch %K: {stoch_now:.1f}"

        return Signal(Side.FLAT, state_desc, price=close, indicators=ind)

    def should_exit(self, df: pd.DataFrame, i: int, side: Side) -> str | None:
        if not bool(self.params.get("exit_on_trend_flip", False)):
            return None
        if i < 1:
            return None
        row = df.iloc[i]
        sma_p = self.params.get("sma_period", 100)
        if side == Side.LONG and bool(row.get("ma_falling", False)):
            return f"{sma_p} SMA trend reversed to falling"
        if side == Side.SHORT and bool(row.get("ma_rising", False)):
            return f"{sma_p} SMA trend reversed to rising"
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
        sma_p = p.get("sma_period", 100)
        row = df.iloc[i]
        prev_row = df.iloc[i - 1]
        sma_now = float(row.get("sma_100", row.get("sma_66", 0.0)))
        stoch_now = float(row["stoch_k"])
        stoch_prev = float(prev_row["stoch_k"])
        close = float(row["close"])
        open_ = float(row["open"])

        is_rising = bool(row["ma_rising"])
        is_falling = bool(row["ma_falling"])
        is_green = close > open_
        is_red = close < open_

        lvl_high = float(p["level_high"])
        lvl_low = float(p["level_low"])

        bull_cross = (stoch_prev <= lvl_low) and (stoch_now > lvl_low)
        bear_cross = (stoch_prev >= lvl_high) and (stoch_now < lvl_high)

        trend_met = is_rising or is_falling
        cross_met = bull_cross or bear_cross
        color_met = (is_rising and is_green) or (is_falling and is_red)
        low_stop = float(row["lowest_stopbars"]) if pd.notna(row["lowest_stopbars"]) else float(row["low"])
        high_stop = float(row["highest_stopbars"]) if pd.notna(row["highest_stopbars"]) else float(row["high"])

        return [
            {
                "id": "sma_trend",
                "title": f"{sma_p} SMA Trend Filter ({p['ma_trend_bars']} bars)",
                "condition": f"{sma_p} SMA is strictly rising for longs, or falling for shorts over {p['ma_trend_bars']} bars",
                "met": trend_met,
                "value": f"SMA({sma_p}): ${sma_now:,.1f} ({'Rising (+)' if is_rising else ('Falling (-)' if is_falling else 'Consolidating')})",
            },
            {
                "id": "stoch_reversal",
                "title": f"Stochastic ({p['k_period']}, {p['smooth_k']}) Level Cross ({lvl_low:.0f} / {lvl_high:.0f})",
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
                "id": "swing_sl",
                "title": f"{p['stopbars']}-Bar Swing Extreme SL Boundary",
                "condition": f"SL anchored at {p['stopbars']}-bar low (Long) or {p['stopbars']}-bar high (Short)",
                "met": True,
                "value": f"Low: ${low_stop:,.1f} | High: ${high_stop:,.1f}",
            },
            {
                "id": "target_rr",
                "title": f"1:{p['rr_ratio']:.0f} Risk / Reward Target Bracket",
                "condition": f"Target mathematically placed at {p['rr_ratio']:.1f}x stop distance on Delta",
                "met": True,
                "value": f"1:{p['rr_ratio']:.0f} Ratio (Exchange Bracket Order)",
            },
        ]
