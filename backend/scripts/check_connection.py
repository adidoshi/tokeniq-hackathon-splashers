"""Day-1 milestone script: verify public + private Delta testnet access end to end.

uv run python -m scripts.check_connection            # public data + balances (if keys set)
uv run python -m scripts.check_connection --order    # also place & cancel a far-away limit order
"""
import asyncio
import sys
import time

from app.config import get_settings
from app.delta.client import DeltaClient


async def main(test_order: bool) -> None:
    s = get_settings()
    c = DeltaClient(s.delta_base_url, s.delta_api_key, s.delta_api_secret)
    try:
        print(f"Clock offset: {await c.sync_clock():+.1f}s")
        product = await c.get_product(s.symbol)
        pid = product["id"]
        print(f"{s.symbol}: product_id={pid} contract_value={product['contract_value']} tick={product['tick_size']}")
        t = await c.get_ticker(s.symbol)
        print(f"Mark price: {t['mark_price']}")
        now = int(time.time())
        candles = await c.get_candles(s.symbol, s.resolution, now - 3600 * 6, now)
        print(f"Candles ({s.resolution}): {len(candles)}, last close={candles[-1]['close']}")

        if not s.has_credentials:
            print("\nNo API keys in backend/.env - skipping private endpoints.")
            return

        for b in await c.get_balances():
            if float(b.get("balance") or 0) > 0:
                print(f"Balance {b['asset_symbol']}: {b['balance']} (available {b['available_balance']})")
        pos = await c.get_position(pid)
        print(f"Position size: {pos.get('size', 0)}")

        if test_order:
            # 20% below market so it can never fill
            price = round(float(t["mark_price"]) * 0.8 / float(product["tick_size"])) * float(product["tick_size"])
            o = await c.place_order(pid, "buy", 1, order_type="limit_order", limit_price=round(price, 1))
            print(f"Placed limit order id={o['id']} @ {o['limit_price']} state={o['state']}")
            await asyncio.sleep(1)
            cancelled = await c.cancel_order(pid, o["id"])
            print(f"Cancelled order id={cancelled['id']} state={cancelled['state']}")
    finally:
        await c.close()


if __name__ == "__main__":
    asyncio.run(main("--order" in sys.argv))
