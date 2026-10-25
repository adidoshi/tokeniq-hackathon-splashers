"""Verify exchange-side protection on testnet: market entry + trailing (or fixed) bracket stop.
Opens 1 contract, prints the stop order Delta created, then ALWAYS flattens.

uv run python -m scripts.test_bracket            # trailing stop, 300 USD trail
uv run python -m scripts.test_bracket --fixed    # fixed stop 300 below + take profit 600 above
"""
import asyncio
import sys

from app.config import get_settings
from app.delta.client import DeltaClient

KEYS = ("id", "side", "size", "order_type", "stop_order_type", "stop_price", "trail_amount",
        "limit_price", "state", "reduce_only", "bracket_order")


async def main(fixed: bool) -> None:
    s = get_settings()
    c = DeltaClient(s.delta_base_url, s.delta_api_key, s.delta_api_secret)
    await c.sync_clock()
    pid = (await c.get_product(s.symbol))["id"]
    try:
        mark = float((await c.get_ticker(s.symbol))["mark_price"])
        if fixed:
            o = await c.place_order(pid, "buy", 1, stop_loss=round(mark - 300, 1), take_profit=round(mark + 600, 1))
        else:
            o = await c.place_order(pid, "buy", 1, trail_amount=300)
        print(f"Entry order {o['id']} state={o['state']} avg_fill={o.get('average_fill_price')}")
        await asyncio.sleep(2)
        pos = await c.get_position(pid)
        print(f"Position size={pos.get('size')} entry={pos.get('entry_price')}  (mark {mark:.1f})")
        for od in await c.get_open_orders(pid):
            print("  open:", {k: od.get(k) for k in KEYS})
    finally:
        await c.cancel_all_orders(pid)
        closed = await c.close_position(pid)
        print("Flattened." if closed else "Already flat.")
        await c.close()


if __name__ == "__main__":
    asyncio.run(main("--fixed" in sys.argv))
