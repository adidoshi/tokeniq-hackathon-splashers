"""App settings loaded from environment / .env.

Node analogy: this is `dotenv` + a `zod` schema in one. Pydantic reads env vars,
casts them to the declared types, and fails fast at startup if something is wrong.

SAFETY: defaults must never send real orders on their own. Live execution needs an explicit
DRY_RUN=false in backend/.env, and the bot only trades after Start (or AUTO_START=true).
"""
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The demo preset trades trend_regime on 1m so judges see activity within minutes.
# It is NOT the validated setting (1h) - the dashboard labels it "demo speed".
DEMO_PRESET = {"resolution": "1m", "strategy_params": {"entry_mode": "state", "trail_atr": 2.0}}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "../.env.local"),
        extra="ignore",
    )

    # Delta Exchange (India testnet by default)
    delta_api_key: str = ""
    delta_api_secret: str = ""
    delta_base_url: str = "https://cdn-ind.testnet.deltaex.org"
    delta_ws_public_url: str = "wss://socket-ind-pub.testnet.deltaex.org"
    delta_ws_private_url: str = "wss://socket-ind.testnet.deltaex.org"

    # Trading
    preset: Literal["validated", "demo"] = "validated"
    strategy: str = "trend_regime"
    strategy_params: dict = {}
    auto_start: bool = False  # start trading on boot (set true on the server so restarts resume)
    poll_seconds: int = 5
    db_url: str = "sqlite:///tokeniq.db"
    symbol: str = "BTCUSD"
    resolution: str = "1h"  # backtested timeframe
    dry_run: bool = True  # True = paper trading; set DRY_RUN=false explicitly for testnet orders

    # Risk
    risk_per_trade_pct: float = 1.0
    max_leverage: int = 5
    daily_loss_limit_pct: float = 3.0
    max_trades_per_day: int = 10
    cooldown_minutes_after_loss: int = 15

    # API
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    # optional regex for origins that change per deploy, e.g. Vercel preview URLs
    cors_origin_regex: str | None = None

    @model_validator(mode="after")
    def _apply_preset(self) -> "Settings":
        if self.preset == "demo":
            self.resolution = DEMO_PRESET["resolution"]
            self.strategy = "trend_regime"
            self.strategy_params = {**DEMO_PRESET["strategy_params"], **self.strategy_params}
        return self

    @property
    def has_credentials(self) -> bool:
        return bool(self.delta_api_key and self.delta_api_secret)


@lru_cache  # like a module-level singleton: built once, reused everywhere
def get_settings() -> Settings:
    return Settings()
