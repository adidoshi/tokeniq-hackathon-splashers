"""SMA Crossover Strategy (5 SMA & 15 SMA) with 0.20% Stop-Loss and 1:2 Risk/Reward Target.

Rules:
1. Long Signal:
   - 5 SMA crosses 15 SMA from below to above (lower to upper side).
   - Candle close price is strictly above the 15 SMA.
   - Stop Loss is set at exactly 0.20% below entry price.
   - Take Profit is set with a 1:2 Risk/Reward target (0.40% above entry price).
   - Executed immediately on next candle when candle closes.

2. Short Signal:
   - 5 SMA crosses 15 SMA from above to below (upper to lower side).
   - Candle close price is strictly below the 15 SMA.
   - Stop Loss is set at exactly 0.20% above entry price.
   - Take Profit is set with a 1:2 Risk/Reward target (0.40% below entry price).
   - Executed immediately on next candle when candle closes.

3. Discretionary Exit:
   - Long exits early if 5 SMA crosses back below 15 SMA.
   - Short exits early if 5 SMA crosses back above 15 SMA.
"""
from typing import Any
import pandas as pd

from app.indicators import sma
from app.strategies.base import Side, Signal, Strategy

DEFAULTS = {
    "fast": 5,
    "slow": 15,
    "sl_pct": 0.0020,  # 0.20% Stop Loss
    "rr_ratio": 2.0,   # 1:2 Risk/Reward ratio (0.40% TP)
}


class SMACrossoverStrategy(Strategy):
    name = "sma_cross_5_15"
    display_name = "5/15 SMA crossover"
    summary = "5 SMA crosses 15 SMA, fixed 0.20% stop, 1:2 target"
    live_enabled = False  # backtest evidence only: loses out of sample (no regime filter)
    defaults = DEFAULTS
    warmup = 20  # only 20 bars needed for 15 SMA

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        p = self.params
        out = df.copy()
        out["sma_fast"] = sma(out["close"], p["fast"])
        out["sma_slow"] = sma(out["close"], p["slow"])
        return out

    def signal(self, df: pd.DataFrame, i: int) -> Signal:
        p = self.params
        if i < self.warmup or i < 1:
            return Signal(Side.FLAT, "warming up indicators")

        row = df.iloc[i]
        prev_row = df.iloc[i - 1]

        sma_fast_now = float(row["sma_fast"])
        sma_fast_prev = float(prev_row["sma_fast"])
        sma_slow_now = float(row["sma_slow"])
        sma_slow_prev = float(prev_row["sma_slow"])
        close = float(row["close"])

        stop_distance = close * p["sl_pct"]
        tp_distance = stop_distance * p["rr_ratio"]

        ind = {
            "sma_fast": round(sma_fast_now, 2),
            "sma_slow": round(sma_slow_now, 2),
            "close": round(close, 2),
            "sl_pct": f"{p['sl_pct'] * 100:.2f}%",
            "sl_distance": round(stop_distance, 2),
            "tp_distance": round(tp_distance, 2),
            "rr_ratio": p["rr_ratio"],
        }

        # Long crossover check: 5 SMA crosses above 15 SMA AND close > 15 SMA
        bullish_cross = (sma_fast_now > sma_slow_now) and (sma_fast_prev <= sma_slow_prev)
        price_above_slow = close > sma_slow_now

        if bullish_cross and price_above_slow:
            stop_price = close - stop_distance
            tp_price = close + tp_distance
            return Signal(
                side=Side.LONG,
                reason=f"5 SMA crossed above 15 SMA & Close > 15 SMA (0.20% SL @ ${stop_price:.1f}, 1:2 TP @ ${tp_price:.1f})",
                price=close,
                stop_distance=stop_distance,
                take_profit_distance=tp_distance,
                trail_distance=0.0,  # fixed 0.20% stop + 1:2 TP target
                indicators=ind,
            )

        # Short crossover check: 5 SMA crosses below 15 SMA AND close < 15 SMA
        bearish_cross = (sma_fast_now < sma_slow_now) and (sma_fast_prev >= sma_slow_prev)
        price_below_slow = close < sma_slow_now

        if bearish_cross and price_below_slow:
            stop_price = close + stop_distance
            tp_price = close - tp_distance
            return Signal(
                side=Side.SHORT,
                reason=f"5 SMA crossed below 15 SMA & Close < 15 SMA (0.20% SL @ ${stop_price:.1f}, 1:2 TP @ ${tp_price:.1f})",
                price=close,
                stop_distance=stop_distance,
                take_profit_distance=tp_distance,
                trail_distance=0.0,
                indicators=ind,
            )

        # Standing aside / awaiting setup
        state_desc = (
            f"Bullish alignment (5 SMA > 15 SMA) - awaiting next cross"
            if sma_fast_now > sma_slow_now
            else f"Bearish alignment (5 SMA < 15 SMA) - awaiting next cross"
        )
        return Signal(Side.FLAT, state_desc, price=close, indicators=ind)

    def should_exit(self, df: pd.DataFrame, i: int, side: Side) -> str | None:
        if i < 1:
            return None
        row = df.iloc[i]
        sma_fast = float(row["sma_fast"])
        sma_slow = float(row["sma_slow"])

        if side == Side.LONG and sma_fast < sma_slow:
            return "Trend reversed: 5 SMA crossed below 15 SMA"
        if side == Side.SHORT and sma_fast > sma_slow:
            return "Trend reversed: 5 SMA crossed above 15 SMA"
        return None

    def get_checklist(self, df: pd.DataFrame, i: int) -> list[dict[str, Any]]:
        """Generates dynamic checkpoint verification list for the strategy."""
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
        fast_now = float(row["sma_fast"])
        fast_prev = float(prev_row["sma_fast"])
        slow_now = float(row["sma_slow"])
        slow_prev = float(prev_row["sma_slow"])
        close = float(row["close"])

        bull_cross = fast_now > slow_now and fast_prev <= slow_prev
        bear_cross = fast_now < slow_now and fast_prev >= slow_prev
        cross_happened = bull_cross or bear_cross

        price_aligned = (bull_cross and close > slow_now) or (bear_cross and close < slow_now) or (fast_now > slow_now and close > slow_now) or (fast_now < slow_now and close < slow_now)
        
        sl_dist = close * p["sl_pct"]
        tp_dist = sl_dist * p["rr_ratio"]

        return [
            {
                "id": "crossover",
                "title": "5 SMA vs 15 SMA Crossover",
                "condition": "5 SMA crosses 15 SMA on candle close",
                "met": cross_happened,
                "is_signal_bar": cross_happened,
                "value": f"SMA(5): ${fast_now:,.1f} | SMA(15): ${slow_now:,.1f} ({'Bullish' if fast_now > slow_now else 'Bearish'})",
            },
            {
                "id": "price_alignment",
                "title": "Price Trend Filter",
                "condition": "Price is above 15 SMA (for Long) or below 15 SMA (for Short)",
                "met": price_aligned,
                "value": f"Close: ${close:,.1f} vs 15 SMA: ${slow_now:,.1f}",
            },
            {
                "id": "fixed_sl",
                "title": "0.20% Stop Loss",
                "condition": "Fixed 0.20% risk boundary from entry",
                "met": True,
                "value": f"SL: 0.20% (${sl_dist:,.1f} distance)",
            },
            {
                "id": "target_rr",
                "title": "1:2 Risk / Reward Target",
                "condition": "Take Profit configured at 2.0x risk distance (0.40%)",
                "met": True,
                "value": f"Target: 0.40% (${tp_dist:,.1f} distance, 1:2 R:R)",
            },
        ]
