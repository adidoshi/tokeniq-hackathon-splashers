from app.strategies.base import Side, Signal, Strategy
from app.strategies.scalping import ScalpingStrategy
from app.strategies.sma_cross import SMACrossoverStrategy
from app.strategies.stoch_sma import StochasticSMAStrategy
from app.strategies.trend_regime import TrendRegimeStrategy

# Registry: every strategy can be backtested; only `live_enabled` ones may trade.
# To add one: new file implementing Strategy (compute/signal/should_exit/get_checklist) + one line here.
STRATEGIES: dict[str, type[Strategy]] = {
    TrendRegimeStrategy.name: TrendRegimeStrategy,
    SMACrossoverStrategy.name: SMACrossoverStrategy,
    StochasticSMAStrategy.name: StochasticSMAStrategy,
    ScalpingStrategy.name: ScalpingStrategy,
}
LIVE_STRATEGIES = [name for name, cls in STRATEGIES.items() if cls.live_enabled]


def describe(cls: type[Strategy]) -> dict:
    return {"id": cls.name, "display_name": cls.display_name, "summary": cls.summary,
            "live_enabled": cls.live_enabled, "defaults": cls.defaults}


__all__ = [
    "Side", "Signal", "Strategy", "STRATEGIES", "LIVE_STRATEGIES", "describe",
    "TrendRegimeStrategy", "SMACrossoverStrategy", "StochasticSMAStrategy", "ScalpingStrategy",
]
