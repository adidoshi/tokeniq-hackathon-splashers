"""Risk engine: every order must pass through here. Layers, from per-trade to account-wide:

1. Position sizing   - risk a fixed % of equity per trade, sized by stop distance (ATR)
2. Leverage cap      - never exceed max notional, even if the stop is tiny
3. Trade limits      - max trades/day, cooldown after a loss (stops revenge trading)
4. Daily loss limit  - hit -X% today -> flatten + halt until next UTC day
5. Kill switch       - manual/automatic hard stop, requires explicit reset
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


def position_size(equity: float, risk_pct: float, entry: float, stop_distance: float,
                  contract_value: float, max_leverage: float) -> int:
    """Contracts to trade so that hitting the stop loses ~risk_pct of equity."""
    if equity <= 0 or entry <= 0 or stop_distance <= 0:
        return 0
    risk_usd = equity * risk_pct / 100
    by_risk = risk_usd / (stop_distance * contract_value)
    by_leverage = equity * max_leverage / (entry * contract_value)
    return max(0, math.floor(min(by_risk, by_leverage)))


@dataclass
class RiskState:
    day: str = ""
    day_start_equity: float = 0.0
    trades_today: int = 0
    last_loss_at: datetime | None = None
    killed: bool = False
    halted_reason: str = ""
    events: list[str] = field(default_factory=list)


class RiskManager:
    def __init__(self, risk_per_trade_pct: float, max_leverage: float, daily_loss_limit_pct: float,
                 max_trades_per_day: int, cooldown_minutes_after_loss: int):
        self.risk_per_trade_pct = risk_per_trade_pct
        self.max_leverage = max_leverage
        self.daily_loss_limit_pct = daily_loss_limit_pct
        self.max_trades_per_day = max_trades_per_day
        self.cooldown = timedelta(minutes=cooldown_minutes_after_loss)
        self.state = RiskState()

    @classmethod
    def from_settings(cls, s) -> "RiskManager":
        return cls(s.risk_per_trade_pct, s.max_leverage, s.daily_loss_limit_pct,
                   s.max_trades_per_day, s.cooldown_minutes_after_loss)

    def _log(self, msg: str) -> None:
        self.state.events.append(msg)
        self.state.events = self.state.events[-50:]

    def _roll_day(self, now: datetime, equity: float) -> None:
        day = now.astimezone(timezone.utc).date().isoformat()
        if day != self.state.day:
            self.state.day, self.state.day_start_equity, self.state.trades_today = day, equity, 0
            if self.state.halted_reason.startswith("daily loss"):
                self.state.halted_reason = ""  # daily halt expires; kill switch does not
                self._log(f"{day}: new day, daily-loss halt cleared")

    def daily_pnl_pct(self, equity: float) -> float:
        if self.state.day_start_equity <= 0:
            return 0.0
        return (equity - self.state.day_start_equity) / self.state.day_start_equity * 100

    def check_account(self, now: datetime, equity: float) -> bool:
        """Call every loop. Returns True if the bot must flatten now (daily loss breached)."""
        self._roll_day(now, equity)
        if not self.state.halted_reason and self.daily_pnl_pct(equity) <= -self.daily_loss_limit_pct:
            self.state.halted_reason = f"daily loss limit hit ({self.daily_pnl_pct(equity):.2f}%)"
            self._log(self.state.halted_reason)
            return True
        return False

    def can_open(self, now: datetime, equity: float) -> tuple[bool, str]:
        self._roll_day(now, equity)
        if self.state.killed:
            return False, "kill switch active"
        if self.state.halted_reason:
            return False, self.state.halted_reason
        if self.state.trades_today >= self.max_trades_per_day:
            return False, f"max trades/day reached ({self.max_trades_per_day})"
        if self.state.last_loss_at and now - self.state.last_loss_at < self.cooldown:
            left = self.cooldown - (now - self.state.last_loss_at)
            return False, f"cooldown after loss ({int(left.total_seconds() // 60)}m left)"
        return True, "ok"

    def size(self, equity: float, entry: float, stop_distance: float, contract_value: float) -> int:
        return position_size(equity, self.risk_per_trade_pct, entry, stop_distance,
                             contract_value, self.max_leverage)

    def on_trade_opened(self) -> None:
        self.state.trades_today += 1

    def on_trade_closed(self, pnl: float, now: datetime) -> None:
        if pnl < 0:
            self.state.last_loss_at = now

    def kill(self, reason: str = "manual") -> None:
        self.state.killed = True
        self._log(f"KILL SWITCH: {reason}")

    def reset_kill(self) -> None:
        self.state.killed = False
        self._log("kill switch reset")
