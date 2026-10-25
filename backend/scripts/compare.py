"""Compare strategy variants in-sample (first 70%) vs out-of-sample (last 30%).

A variant only counts if it holds up on data it was NOT chosen on.
uv run python -m scripts.compare --resolution 1h --days 365
"""
import argparse
import asyncio

from app.backtest import fetch_history, run_backtest
from app.config import get_settings
from app.delta.client import DeltaClient
from app.risk import RiskManager
from app.strategies import TrendRegimeStrategy

VARIANTS = {
    "v0 state + 2R target":       dict(entry_mode="state", tp_atr=3.0, trail_atr=0.0),
    "v1 fresh + 2R target":       dict(entry_mode="fresh", tp_atr=3.0, trail_atr=0.0),
    "v2 state + trail 3ATR":      dict(entry_mode="state", tp_atr=0.0, trail_atr=3.0),
    "v3 fresh + trail 3ATR":      dict(entry_mode="fresh", tp_atr=0.0, trail_atr=3.0),
    "v4 fresh + trail, ADX25":    dict(entry_mode="fresh", tp_atr=0.0, trail_atr=3.0, adx_threshold=25.0),
    "v5 fresh + trail 2ATR":      dict(entry_mode="fresh", tp_atr=0.0, trail_atr=2.0),
}
COLS = ["return_pct", "buy_hold_pct", "trades", "win_rate_pct", "profit_factor", "avg_r", "max_drawdown_pct"]


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--resolution", default="1h")
    ap.add_argument("--days", type=int, default=365)
    ap.add_argument("--equity", type=float, default=100.0)
    args = ap.parse_args()

    s = get_settings()
    client = DeltaClient("https://api.india.delta.exchange")  # public real-market candles, no keys
    try:
        cv = float((await client.get_product(s.symbol))["contract_value"])
        df = await fetch_history(client, s.symbol, args.resolution, args.days)
    finally:
        await client.close()

    cut = int(len(df) * 0.7)
    warm = TrendRegimeStrategy.warmup
    splits = {"IN ": df.iloc[:cut], "OUT": df.iloc[cut - warm:]}  # OUT gets warmup bars for indicators
    print(f"{s.symbol} {args.resolution}, {len(df)} candles; split at {df.index[cut]}\n")
    print(f"{'variant':<26} {'set':<4} " + " ".join(f"{c[:12]:>12}" for c in COLS))
    for name, params in VARIANTS.items():
        for label, part in splits.items():
            m = run_backtest(part, TrendRegimeStrategy(**params), RiskManager.from_settings(s),
                             args.equity, cv, resolution=args.resolution).metrics
            print(f"{name:<26} {label:<4} " + " ".join(f"{str(m[c]):>12}" for c in COLS))
        print()


if __name__ == "__main__":
    asyncio.run(main())
