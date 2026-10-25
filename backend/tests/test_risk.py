from datetime import datetime, timedelta, timezone

from app.risk import RiskManager, position_size

T0 = datetime(2026, 10, 20, 10, 0, tzinfo=timezone.utc)


def rm(**kw) -> RiskManager:
    params = dict(risk_per_trade_pct=1.0, max_leverage=5, daily_loss_limit_pct=3.0,
                  max_trades_per_day=3, cooldown_minutes_after_loss=15)
    return RiskManager(**{**params, **kw})


def test_size_by_risk():
    # $100 equity, 1% = $1 risk; stop $200 away x 0.001 BTC = $0.20/contract -> 5 contracts
    assert position_size(100, 1.0, 80_000, 200, 0.001, 5) == 5


def test_size_capped_by_leverage():
    # tiny stop would allow 100 contracts, but 5x of $100 = $500 notional / $80 = 6
    assert position_size(100, 1.0, 80_000, 10, 0.001, 5) == 6


def test_size_zero_on_bad_input():
    assert position_size(100, 1.0, 80_000, 0, 0.001, 5) == 0
    assert position_size(0, 1.0, 80_000, 200, 0.001, 5) == 0


def test_daily_loss_limit_halts_then_clears_next_day():
    r = rm()
    assert r.check_account(T0, 100) is False
    assert r.check_account(T0, 96.9) is True  # -3.1%
    assert r.can_open(T0, 96.9) == (False, "daily loss limit hit (-3.10%)")
    assert r.can_open(T0 + timedelta(days=1), 96.9)[0] is True


def test_max_trades_and_cooldown():
    r = rm()
    for _ in range(3):
        assert r.can_open(T0, 100)[0]
        r.on_trade_opened()
    assert r.can_open(T0, 100)[1].startswith("max trades")

    r = rm()
    r.on_trade_closed(-1.0, T0)
    assert r.can_open(T0 + timedelta(minutes=5), 100)[1].startswith("cooldown")
    assert r.can_open(T0 + timedelta(minutes=16), 100)[0]


def test_kill_switch_survives_new_day():
    r = rm()
    r.kill("test")
    assert r.can_open(T0 + timedelta(days=2), 100) == (False, "kill switch active")
    r.reset_kill()
    assert r.can_open(T0 + timedelta(days=2), 100)[0]
