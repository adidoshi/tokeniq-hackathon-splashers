import numpy as np
import pandas as pd
import pytest

from app.backtest import run_backtest
from app.risk import RiskManager
from app.strategies import Side, TrendRegimeStrategy, SMACrossoverStrategy, StochasticSMAStrategy, ScalpingStrategy


def make_df(closes: np.ndarray) -> pd.DataFrame:
    idx = pd.date_range("2026-10-01", periods=len(closes), freq="5min", tz="UTC")
    opens = np.r_[closes[0], closes[:-1]]
    return pd.DataFrame({"open": opens, "high": np.maximum(opens, closes) + 20,
                         "low": np.minimum(opens, closes) - 20, "close": closes, "volume": 1.0}, index=idx)


def flat_then_trend(flat: int = 150, trend: int = 250, step: float = 15.0) -> pd.DataFrame:
    """Chop first (so the trend starts *after* warmup), then a steady uptrend."""
    return make_df(np.r_[np.full(flat, 80_000.0), 80_000 + np.arange(1, trend + 1) * step])


def risk() -> RiskManager:
    return RiskManager(1.0, 5, 3.0, 50, 0)


def test_strategy_goes_long_in_steady_uptrend():
    df = make_df(80_000 + np.arange(300) * 15.0)
    s = TrendRegimeStrategy(entry_mode="state")
    data = s.compute(df)
    assert s.signal(data, len(data) - 1).side == Side.LONG
    assert s.signal(data, 10).reason == "warming up"


def test_fresh_mode_enters_once_per_trend():
    df = flat_then_trend()
    s = TrendRegimeStrategy(entry_mode="fresh")
    data = s.compute(df)
    longs = [i for i in range(len(data)) if s.signal(data, i).side == Side.LONG]
    assert len(longs) == 1


def test_trailing_stop_sets_initial_stop_distance():
    df = make_df(80_000 + np.arange(300) * 15.0)
    s = TrendRegimeStrategy(trail_atr=3.0, sl_atr=1.5)
    data = s.compute(df)
    sig = s.signal(data, len(data) - 1)
    assert sig.stop_distance == sig.trail_distance == 3.0 * data["atr"].iloc[-1]


def test_strategy_stands_aside_in_chop():
    rng = np.random.default_rng(0)
    df = make_df(80_000 + rng.normal(0, 30, 300))
    s = TrendRegimeStrategy(adx_threshold=40)
    data = s.compute(df)
    assert s.signal(data, len(data) - 1).side == Side.FLAT


def test_backtest_profits_on_trend_and_has_no_lookahead():
    df = flat_then_trend()
    res = run_backtest(df, TrendRegimeStrategy(), risk())
    assert res.metrics["trades"] >= 1
    assert res.metrics["return_pct"] > 0
    first = res.trades[0]
    # entry must be the OPEN of a bar after the signal bar, never a close
    assert first.entry in df["open"].values


def test_sma_crossover_bullish_and_bearish_signals():
    # Construct prices where 5 SMA crosses above 15 SMA
    # 25 flat bars at 80,000, then sharp ramp up
    closes = np.r_[np.full(25, 80000.0), [80050.0, 80150.0, 80300.0]]
    df = make_df(closes)
    strat = SMACrossoverStrategy(fast=5, slow=15, rr_ratio=2.0)
    data = strat.compute(df)

    # Check signal on the crossover candle
    sig = None
    for i in range(len(data)):
        s = strat.signal(data, i)
        if s.side == Side.LONG:
            sig = s
            break

    assert sig is not None
    assert sig.side == Side.LONG
    assert sig.stop_distance == pytest.approx(sig.price * 0.0020)
    assert sig.take_profit_distance == pytest.approx(2.0 * sig.stop_distance)
    assert "0.20% SL" in sig.reason

    # Test checklist
    checklist = strat.get_checklist(data, len(data) - 1)
    assert len(checklist) >= 4
    assert any(c["id"] == "crossover" for c in checklist)


def oscillating_uptrend(n: int = 400, vol_spikes: bool = False) -> pd.DataFrame:
    """Rising trend with regular pullbacks: SMA keeps rising while oscillators cycle."""
    t = np.arange(n)
    closes = 80_000 + t * 4.0 + np.sin(t / 4.0) * 120
    df = make_df(closes)
    if vol_spikes:
        df["volume"] = np.where(t % 9 == 0, 300.0, 100.0)
    return df


def test_stochastic_sma_long_signals_obey_every_rule():
    strat = StochasticSMAStrategy()
    assert strat.params["sma_period"] == 100
    assert strat.params["k_period"] == 16
    assert strat.params["smooth_k"] == 2
    assert strat.params["d_period"] == 3
    assert strat.params["level_high"] == 60.0
    assert strat.params["level_low"] == 20.0
    assert strat.params["stopbars"] == 4
    assert strat.params["rr_ratio"] == 2.0
    assert strat.display_name == "Strategy Guide"

    data = strat.compute(oscillating_uptrend())
    longs = [i for i in range(len(data)) if strat.signal(data, i).side == Side.LONG]
    assert longs, "expected at least one long on a rising, oscillating market"
    for i in longs:
        row, prev = data.iloc[i], data.iloc[i - 1]
        sig = strat.signal(data, i)
        assert row["ma_rising"]                                     # 66 SMA strictly rising
        assert prev["stoch_k"] <= 20 < row["stoch_k"]               # %K crossed above 20
        assert row["close"] > row["open"]                           # green trigger candle
        expected_stop = max(row["close"] - row["lowest_stopbars"], row["close"] * 0.001)
        assert sig.stop_distance == pytest.approx(expected_stop)
        assert sig.take_profit_distance == pytest.approx(2 * expected_stop)
        assert sig.trail_distance == 0.0                            # fixed bracket stop (no trailing)

    checklist = strat.get_checklist(data, longs[0])
    assert any(c["id"] == "stoch_reversal" for c in checklist)
    assert any(c["id"] == "swing_sl" for c in checklist)


def oscillating_downtrend(n: int = 400) -> pd.DataFrame:
    """Falling trend with regular bounces: SMA keeps falling while oscillators cycle."""
    t = np.arange(n)
    closes = 85_000 - t * 4.0 + np.sin(t / 4.0) * 120
    return make_df(closes)


def test_stochastic_sma_short_signals_and_exits():
    strat = StochasticSMAStrategy(exit_on_trend_flip=True)
    data = strat.compute(oscillating_downtrend())
    shorts = [i for i in range(len(data)) if strat.signal(data, i).side == Side.SHORT]
    assert shorts, "expected at least one short on a falling, oscillating market"
    for i in shorts:
        row, prev = data.iloc[i], data.iloc[i - 1]
        sig = strat.signal(data, i)
        assert row["ma_falling"]                                    # 66 SMA strictly falling
        assert prev["stoch_k"] >= 60 > row["stoch_k"]               # %K crossed below 60
        assert row["close"] < row["open"]                           # red trigger candle
        expected_stop = max(row["highest_stopbars"] - row["close"], row["close"] * 0.001)
        assert sig.stop_distance == pytest.approx(expected_stop)
        assert sig.take_profit_distance == pytest.approx(2 * expected_stop)

    # Test exit when SMA reverses
    assert strat.should_exit(data, shorts[0], Side.SHORT) is None
    # If ma_rising occurs:
    mock_df = data.copy()
    mock_df.loc[mock_df.index[shorts[0]], "ma_rising"] = True
    assert strat.should_exit(mock_df, shorts[0], Side.SHORT) == "100 SMA trend reversed to rising"


def test_stochastic_sma_warmup():
    strat = StochasticSMAStrategy()
    df = make_df(80_000 + np.arange(40) * 10.0)
    data = strat.compute(df)
    sig = strat.signal(data, 10)
    assert sig.side == Side.FLAT and "warming up" in sig.reason
    chk = strat.get_checklist(data, 10)
    assert chk[0]["id"] == "warmup" and chk[0]["met"] is False


def test_stochastic_sma_backtest_trades_and_fills_at_next_open():
    df = oscillating_uptrend()
    res = run_backtest(df, StochasticSMAStrategy(), risk(), start_equity=10_000.0, contract_value=0.001)
    assert res.metrics["trades"] >= 1
    assert all(t.entry in df["open"].values for t in res.trades)  # no look-ahead


def test_scalping_long_signals_obey_every_rule():
    strat = ScalpingStrategy()
    data = strat.compute(oscillating_uptrend(vol_spikes=True))
    longs = [i for i in range(len(data)) if strat.signal(data, i).side == Side.LONG]
    assert longs, "expected at least one long on an uptrend with volume spikes"
    for i in longs:
        row = data.iloc[i]
        sig = strat.signal(data, i)
        assert row["EMA_5"] > row["EMA_10"] > row["EMA_20"]
        assert row["RSI"] < 70 and row["volume_ratio"] > 1.3
        assert sig.stop_distance == pytest.approx(row["close"] * 0.002)
        assert sig.take_profit_distance == pytest.approx(row["close"] * 0.003)
    checklist = strat.get_checklist(data, longs[0])
    assert {"triple_ema", "rsi_gate", "volume_surge"} <= {c["id"] for c in checklist}


def test_strategy_params_are_validated():
    with pytest.raises(ValueError):
        TrendRegimeStrategy(unknown=1)
    with pytest.raises(ValueError):
        TrendRegimeStrategy(fast="abc")
    with pytest.raises(ValueError):
        TrendRegimeStrategy(entry_mode="yolo")
    assert TrendRegimeStrategy(adx_threshold="25").params["adx_threshold"] == 25.0
