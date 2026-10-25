"""Engine tests against a fake exchange: no network, deterministic."""
import time

import numpy as np
import pytest

from app.config import Settings
from app.engine import Engine
from app.store import Store
from app.strategies import Side, Signal, TrendRegimeStrategy


class FakeDelta:
    def __init__(self, closes: np.ndarray):
        now = int(time.time()) // 3600 * 3600
        n = len(closes)
        self.candles = [{"time": now - (n - 1 - i) * 3600, "open": float(c) - 5, "high": float(c) + 20,
                         "low": float(c) - 20, "close": float(c), "volume": 1.0} for i, c in enumerate(closes)]
        self.position = {"size": 0, "entry_price": "0"}
        self.orders: list[dict] = []
        self.clock_offset = 0.0
        self.placed: list[dict] = []
        self.stops: list[dict] = []
        self.cancelled = 0

    async def get_product(self, symbol):
        return {"id": 84, "symbol": symbol, "contract_value": "0.001", "tick_size": "0.1",
                "settling_asset": {"symbol": "USD"}}

    async def get_candles(self, *a):
        return self.candles

    async def get_balances(self):
        return [{"asset_symbol": "USD", "balance": "100"}]

    async def get_position(self, pid):
        return self.position

    async def get_open_orders(self, pid):
        return self.orders

    async def set_leverage(self, pid, lev):
        return {}

    async def place_order(self, pid, side, size, **kw):
        self.placed.append({"side": side, "size": size, **kw})
        if not kw.get("reduce_only"):
            self.position = {"size": size if side == "buy" else -size, "entry_price": str(self.candles[-1]["close"])}
        return {"id": len(self.placed), "average_fill_price": str(self.candles[-1]["close"])}

    async def place_stop(self, pid, side, size, stop_price):
        self.stops.append({"side": side, "size": size, "stop_price": stop_price})
        return {}

    async def cancel_all_orders(self, pid):
        self.cancelled += 1
        return {}

    async def close_position(self, pid):
        if int(self.position["size"]) == 0:
            return None
        self.position = {"size": 0, "entry_price": "0"}
        return {"average_fill_price": str(self.candles[-1]["close"])}


def uptrend() -> np.ndarray:
    return np.r_[np.full(150, 80_000.0), 80_000 + np.arange(1, 251) * 15.0]


async def make_engine(tmp_path, fake, dry_run: bool) -> Engine:
    s = Settings(_env_file=None, dry_run=dry_run, delta_api_key="k", delta_api_secret="s", resolution="1h",
                 db_url=f"sqlite:///{tmp_path / 't.db'}", cooldown_minutes_after_loss=0)
    e = Engine(s, fake, Store(s.db_url))
    e.strategy = TrendRegimeStrategy(entry_mode="state")  # enter on current trend state
    await e.setup()
    return e


@pytest.mark.asyncio
async def test_live_entry_sends_trailing_bracket(tmp_path):
    fake = FakeDelta(uptrend())
    e = await make_engine(tmp_path, fake, dry_run=False)
    await e.tick()
    order = fake.placed[0]
    assert order["side"] == "buy" and order["size"] >= 1
    assert order["trail_amount"] > 0 and order["stop_loss"] is None
    assert e.open_trade_id is not None


@pytest.mark.asyncio
async def test_exchange_stop_fill_is_reconciled(tmp_path):
    fake = FakeDelta(uptrend())
    e = await make_engine(tmp_path, fake, dry_run=False)
    await e.tick()
    fake.position = {"size": 0, "entry_price": "0"}  # bracket stop fired on the exchange
    await e.tick()  # same candle -> pure reconcile, and no re-entry until a new candle closes
    assert e.open_trade_id is None
    trade = e.store.recent_trades()[0]
    assert trade.exit_reason == "trailing stop hit (on Delta)" and trade.pnl is not None
    assert len(fake.placed) == 1


@pytest.mark.asyncio
async def test_restart_adopts_unprotected_position_and_places_stop(tmp_path):
    fake = FakeDelta(uptrend())
    fake.position = {"size": 3, "entry_price": "83000"}  # position exists, bot has no record
    e = await make_engine(tmp_path, fake, dry_run=False)
    await e.tick()
    assert fake.stops and fake.stops[0]["side"] == "sell" and fake.stops[0]["stop_price"] < 83000
    assert "restart recovery" in e.store.recent_trades()[0].entry_reason


@pytest.mark.asyncio
async def test_restart_recovery_does_not_depend_on_strategy_columns(tmp_path):
    """Regression: adoption used to read an 'atr' column only trend_regime makes -> crash, no stop."""
    fake = FakeDelta(uptrend())
    fake.position = {"size": 2, "entry_price": "83000"}
    e = await make_engine(tmp_path, fake, dry_run=False)
    e.strategy.compute = lambda df: df.copy()  # a strategy with no ATR column at all
    e.strategy.signal = lambda df, i: Signal(Side.FLAT, "test")
    e.strategy.get_checklist = lambda df, i: []
    e.strategy.should_exit = lambda df, i, side: None
    await e.tick()
    assert fake.stops and fake.stops[0]["stop_price"] < 83000
    assert e.open_trade_id is not None


@pytest.mark.asyncio
async def test_failed_protection_is_retried_next_tick(tmp_path):
    fake = FakeDelta(uptrend())
    fake.position = {"size": 2, "entry_price": "83000"}
    e = await make_engine(tmp_path, fake, dry_run=False)
    calls = {"n": 0}
    original = fake.place_stop

    async def flaky_place_stop(*args):
        calls["n"] += 1
        if calls["n"] == 1:
            raise ConnectionError("exchange down")
        return await original(*args)
    fake.place_stop = flaky_place_stop
    with pytest.raises(ConnectionError):
        await e.tick()
    assert e.open_trade_id is None  # not marked tracked while unprotected
    await e.tick()
    assert fake.stops and e.open_trade_id is not None


@pytest.mark.asyncio
async def test_kill_switch_flattens_and_blocks_restart(tmp_path):
    fake = FakeDelta(uptrend())
    e = await make_engine(tmp_path, fake, dry_run=False)
    await e.tick()
    await e.kill("test")
    assert int(fake.position["size"]) == 0 and fake.cancelled >= 1
    assert await e.start() == "kill switch active - reset it first"


@pytest.mark.asyncio
async def test_dry_run_paper_trade_and_trailing_stop(tmp_path):
    fake = FakeDelta(uptrend())
    e = await make_engine(tmp_path, fake, dry_run=True)
    await e.tick()
    assert fake.placed == []  # nothing sent to the exchange
    assert e.paper and e.paper["side"].value == "long"
    e.last_price = e.paper["stop"] - 1  # price falls through the stop
    await e.tick()
    assert e.paper is None
    assert e.store.recent_trades()[0].exit_reason == "trailing stop"
