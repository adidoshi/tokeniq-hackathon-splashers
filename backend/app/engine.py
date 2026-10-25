"""Trading engine: the autonomous loop that turns signals into orders.

Every `poll_seconds`:
  1. refresh candles (REST = source of truth) and account (balance + position from exchange)
  2. reconcile: exchange position vs our records (stop hit on exchange? restarted mid-trade?)
  3. account risk: daily loss limit -> flatten + halt
  4. on each newly CLOSED candle: strategy signal -> exits -> risk gate -> sized entry
     with an exchange-side bracket stop (trailing or fixed)
Fail-safes: stale-data guard, circuit breaker on repeated errors, kill switch, DRY_RUN paper mode.
"""
import asyncio
import logging
import time
from collections import deque
from datetime import datetime, timedelta, timezone

import pandas as pd

from app.backtest import RESOLUTION_SECONDS
from app.config import Settings
from app.delta.client import DeltaClient
from app.indicators import atr as compute_atr
from app.indicators import candles_to_df
from app.risk import RiskManager
from app.store import Store
from app.strategies import LIVE_STRATEGIES, STRATEGIES, Side, Signal, Strategy

log = logging.getLogger(__name__)
FEE_RATE = 0.00053  # Delta taker fee incl. GST (from order history), used for paper PnL
MAX_CONSECUTIVE_ERRORS = 5


def format_ist(dt: datetime | None) -> str:
    """Format UTC datetime into Indian Standard Time (UTC+5:30)."""
    if not dt:
        return ""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    ist_dt = dt.astimezone(ist_tz) if dt.tzinfo else dt.replace(tzinfo=timezone.utc).astimezone(ist_tz)
    return ist_dt.strftime("%Y-%m-%d %H:%M:%S IST (UTC+5:30)")


class Engine:
    def __init__(self, settings: Settings, client: DeltaClient, store: Store):
        self.s = settings
        self.client = client
        self.store = store
        self.strategy = self._build_strategy(settings.strategy, settings.strategy_params)
        self.risk = RiskManager.from_settings(settings)
        self.dry_run = settings.dry_run or not settings.has_credentials
        if settings.resolution not in RESOLUTION_SECONDS:
            raise ValueError(f"RESOLUTION={settings.resolution!r} is not served by Delta; use one of {list(RESOLUTION_SECONDS)}")
        self.res = timedelta(seconds=RESOLUTION_SECONDS[settings.resolution])

        self.product: dict = {}
        self.product_id = 0
        self.contract_value = 0.001
        self.tick_size = 0.1
        self.settling_asset = "USD"

        self.running = False
        self._task: asyncio.Task | None = None
        self.candles: pd.DataFrame | None = None
        self.last_closed_ts: pd.Timestamp | None = None
        self.last_signal: Signal | None = None
        self.last_price: float | None = None
        self.mark_price: float | None = None

        self.balance = 0.0
        self.equity = 0.0
        self.position_size = 0  # signed contracts: + long, - short
        self.entry_price = 0.0
        self.open_trade_id: int | None = None
        self.active_trade: dict | None = None  # Live/paper trade parameters: SL, TP, entry IST
        self.paper: dict | None = None  # DRY_RUN position: side, size, entry, stop, trail
        self.paper_balance = 100.0

        self.checklist: list[dict] = []  # entry gate, recomputed each tick; snapshot() only reads it
        self.errors = 0
        self.last_error = ""
        self.events: deque[dict] = deque(maxlen=200)
        self.listeners: set[asyncio.Queue] = set()
        self.market = None  # MarketStream, attached in main.py (for feed health in snapshots)

    # ---------------- events (dashboard feed) ----------------
    def emit(self, kind: str, message: str, persist: bool = True, **data) -> None:
        event = {"ts": datetime.now(timezone.utc).isoformat(), "kind": kind, "message": message, "data": data}
        if kind != "tick":
            self.events.append(event)
            log.info("[%s] %s", kind, message)
        if persist and kind != "tick":
            self.store.add_event(kind, message, data)
        for q in list(self.listeners):
            if q.full():
                continue  # slow client: drop rather than block trading
            q.put_nowait(event)

    async def on_market_message(self, msg: dict) -> None:
        """Called by MarketStream for every WS message."""
        if msg.get("type") == "ticker" and msg.get("d"):
            self.mark_price = float(msg["d"][0]["m"])
        elif msg.get("type", "").startswith("candlestick"):
            self.last_price = float(msg["c"])
        self.emit("tick", "", persist=False, price=self.last_price, mark=self.mark_price)

    # ---------------- lifecycle ----------------
    async def setup(self) -> None:
        self.product = await self.client.get_product(self.s.symbol)
        self.product_id = self.product["id"]
        self.contract_value = float(self.product["contract_value"])
        self.tick_size = float(self.product["tick_size"])
        self.settling_asset = self.product.get("settling_asset", {}).get("symbol", "USD")
        if not self.dry_run:
            try:
                await self.client.set_leverage(self.product_id, self.s.max_leverage)
            except Exception as e:
                self.emit("error", f"set_leverage failed: {e}")
        row = self.store.open_trade_row(self.s.symbol)
        if row and row.dry_run:
            self.store.close_trade(row.id, row.entry_price, "restart (paper position discarded)", 0.0)
        elif row and not self.dry_run:
            self.open_trade_id = row.id  # resume tracking a live trade opened before a restart
        try:  # the chart works before the bot starts; a failure here must not stop the server booting
            await self._refresh_candles(datetime.now(timezone.utc))
            await self._refresh_account()
            self._update_checklist()
        except Exception as e:
            self.emit("error", f"initial market/account load failed ({type(e).__name__}: {e}); retrying on the first tick")
        mode = "DRY RUN (paper)" if self.dry_run else "LIVE testnet orders"
        self.emit("system", f"Engine ready: {self.s.symbol} {self.s.resolution} {self.strategy.display_name} "
                            f"({self.s.preset} preset), {mode}", equity=self.equity)

    async def start(self) -> str:
        if self.risk.state.killed:
            return "kill switch active - reset it first"
        if self.running:
            return "already running"
        self.running = True
        self._task = asyncio.create_task(self._loop())
        self.emit("system", "Bot started")
        return "started"

    async def stop(self) -> str:
        self.running = False
        if self._task and self._task is not asyncio.current_task():
            self._task.cancel()
        self._task = None
        self.emit("system", "Bot stopped (open positions stay protected by exchange stops)")
        return "stopped"

    async def kill(self, reason: str = "manual") -> str:
        """Hard stop: halt, cancel every order, flatten. Requires reset before restarting."""
        self.risk.kill(reason)
        await self.stop()
        try:
            await self._flatten(f"kill switch: {reason}")
        finally:
            self.emit("risk", f"KILL SWITCH ({reason}): orders cancelled, position flat, trading halted")
        return "killed"

    def reset_kill(self) -> str:
        self.risk.reset_kill()
        self.emit("risk", "Kill switch reset")
        return "reset"

    @staticmethod
    def _build_strategy(name: str, params: dict | None = None) -> Strategy:
        """Only strategies validated out of sample may trade; params are type-checked."""
        canonical_name = "stoch_sma_66" if name == "strategy_guide" else name
        if canonical_name not in STRATEGIES:
            raise ValueError(f"unknown strategy '{name}'; available: {list(STRATEGIES)}")
        if not STRATEGIES[canonical_name].live_enabled:
            raise ValueError(f"'{name}' is backtest-only (failed out-of-sample testing); live: {LIVE_STRATEGIES}")
        return STRATEGIES[canonical_name](**(params or {}))

    def set_strategy(self, name: str, params: dict | None = None) -> None:
        """Switch strategy. Refused with a position open: its stops and exits belong to the old strategy."""
        if self._side() != Side.FLAT:
            raise RuntimeError("close the open position before switching strategy")
        self.strategy = self._build_strategy(name, params)  # raises ValueError on bad input
        self.s.strategy = name
        self.last_signal = None
        self._update_checklist()
        self.emit("system", f"Strategy switched to {self.strategy.display_name} {self.strategy.params}")

    def _update_checklist(self) -> None:
        """Recompute the entry checklist on closed candles (called from tick/setup, never from snapshot)."""
        if self.candles is None or len(self.candles) < 2 or not isinstance(self.candles.index, pd.DatetimeIndex):
            self.checklist = []
            return
        closed = self.candles[self.candles.index + self.res <= datetime.now(timezone.utc)]
        self.checklist = self.get_checklist(self.strategy.compute(closed if len(closed) >= 2 else self.candles))

    def get_checklist(self, computed: pd.DataFrame) -> list[dict]:
        """Strategy conditions + risk + margin, each with its live value."""
        try:
            idx = len(computed) - 1
            items = self.strategy.get_checklist(computed, idx)
        except Exception as e:
            items = [{"id": "strategy_eval", "title": "Strategy Calculation", "condition": str(e), "met": False, "value": "Error"}]

        now = datetime.now(timezone.utc)
        can_trade, risk_reason = self.risk.can_open(now, self.equity)
        items.append({
            "id": "risk_guard",
            "title": "Daily Risk & Loss Safeguard",
            "condition": f"Daily loss < {self.risk.daily_loss_limit_pct}% & Trades < {self.risk.max_trades_per_day}",
            "met": can_trade,
            "value": f"Daily P&L: {self.risk.daily_pnl_pct(self.equity):+.2f}% | Trades: {self.risk.state.trades_today}/{self.risk.max_trades_per_day}",
        })
        items.append({
            "id": "account_balance",
            "title": "Delta Margin Available",
            "condition": "Sufficient equity to margin >= 1 contract",
            "met": self.equity > 5.0,
            "value": f"Equity: ${self.equity:,.2f} ({'Sufficient' if self.equity > 5.0 else 'Low Balance'})",
        })
        return items

    async def _loop(self) -> None:
        while self.running:
            try:
                await self.tick()
                self.errors = 0
            except asyncio.CancelledError:
                raise
            except Exception as e:
                self.errors += 1
                self.last_error = f"{type(e).__name__}: {e}"
                self.emit("error", f"tick failed ({self.errors}/{MAX_CONSECUTIVE_ERRORS}): {self.last_error}")
                if self.errors >= MAX_CONSECUTIVE_ERRORS:
                    self.emit("risk", "Circuit breaker: repeated errors, pausing 60s (exchange stops still active)")
                    await asyncio.sleep(60)
                    self.errors = 0
            await asyncio.sleep(self.s.poll_seconds)

    # ---------------- one iteration ----------------
    async def tick(self) -> None:
        now = datetime.now(timezone.utc)
        await self._refresh_candles(now)
        await self._refresh_account()
        await self._reconcile(now)

        if self.risk.check_account(now, self.equity) and self._side() != Side.FLAT:
            await self._flatten("daily loss limit")
            return

        if self.candles is None or self.candles.empty:
            self.emit("risk", "No candles returned by the exchange - not trading this tick")
            return
        closed = self.candles[self.candles.index + self.res <= now]
        if len(closed) < self.strategy.warmup + 1:
            return
        ts = closed.index[-1]
        if ts == self.last_closed_ts:
            return  # no new candle yet
        self.last_closed_ts = ts
        if now - (ts + self.res) > 3 * self.res:
            self.emit("risk", f"Stale data: last closed candle {ts} - not trading")
            return

        data = self.strategy.compute(closed)
        i = len(data) - 1
        sig = self.strategy.signal(data, i)
        self.last_signal = sig
        self.checklist = self.get_checklist(data)
        ist_now = format_ist(now)
        self.emit("signal", f"{sig.side.value.upper()}: {sig.reason} at {ist_now}", candle=str(ts), time_ist=ist_now, **sig.indicators)

        side = self._side()
        if side != Side.FLAT:
            exit_reason = ("opposite signal" if sig.side not in (Side.FLAT, side)
                           else self.strategy.should_exit(data, i, side))
            if not exit_reason:
                return
            await self._flatten(exit_reason)
            await self._refresh_account()

        if sig.side == Side.FLAT:
            return

        # Verification Checklist Guard: Every checkpoint must pass before trade execution
        checklist = self.checklist
        met_count = sum(1 for c in checklist if c.get("met", False))
        total_count = len(checklist)
        all_met = met_count == total_count
        self.emit("signal", f"CHECKLIST AUDIT [{met_count}/{total_count}]: {'ALL CONDITIONS MET' if all_met else 'CONDITIONS PENDING'} for {sig.side.value.upper()} order at {ist_now}",
                  met=all_met, score=f"{met_count}/{total_count}")
        if not all_met:
            return

        ok, why = self.risk.can_open(now, self.equity)
        if not ok:
            self.emit("risk", f"Entry blocked: {why}")
            return
        size = self.risk.size(self.equity, sig.price, sig.stop_distance, self.contract_value)
        if size < 1:
            budget = self.equity * self.risk.risk_per_trade_pct / 100
            one_contract = sig.stop_distance * self.contract_value
            self.emit("risk", f"Entry skipped: 1 contract risks ${one_contract:.2f} on a {sig.stop_distance:.0f} stop, "
                              f"budget is {self.risk.risk_per_trade_pct:g}% = ${budget:.2f}",
                      side=sig.side.value, risk_one_contract=one_contract, budget=budget)
            return
        await self._enter(sig, size)

    # ---------------- data & account ----------------
    async def _refresh_candles(self, now: datetime) -> None:
        bars = self.strategy.warmup + 200
        end = int(now.timestamp())
        start = end - int(self.res.total_seconds()) * bars
        self.candles = candles_to_df(await self.client.get_candles(self.s.symbol, self.s.resolution, start, end))

    def _price(self) -> float:
        if self.last_price:
            return self.last_price
        if self.candles is not None and len(self.candles) > 0:
            return float(self.candles["close"].iloc[-1])
        return self.mark_price or 0.0

    async def _refresh_account(self) -> None:
        if self.dry_run:
            self.balance = self.paper_balance
            if self.paper:
                d = 1 if self.paper["side"] == Side.LONG else -1
                self.position_size, self.entry_price = d * self.paper["size"], self.paper["entry"]
            else:
                self.position_size, self.entry_price = 0, 0.0
        else:
            balances = await self.client.get_balances()
            wallet = next((b for b in balances if b.get("asset_symbol") == self.settling_asset), {})
            self.balance = float(wallet.get("balance") or 0)
            pos = await self.client.get_position(self.product_id)
            self.position_size = int(pos.get("size") or 0)
            self.entry_price = float(pos.get("entry_price") or 0)
        mark = self.mark_price or self._price()
        unrealized = (mark - self.entry_price) * self.position_size * self.contract_value if self.position_size else 0
        self.equity = self.balance + unrealized

    def _side(self) -> Side:
        return Side.LONG if self.position_size > 0 else Side.SHORT if self.position_size < 0 else Side.FLAT

    async def _reconcile(self, now: datetime) -> None:
        if self.dry_run:
            self._paper_check_stop(now)
            return
        if self.position_size == 0 and self.open_trade_id is not None:
            # we thought we were in a trade, exchange says flat -> bracket stop/target fired
            # our own bracket order on Delta closed it: say which one
            trade = self.active_trade or {}
            reason = ("trailing stop hit (on Delta)" if trade.get("trail")
                      else "stop or target hit (on Delta)")
            self._record_close(self._price(), reason, now)
            await self.client.cancel_all_orders(self.product_id)  # clear any leftover sibling order
        elif self.position_size != 0 and self.open_trade_id is None:
            await self._adopt_position()

    async def _adopt_position(self) -> None:
        """Restart recovery: a position exists that we have no record of -> track it and make sure it's protected."""
        side = self._side()
        size = abs(self.position_size)
        try:
            orders = await self.client.get_open_orders(self.product_id)
            if not any(o.get("stop_order_type") == "stop_loss_order" for o in orders):
                # ATR from raw candles, independent of which strategy is loaded
                atr_now = float(compute_atr(self.candles).iloc[-1]) if self.candles is not None and len(self.candles) > 1 \
                    else self.entry_price * 0.01
                mult = float(self.strategy.params.get("trail_atr") or self.strategy.params.get("sl_atr") or 2.0)
                stop = self.entry_price - mult * atr_now if side == Side.LONG else self.entry_price + mult * atr_now
                await self.client.place_stop(self.product_id, "sell" if side == Side.LONG else "buy", size, self._round(stop))
                self.emit("risk", f"Adopted unprotected {side.value} x{size}, placed stop @ {stop:.1f}")
            else:
                self.emit("system", f"Adopted {side.value} x{size} (already protected)")
        except Exception as e:
            # don't mark the position as tracked: the next tick retries protection
            self.emit("error", f"restart recovery could not protect {side.value} x{size}: {type(e).__name__}: {e}")
            raise
        self.open_trade_id = self.store.open_trade(
            symbol=self.s.symbol, side=side.value, size=size, entry_price=self.entry_price,
            entry_reason="adopted existing position (restart recovery)", dry_run=False)

    # ---------------- orders ----------------
    def _round(self, price: float) -> float:
        decimals = max(0, len(str(self.product.get("tick_size", "0.1")).rstrip("0").split(".")[-1]))
        return round(round(price / self.tick_size) * self.tick_size, decimals)

    async def _enter(self, sig: Signal, size: int) -> None:
        price = self._price()
        d = 1 if sig.side == Side.LONG else -1
        stop = price - d * sig.stop_distance
        tp = price + d * sig.take_profit_distance if sig.take_profit_distance > 0 else None
        order_id = "paper"
        now = datetime.now(timezone.utc)
        ist_str = format_ist(now)
        if self.dry_run:
            self.paper = {"side": sig.side, "size": size, "entry": price, "stop": stop,
                          "trail": sig.trail_distance, "tp": tp}
            self.paper_balance -= FEE_RATE * price * size * self.contract_value
        else:
            o = await self.client.place_order(
                self.product_id, "buy" if d == 1 else "sell", size,
                trail_amount=self._round(sig.trail_distance) if sig.trail_distance else None,
                stop_loss=None if sig.trail_distance else self._round(stop),
                take_profit=self._round(tp) if tp else None,
                client_order_id=f"tiq-{int(time.time())}")
            order_id = str(o.get("id"))
            price = float(o.get("average_fill_price") or price)

        self.active_trade = {
            "side": sig.side.value,
            "size": size,
            "entry_price": price,
            "stop": self._round(stop),
            "take_profit": self._round(tp) if tp else None,
            "trail": self._round(sig.trail_distance) if sig.trail_distance else None,
            "entry_time_utc": now.isoformat(),
            "entry_time_ist": ist_str,
            "rr_ratio": round(rr, 2) if tp else None,
        }
        self.risk.on_trade_opened()
        self.open_trade_id = self.store.open_trade(
            symbol=self.s.symbol, side=sig.side.value, size=size, entry_price=price,
            entry_reason=sig.reason, dry_run=self.dry_run, order_id=order_id)
        protection = f"trailing stop {sig.trail_distance:.1f}" if sig.trail_distance else f"stop {stop:.1f}"
        rr = sig.take_profit_distance / sig.stop_distance if sig.stop_distance else 0
        tp_label = f" | tp {tp:.1f} (1:{rr:.1f} R:R)" if tp else ""
        self.emit("order", f"ENTER {sig.side.value.upper()} x{size} @ {price:.1f} ({protection}{tp_label}) at {ist_str}",
                  side=sig.side.value, size=size, price=price, stop=stop, take_profit=tp, time_ist=ist_str, dry_run=self.dry_run)
        await self._refresh_account()

    async def _flatten(self, reason: str) -> None:
        now = datetime.now(timezone.utc)
        if self.dry_run:
            if self.paper:
                self._paper_close(self._price(), reason, now)
            return
        await self.client.cancel_all_orders(self.product_id)
        result = await self.client.close_position(self.product_id)
        price = float(result.get("average_fill_price") or self._price()) if result else self._price()
        if self.open_trade_id is not None:
            self._record_close(price, reason, now)
        self.emit("order", f"FLATTEN ({reason}) @ {price:.1f}")
        await self._refresh_account()

    def _record_close(self, price: float, reason: str, now: datetime) -> float:
        row = self.store.open_trade_row(self.s.symbol)
        pnl = 0.0
        ist_str = format_ist(now)
        if row:
            d = 1 if row.side == Side.LONG.value else -1
            notional = (row.entry_price + price) * row.size * self.contract_value
            pnl = d * (price - row.entry_price) * row.size * self.contract_value - FEE_RATE * notional
            self.store.close_trade(row.id, price, reason, pnl)
            self.emit("trade", f"CLOSED {row.side.upper()} x{row.size} {row.entry_price:.1f} -> {price:.1f} "
                               f"({reason}) PnL {pnl:+.2f} at {ist_str}", pnl=pnl, reason=reason, time_ist=ist_str)
        self.risk.on_trade_closed(pnl, now)
        self.open_trade_id = None
        self.active_trade = None
        return pnl

    # ---------------- paper trading (DRY_RUN) ----------------
    def _paper_check_stop(self, now: datetime) -> None:
        p = self.paper
        if not p:
            return
        price = self._price()
        long = p["side"] == Side.LONG
        if (long and price <= p["stop"]) or (not long and price >= p["stop"]):
            self._paper_close(p["stop"], "trailing stop" if p["trail"] else "stop loss", now)
        elif p["tp"] and ((long and price >= p["tp"]) or (not long and price <= p["tp"])):
            self._paper_close(p["tp"], "take profit", now)
        elif p["trail"]:
            p["stop"] = max(p["stop"], price - p["trail"]) if long else min(p["stop"], price + p["trail"])

    def _paper_close(self, price: float, reason: str, now: datetime) -> None:
        pnl = self._record_close(price, reason, now)
        self.paper_balance += pnl + FEE_RATE * self.paper["entry"] * self.paper["size"] * self.contract_value
        self.paper = None  # (entry fee was already deducted at entry; _record_close pnl includes both fees)

    # ---------------- snapshot for API / dashboard ----------------
    def snapshot(self) -> dict:
        sig = self.last_signal
        active_stop = None
        active_tp = None
        entry_ist = None
        if self.paper:  # paper stop ratchets with the trail, so it wins over the entry-time value
            active_stop = round(self.paper["stop"], 1)
            active_tp = self.paper.get("tp")
        elif self.active_trade:
            active_stop = self.active_trade.get("stop")
            active_tp = self.active_trade.get("take_profit")
        if self.active_trade:
            entry_ist = self.active_trade.get("entry_time_ist")

        now = datetime.now(timezone.utc)
        return {
            "running": self.running, "dry_run": self.dry_run, "symbol": self.s.symbol,
            "resolution": self.s.resolution, "preset": self.s.preset,
            "strategy": self.strategy.name, "params": self.strategy.params,
            "strategy_display_name": self.strategy.display_name,
            "strategy_summary": self.strategy.summary,
            "available_strategies": LIVE_STRATEGIES,
            "price": self.last_price, "mark_price": self.mark_price,
            "balance": round(self.balance, 4), "equity": round(self.equity, 4),
            "daily_pnl_pct": round(self.risk.daily_pnl_pct(self.equity), 3),
            "position": {
                "side": self._side().value,
                "size": abs(self.position_size),
                "entry_price": self.entry_price,
                "stop": active_stop,
                "take_profit": active_tp,
                "entry_time_ist": entry_ist,
            },
            "checklist": self.checklist,
            "time_ist": format_ist(now),
            "last_signal": None if sig is None else {"side": sig.side.value, "reason": sig.reason,
                                                     "indicators": sig.indicators},
            "last_candle": str(self.last_closed_ts) if self.last_closed_ts is not None else None,
            "risk": {"killed": self.risk.state.killed, "halted_reason": self.risk.state.halted_reason,
                     "trades_today": self.risk.state.trades_today, "max_trades_per_day": self.risk.max_trades_per_day,
                     "daily_loss_limit_pct": self.risk.daily_loss_limit_pct,
                     "risk_per_trade_pct": self.risk.risk_per_trade_pct, "max_leverage": self.risk.max_leverage},
            # 0 until the first risk check of the UTC day -> fall back to current equity (0 P&L, not +100%)
            "day_start_equity": round(self.risk.state.day_start_equity or self.equity, 4),
            "clock_offset": round(self.client.clock_offset, 2),
            "market_ws": bool(self.market and self.market.connected),
            "errors": self.errors, "last_error": self.last_error,
        }
