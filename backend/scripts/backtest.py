"""Run a backtest on Delta historical candles.

uv run python -m scripts.backtest                                # 30d of 5m BTCUSD from testnet
uv run python -m scripts.backtest --days 60 --resolution 15m --prod   # real-market data (public, no keys)
uv run python -m scripts.backtest --param adx_threshold=25 --param sl_atr=2
"""
import argparse
import asyncio

from app.backtest import fetch_history, run_backtest
from app.config import get_settings
from app.delta.client import DeltaClient
from app.risk import RiskManager
from app.strategies import STRATEGIES

PROD_URL = "https://api.india.delta.exchange"  # public market data only - no keys sent


def parse_params(items: list[str]) -> dict:
    out = {}
    for item in items:
        k, v = item.split("=", 1)
        try:
            out[k] = float(v) if "." in v else int(v)
        except ValueError:
            out[k] = v  # string params, e.g. entry_mode=fresh
    return out


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--strategy", default="trend_regime", choices=list(STRATEGIES))
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--resolution", default=None)
    ap.add_argument("--equity", type=float, default=100.0)
    ap.add_argument("--prod", action="store_true", help="use production public candles (real market)")
    ap.add_argument("--param", action="append", default=[], help="strategy param override key=value")
    args = ap.parse_args()

    s = get_settings()
    resolution = args.resolution or s.resolution
    client = DeltaClient(PROD_URL if args.prod else s.delta_base_url)  # no keys: public endpoints only
    try:
        product = await client.get_product(s.symbol)
        df = await fetch_history(client, s.symbol, resolution, args.days)
    finally:
        await client.close()

    strategy = STRATEGIES[args.strategy](**parse_params(args.param))
    result = run_backtest(df, strategy, RiskManager.from_settings(s), args.equity,
                          float(product["contract_value"]), resolution=resolution)

    print(f"\n{strategy.name} on {s.symbol} {resolution}, {len(df)} candles "
          f"({'prod' if args.prod else 'testnet'}) params={strategy.params}\n")
    for k, v in result.metrics.items():
        print(f"  {k:<18} {v}")
    print("\n  last trades:")
    for t in result.trades[-8:]:
        print(f"   {t.entry_time[:16]} {t.side:<5} x{t.size:<3} {t.entry:>9.1f} -> {t.exit:>9.1f} "
              f"{t.exit_reason:<16} pnl={t.pnl:>7.2f}  R={t.r_multiple:>5}")


if __name__ == "__main__":
    asyncio.run(main())
