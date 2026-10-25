"""Strategy interface. Every strategy (trend, mean-reversion, grid...) plugs in the same way.

Node analogy: an abstract class / TS interface. The engine and backtester only know this
contract, so swapping strategies on hackathon day touches one file.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum

import pandas as pd


class Side(str, Enum):
    LONG = "long"
    SHORT = "short"
    FLAT = "flat"  # no trade / stand aside


@dataclass
class Signal:
    side: Side
    reason: str  # human-readable "why" -> shown on dashboard, great for the demo
    price: float = 0.0
    stop_distance: float = 0.0  # price distance to stop-loss (used for sizing)
    take_profit_distance: float = 0.0  # 0 = no fixed target
    trail_distance: float = 0.0  # 0 = fixed stop; >0 = stop trails price by this distance
    indicators: dict = field(default_factory=dict)


class Strategy(ABC):
    name: str = "base"
    display_name: str = "Base strategy"
    summary: str = ""  # one line for the dashboard / backtest comparison
    live_enabled: bool = False  # only strategies that survived out-of-sample testing may trade live
    defaults: dict = {}  # every accepted parameter with its default (types are taken from here)
    choices: dict[str, tuple] = {}  # allowed values for string parameters
    warmup: int = 100  # bars needed before indicators are trustworthy

    def __init__(self, **params):
        self.params = self.validate_params(params)

    @classmethod
    def validate_params(cls, params: dict) -> dict:
        """Merge params over defaults; unknown keys, wrong types or bad choices raise ValueError."""
        unknown = set(params) - set(cls.defaults)
        if unknown:
            raise ValueError(f"unknown parameter(s) {sorted(unknown)} for {cls.name}; allowed: {sorted(cls.defaults)}")
        merged = dict(cls.defaults)
        for key, value in params.items():
            default = cls.defaults[key]
            try:
                if isinstance(default, bool):
                    if not isinstance(value, bool):
                        raise TypeError
                    merged[key] = value
                elif isinstance(default, (int, float)):
                    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
                        raise TypeError
                    num = float(value)
                    merged[key] = int(num) if isinstance(default, int) and num.is_integer() else num
                else:
                    merged[key] = str(value)
            except (TypeError, ValueError):
                raise ValueError(f"parameter '{key}' must be a {type(default).__name__}, got {value!r}") from None
            if key in cls.choices and merged[key] not in cls.choices[key]:
                raise ValueError(f"parameter '{key}' must be one of {cls.choices[key]}, got {value!r}")
        return merged

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add indicator columns. Must be causal (no future data)."""

    @abstractmethod
    def signal(self, df: pd.DataFrame, i: int) -> Signal:
        """Entry signal using bars [0..i] of a computed df. i = last *closed* candle."""

    def should_exit(self, df: pd.DataFrame, i: int, side: Side) -> str | None:
        """Discretionary exit for an open position (besides stops). Return a reason or None."""
        return None

    def get_checklist(self, df: pd.DataFrame, i: int) -> list[dict]:
        """Checklist of entry conditions and whether they are currently met."""
        return []
