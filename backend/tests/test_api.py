"""API + safety-rule tests against a fake exchange (no network)."""
import numpy as np
import pandas as pd
import pytest
from httpx import ASGITransport, AsyncClient

from app.api import routes
from app.config import Settings
from app.engine import Engine
from app.main import app
from app.store import Store
from tests.test_engine import FakeDelta, uptrend


def hourly_df(n: int = 900) -> pd.DataFrame:
    """Synthetic real-shaped history: chop, trend up, trend down."""
    closes = np.r_[np.full(n // 3, 80_000.0), 80_000 + np.arange(n // 3) * 15.0,
                   80_000 + (n // 3) * 15.0 - np.arange(n - 2 * (n // 3)) * 15.0]
    idx = pd.date_range(end=pd.Timestamp.now(tz="UTC").floor("h"), periods=n, freq="1h")
    opens = np.r_[closes[0], closes[:-1]]
    return pd.DataFrame({"open": opens, "high": np.maximum(opens, closes) + 20, "low": np.minimum(opens, closes) - 20,
                         "close": closes, "volume": 1.0}, index=idx)


@pytest.fixture
async def client(tmp_path, monkeypatch):
    fake = FakeDelta(uptrend())
    s = Settings(_env_file=None, resolution="1h", db_url=f"sqlite:///{tmp_path / 'api.db'}")
    engine = Engine(s, fake, Store(s.db_url))
    await engine.setup()
    app.state.engine = engine

    async def fake_history(symbol, resolution, days):
        return hourly_df()
    monkeypatch.setattr(routes, "_history", fake_history)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, engine, fake


def test_config_defaults_are_safe():
    s = Settings(_env_file=None)
    assert s.dry_run is True and s.auto_start is False
    assert s.strategy == "trend_regime" and s.resolution == "1h"


def test_demo_preset_is_trend_regime_on_1m():
    s = Settings(_env_file=None, preset="demo")
    assert (s.resolution, s.strategy, s.strategy_params["entry_mode"]) == ("1m", "trend_regime", "state")


async def test_market_tickers_flag_only_the_bot_symbol_tradable(client, monkeypatch):
    ac, engine, _ = client

    async def fake_tickers():
        return [{"symbol": "ETHUSD", "close": "3000", "open": "2900", "turnover_usd": "5e6"},
                {"symbol": engine.s.symbol, "close": "80000", "open": "80000", "turnover_usd": "1e6"},
                {"symbol": "DEAD", "close": None, "mark_price": None}]
    monkeypatch.setattr(routes, "_fetch_tickers", fake_tickers)
    data = (await ac.get("/market/tickers")).json()
    assert [t["symbol"] for t in data] == [engine.s.symbol, "ETHUSD"]  # tradable first, junk dropped
    assert [t["tradable"] for t in data] == [True, False]
    assert data[1]["change_24h_pct"] == 3.45


async def test_strategies_lists_all_and_flags_live(client):
    ac, *_ = client
    data = (await ac.get("/api/strategies")).json()
    assert {s["id"] for s in data} == {"trend_regime", "sma_cross_5_15", "stoch_sma_66", "scalping_strategy"}
    assert set(s["id"] for s in data if s["live_enabled"]) == {"trend_regime", "stoch_sma_66"}
    assert next(s for s in data if s["id"] == "trend_regime")["active"] is True


async def test_select_strategy_rejects_backtest_only_and_bad_params(client):
    ac, *_ = client
    r = await ac.post("/bot/select-strategy", json={"strategy": "sma_cross_5_15"})
    assert r.status_code == 400 and "backtest-only" in r.json()["detail"]
    r = await ac.post("/bot/select-strategy", json={"strategy": "trend_regime", "params": {"fast": "x"}})
    assert r.status_code == 400
    r = await ac.post("/bot/select-strategy", json={"strategy": "trend_regime", "params": {"nope": 1}})
    assert r.status_code == 400
    r = await ac.post("/bot/select-strategy", json={"strategy": "trend_regime", "params": {"adx_threshold": 25}})
    assert r.status_code == 200 and r.json()["params"]["adx_threshold"] == 25
    # Switch to Stochasticate Momentum 66
    r = await ac.post("/bot/select-strategy", json={"strategy": "stoch_sma_66", "params": {"sma_period": 66}})
    assert r.status_code == 200 and r.json()["strategy"] == "stoch_sma_66"


async def test_select_strategy_refused_with_open_position(client):
    ac, engine, fake = client
    engine.position_size = 2  # simulate an open long
    r = await ac.post("/bot/select-strategy", json={"strategy": "trend_regime", "params": {"adx_threshold": 25}})
    assert r.status_code == 409


async def test_candles_validate_resolution_and_return_strategy_columns(client):
    ac, *_ = client
    assert (await ac.get("/candles?resolution=5s")).status_code == 400
    rows = (await ac.get("/candles?limit=50")).json()
    assert len(rows) == 50 and {"time", "close", "ema_fast", "ema_slow", "adx"} <= rows[0].keys()


async def test_backtest_validates_inputs(client):
    ac, *_ = client
    assert (await ac.post("/backtest", json={"equity": 0})).status_code == 422
    assert (await ac.post("/backtest", json={"strategy": "nope"})).status_code == 400
    assert (await ac.post("/backtest", json={"resolution": "1w"})).status_code == 400
    r = await ac.post("/backtest", json={"days": 30, "resolution": "1h"})
    assert r.status_code == 200 and r.json()["metrics"]["trades"] >= 1
    r_stoch = await ac.post("/backtest", json={
        "days": 30,
        "resolution": "1h",
        "strategy": "stoch_sma_66",
        "commission_pct": 0.05,
        "params": {"sma_period": 100},
    })
    assert r_stoch.status_code == 200
    assert r_stoch.json()["strategy"] == "stoch_sma_66"
    assert r_stoch.json()["commission_pct"] == 0.05
    assert r_stoch.json()["params"]["sma_period"] == 100


async def test_compare_runs_every_strategy_in_and_out_of_sample(client):
    ac, *_ = client
    data = (await ac.post("/backtest/compare", json={"days": 60})).json()
    assert len(data["strategies"]) == 4
    assert {"in_sample", "out_of_sample"} <= data["strategies"][0].keys()


async def test_replay_returns_a_session(client):
    ac, *_ = client
    data = (await ac.post("/replay", json={"days": 7})).json()
    assert data["strategy"] == "trend_regime" and len(data["candles"]) > 100
    assert {"pnl", "trades", "win_rate_pct", "max_drawdown_pct"} <= data["summary"].keys()
    first_bar = data["candles"][0]["time"]
    assert all(pd.Timestamp(t["entry_time"]).timestamp() >= first_bar - 3600 for t in data["trades"])


async def test_status_snapshot_is_pure_and_names_the_strategy(client):
    ac, engine, _ = client
    before = engine.risk.state.day
    s = (await ac.get("/status")).json()
    assert s["strategy_display_name"] == "Trend regime follower" and set(s["available_strategies"]) == {"trend_regime", "stoch_sma_66"}
    assert engine.risk.state.day == before  # reading status must not mutate risk state
