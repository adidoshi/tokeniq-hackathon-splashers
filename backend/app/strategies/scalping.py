"""Triple EMA + RSI Momentum & Volume Surge Scalping Strategy.

Rules from scalping_strategy.py:
1. Indicators:
   - EMA 5, EMA 10, EMA 20 on candle close
   - RSI (14 period)
   - Volume SMA (12 period) & Volume Ratio = Volume / Volume SMA(12)

2. Long Signal (BUY):
   - EMA 5 > EMA 10 > EMA 20 (Triple Bullish Stack)
   - RSI < 70 (Room to run; not overbought)
   - Volume Ratio > 1.3 (Breakout volume surge > 130% of 12-bar average)
   - Stop Loss: 0.20% fixed SL below entry
   - Take Profit: 0.30% fixed TP above entry

3. Short Signal (SELL):
   - EMA 5 < EMA 10 < EMA 20 (Triple Bearish Stack)
   - RSI > 30 (Room to drop; not oversold)
   - Volume Ratio > 1.3 (Breakout volume surge > 130% of 12-bar average)
   - Stop Loss: 0.20% fixed SL above entry
   - Take Profit: 0.30% fixed TP below entry

4. Discretionary Exit:
   - Long exits if EMA 5 crosses below EMA 10
   - Short exits if EMA 5 crosses above EMA 10
"""
from typing import Any
import pandas as pd

from app.indicators import ema, rsi, sma
from app.strategies.base import Side, Signal, Strategy

DEFAULTS = {
    "ema_5": 5,
    "ema_10": 10,
    "ema_20": 20,
    "rsi_window": 14,
    "rsi_overbought": 70.0,
    "rsi_oversold": 30.0,
    "volume_window": 12,
    "volume_threshold": 1.3,
    "take_profit_pct": 0.003,  # 0.30% Take Profit
    "stop_loss_pct": 0.002,    # 0.20% Stop Loss
}


class ScalpingStrategy(Strategy):
    name = "scalping_strategy"
    display_name = "Triple EMA + RSI volume scalper"
    summary = "EMA 5/10/20 stack + RSI filter + volume surge, 0.20% stop, 0.30% target"
    live_enabled = False  # backtest evidence only: loses out of sample (fees ~half the 0.20% stop)
    defaults = DEFAULTS
    warmup = 30  # needs at least 20 bars for EMA 20 & 14 for RSI

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Original signature from scalping_strategy.py for direct programmatic access."""
        return self.compute(df)

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        p = self.params
        out = df.copy()
        out["EMA_5"] = ema(out["close"], int(p["ema_5"]))
        out["EMA_10"] = ema(out["close"], int(p["ema_10"]))
        out["EMA_20"] = ema(out["close"], int(p["ema_20"]))
        out["RSI"] = rsi(out["close"], int(p["rsi_window"]))
        vol = out["volume"] if "volume" in out else pd.Series(1.0, index=out.index)
        vol_sma = vol.rolling(int(p["volume_window"])).mean().replace(0, float("nan"))
        out["volume_sma"] = vol_sma
        out["volume_ratio"] = (vol / vol_sma).fillna(1.0).round(2)
        return out

    def analyze(self, df: pd.DataFrame) -> str:
        """Original analyze method from scalping_strategy.py returning BUY / SELL / HOLD."""
        if len(df) < self.warmup:
            return "HOLD"
        computed = self.compute(df) if "EMA_5" not in df.columns else df
        latest = computed.iloc[-1]
        vol_ratio = float(latest.get("volume_ratio", 1.0))
        r_overbought = float(self.params["rsi_overbought"])
        r_oversold = float(self.params["rsi_oversold"])
        vol_thresh = float(self.params["volume_threshold"])

        if (latest["EMA_5"] > latest["EMA_10"] > latest["EMA_20"]) and (latest["RSI"] < r_overbought):
            if vol_ratio > vol_thresh:
                return "BUY"
        elif (latest["EMA_5"] < latest["EMA_10"] < latest["EMA_20"]) and (latest["RSI"] > r_oversold):
            if vol_ratio > vol_thresh:
                return "SELL"
        return "HOLD"

    def signal(self, df: pd.DataFrame, i: int) -> Signal:
        p = self.params
        if i < self.warmup or i < 1:
            return Signal(Side.FLAT, "warming up indicators (needs EMA 20 + RSI 14)")

        row = df.iloc[i]
        close = float(row["close"])
        ema_5 = float(row["EMA_5"])
        ema_10 = float(row["EMA_10"])
        ema_20 = float(row["EMA_20"])
        rsi_val = float(row["RSI"])
        vol_ratio = float(row.get("volume_ratio", 1.0))

        sl_pct = float(p["stop_loss_pct"])
        tp_pct = float(p["take_profit_pct"])
        r_overbought = float(p["rsi_overbought"])
        r_oversold = float(p["rsi_oversold"])
        vol_thresh = float(p["volume_threshold"])

        stop_dist = close * sl_pct
        tp_dist = close * tp_pct

        ind = {
            "close": round(close, 2),
            "ema_5": round(ema_5, 2),
            "ema_10": round(ema_10, 2),
            "ema_20": round(ema_20, 2),
            "rsi": round(rsi_val, 2),
            "volume_ratio": round(vol_ratio, 2),
            "sl_pct": f"{sl_pct * 100:.2f}%",
            "tp_pct": f"{tp_pct * 100:.2f}%",
            "stop_distance": round(stop_dist, 2),
            "tp_distance": round(tp_dist, 2),
        }

        # BUY Signal:
        # EMA_5 > EMA_10 > EMA_20 and RSI < 70 and volume_ratio > 1.3
        if (ema_5 > ema_10 > ema_20) and (rsi_val < r_overbought):
            if vol_ratio > vol_thresh:
                stop_price = close - stop_dist
                tp_price = close + tp_dist
                return Signal(
                    side=Side.LONG,
                    reason=(
                        f"Triple EMA bullish stack (5>10>20) + RSI {rsi_val:.1f} < {r_overbought:.0f} "
                        f"+ Volume Surge {vol_ratio:.2f}x > {vol_thresh:.1f}x "
                        f"(0.20% SL @ ${stop_price:,.1f}, 0.30% TP @ ${tp_price:,.1f})"
                    ),
                    price=close,
                    stop_distance=stop_dist,
                    take_profit_distance=tp_dist,
                    trail_distance=0.0,
                    indicators=ind,
                )

        # SELL Signal:
        # EMA_5 < EMA_10 < EMA_20 and RSI > 30 and volume_ratio > 1.3
        elif (ema_5 < ema_10 < ema_20) and (rsi_val > r_oversold):
            if vol_ratio > vol_thresh:
                stop_price = close + stop_dist
                tp_price = close - tp_dist
                return Signal(
                    side=Side.SHORT,
                    reason=(
                        f"Triple EMA bearish stack (5<10<20) + RSI {rsi_val:.1f} > {r_oversold:.0f} "
                        f"+ Volume Surge {vol_ratio:.2f}x > {vol_thresh:.1f}x "
                        f"(0.20% SL @ ${stop_price:,.1f}, 0.30% TP @ ${tp_price:,.1f})"
                    ),
                    price=close,
                    stop_distance=stop_dist,
                    take_profit_distance=tp_dist,
                    trail_distance=0.0,
                    indicators=ind,
                )

        # Standby / HOLD
        if ema_5 > ema_10 > ema_20:
            bias = "Bullish stack (5>10>20)"
        elif ema_5 < ema_10 < ema_20:
            bias = "Bearish stack (5<10<20)"
        else:
            bias = "Mixed EMA ribbon"

        state_desc = f"{bias} | RSI: {rsi_val:.1f} | Vol Ratio: {vol_ratio:.2f}x (awaiting > {vol_thresh}x surge)"
        return Signal(Side.FLAT, state_desc, price=close, indicators=ind)

    def should_exit(self, df: pd.DataFrame, i: int, side: Side) -> str | None:
        if i < 1:
            return None
        row = df.iloc[i]
        ema_5 = float(row["EMA_5"])
        ema_10 = float(row["EMA_10"])

        if side == Side.LONG and ema_5 < ema_10:
            return "Scalp exit: EMA 5 crossed below EMA 10"
        if side == Side.SHORT and ema_5 > ema_10:
            return "Scalp exit: EMA 5 crossed above EMA 10"
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
        close = float(row["close"])
        ema_5 = float(row["EMA_5"])
        ema_10 = float(row["EMA_10"])
        ema_20 = float(row["EMA_20"])
        rsi_val = float(row["RSI"])
        vol_ratio = float(row.get("volume_ratio", 1.0))

        r_overbought = float(p["rsi_overbought"])
        r_oversold = float(p["rsi_oversold"])
        vol_thresh = float(p["volume_threshold"])

        bull_ribbon = ema_5 > ema_10 > ema_20
        bear_ribbon = ema_5 < ema_10 < ema_20
        ribbon_aligned = bull_ribbon or bear_ribbon

        rsi_filter = (bull_ribbon and rsi_val < r_overbought) or (bear_ribbon and rsi_val > r_oversold)
        vol_surge = vol_ratio > vol_thresh

        all_met = (bull_ribbon and rsi_val < r_overbought and vol_surge) or (
            bear_ribbon and rsi_val > r_oversold and vol_surge
        )

        return [
            {
                "id": "triple_ema",
                "title": "Triple EMA Ribbon Alignment (5 / 10 / 20)",
                "condition": "EMA 5 > EMA 10 > EMA 20 (Bull) or EMA 5 < EMA 10 < EMA 20 (Bear)",
                "met": ribbon_aligned,
                "value": f"EMA5: ${ema_5:,.1f} | EMA10: ${ema_10:,.1f} | EMA20: ${ema_20:,.1f}",
            },
            {
                "id": "rsi_gate",
                "title": f"RSI Boundary Room ({r_oversold:.0f} / {r_overbought:.0f})",
                "condition": f"RSI < {r_overbought:.0f} for Buy, RSI > {r_oversold:.0f} for Sell",
                "met": rsi_filter,
                "value": f"RSI(14): {rsi_val:.1f} ({'Room to run' if rsi_filter else 'Overbought/Oversold extreme'})",
            },
            {
                "id": "volume_surge",
                "title": f"Volume Surge Ratio (> {vol_thresh:.1f}x)",
                "condition": f"Current bar volume > {vol_thresh:.1f}x 12-bar SMA volume",
                "met": vol_surge,
                "is_signal_bar": all_met,
                "value": f"Ratio: {vol_ratio:.2f}x ({'Surge Confirmed' if vol_surge else 'Awaiting Surge'})",
            },
            {
                "id": "fixed_sl",
                "title": f"{p['stop_loss_pct'] * 100:.2f}% Fixed Stop Loss",
                "condition": "Automated exchange bracket order below entry",
                "met": True,
                "value": f"SL: {p['stop_loss_pct'] * 100:.2f}% (${close * p['stop_loss_pct']:,.1f})",
            },
            {
                "id": "fixed_tp",
                "title": f"{p['take_profit_pct'] * 100:.2f}% Fixed Take Profit",
                "condition": "Automated exchange bracket order above entry",
                "met": True,
                "value": f"TP: {p['take_profit_pct'] * 100:.2f}% (${close * p['take_profit_pct']:,.1f})",
            },
        ]
