"""Async REST client for Delta Exchange (India) API v2.

Auth (from docs.delta.exchange):
    signature = HMAC_SHA256(secret, method + timestamp + path + query_string + body)  -> hex
    headers   = api-key, timestamp (unix seconds), signature, User-Agent, Content-Type
A signature is only valid for ~5s, so we keep a server-clock offset (local clocks drift).
"""
import asyncio
import hashlib
import hmac
import json
import logging
import time
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlencode

import httpx

log = logging.getLogger(__name__)

RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class DeltaAPIError(Exception):
    def __init__(self, status: int, error: Any):
        self.status = status
        self.error = error
        super().__init__(f"Delta API {status}: {error}")

    @property
    def code(self) -> str | None:
        return self.error.get("code") if isinstance(self.error, dict) else None


def sign(secret: str, method: str, timestamp: str, path: str, query: str = "", body: str = "") -> str:
    message = method + timestamp + path + query + body
    return hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()


class DeltaClient:
    def __init__(self, base_url: str, api_key: str = "", api_secret: str = "", max_retries: int = 3):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret
        self.max_retries = max_retries
        self.clock_offset = 0.0  # server_time - local_time, in seconds
        self._http = httpx.AsyncClient(base_url=self.base_url, timeout=10.0,
                                       headers={"User-Agent": "tokeniq-bot/0.1 python"})

    async def close(self) -> None:
        await self._http.aclose()

    # ---------- clock sync ----------
    def _update_offset(self, resp: httpx.Response) -> None:
        date = resp.headers.get("date")
        if date:
            # Date header has 1s resolution; +0.5 centres the estimate
            server = parsedate_to_datetime(date).timestamp() + 0.5
            self.clock_offset = server - time.time()

    async def sync_clock(self) -> float:
        for attempt in range(self.max_retries):
            try:
                resp = await self._http.get("/v2/settings", timeout=10.0)
                self._update_offset(resp)
                log.info("Clock offset vs Delta server: %.1fs", self.clock_offset)
                return self.clock_offset
            except Exception as e:
                log.warning("sync_clock attempt %d failed (%s); retrying...", attempt + 1, e)
                if attempt == self.max_retries - 1:
                    log.warning("Could not sync clock with Delta server, falling back to local clock (offset 0.0s)")
                    return 0.0
                await asyncio.sleep(1.0)
        return 0.0

    def _timestamp(self) -> str:
        return str(int(time.time() + self.clock_offset))

    # ---------- core request ----------
    async def request(self, method: str, path: str, params: dict | None = None,
                      body: dict | None = None, auth: bool = False) -> Any:
        method = method.upper()
        query = ("?" + urlencode(params)) if params else ""
        body_str = json.dumps(body, separators=(",", ":")) if body is not None else ""

        for attempt in range(self.max_retries + 1):
            headers = {"Content-Type": "application/json"}
            if auth:
                if not (self.api_key and self.api_secret):
                    raise RuntimeError("Delta API key/secret not configured")
                ts = self._timestamp()  # fresh timestamp on every retry
                headers.update({"api-key": self.api_key, "timestamp": ts,
                                "signature": sign(self.api_secret, method, ts, path, query, body_str)})
            try:
                resp = await self._http.request(method, path + query, content=body_str or None, headers=headers)
            except (httpx.TransportError, httpx.TimeoutException) as e:
                if attempt == self.max_retries:
                    raise
                wait = 2 ** attempt
                log.warning("Network error %s on %s %s, retry in %ss", e, method, path, wait)
                await asyncio.sleep(wait)
                continue

            if auth:
                self._update_offset(resp)  # keep offset fresh for free
            data = resp.json() if resp.content else {}

            if resp.status_code < 400 and data.get("success", True):
                return data.get("result", data)

            error = data.get("error", data)
            err = DeltaAPIError(resp.status_code, error)
            if attempt < self.max_retries:
                if err.code in ("expired_signature", "request_expired"):
                    log.warning("Signature expired, re-syncing clock")
                    await self.sync_clock()
                    continue
                if resp.status_code in RETRYABLE_STATUS:
                    reset_ms = resp.headers.get("X-RATE-LIMIT-RESET")
                    wait = int(reset_ms) / 1000 if reset_ms else 2 ** attempt
                    log.warning("Delta %s on %s %s, retry in %.1fs", resp.status_code, method, path, wait)
                    await asyncio.sleep(wait)
                    continue
            raise err
        raise RuntimeError("unreachable")

    # ---------- public market data ----------
    async def get_product(self, symbol: str) -> dict:
        return await self.request("GET", f"/v2/products/{symbol}")

    async def get_ticker(self, symbol: str) -> dict:
        return await self.request("GET", f"/v2/tickers/{symbol}")

    async def get_tickers(self, contract_types: str = "perpetual_futures") -> list[dict]:
        """Public 24h tickers for every product of the given contract type(s)."""
        return await self.request("GET", "/v2/tickers", params={"contract_types": contract_types})

    async def get_candles(self, symbol: str, resolution: str, start: int, end: int) -> list[dict]:
        """Max 2000 candles per call. Returns newest-first from Delta; we sort oldest-first."""
        rows = await self.request("GET", "/v2/history/candles",
                                  params={"resolution": resolution, "symbol": symbol, "start": start, "end": end})
        return sorted(rows, key=lambda r: r["time"])

    # ---------- private: account ----------
    async def get_balances(self) -> list[dict]:
        return await self.request("GET", "/v2/wallet/balances", auth=True)

    async def get_position(self, product_id: int) -> dict:
        """Real-time position for one product (size is signed: + long, - short)."""
        return await self.request("GET", "/v2/positions", params={"product_id": product_id}, auth=True)

    async def get_open_orders(self, product_id: int) -> list[dict]:
        return await self.request("GET", "/v2/orders", params={"product_id": product_id, "states": "open,pending"},
                                  auth=True)

    async def set_leverage(self, product_id: int, leverage: int) -> dict:
        return await self.request("POST", f"/v2/products/{product_id}/orders/leverage",
                                  body={"leverage": str(leverage)}, auth=True)

    # ---------- private: orders ----------
    async def place_order(self, product_id: int, side: str, size: int, order_type: str = "market_order",
                          limit_price: float | None = None, reduce_only: bool = False,
                          stop_loss: float | None = None, take_profit: float | None = None,
                          trail_amount: float | None = None, client_order_id: str | None = None) -> dict:
        """side: 'buy' | 'sell'. size: number of contracts (BTCUSD: 1 contract = 0.001 BTC).
        stop_loss / trail_amount / take_profit attach exchange-side bracket orders, so protection
        survives if our bot dies. Delta takes either a fixed bracket stop price OR a trail amount."""
        body: dict[str, Any] = {"product_id": product_id, "side": side, "size": int(size),
                                "order_type": order_type, "reduce_only": reduce_only}
        if limit_price is not None:
            body["limit_price"] = str(limit_price)
        if trail_amount is not None:
            # Delta's sign convention: negative for buy entries, positive for sell entries
            body["bracket_trail_amount"] = str(-abs(trail_amount) if side == "buy" else abs(trail_amount))
            body["bracket_stop_trigger_method"] = "mark_price"
        elif stop_loss is not None:
            body["bracket_stop_loss_price"] = str(stop_loss)
            body["bracket_stop_trigger_method"] = "mark_price"
        if take_profit is not None:
            body["bracket_take_profit_price"] = str(take_profit)
        if client_order_id:
            body["client_order_id"] = client_order_id
        return await self.request("POST", "/v2/orders", body=body, auth=True)

    async def place_stop(self, product_id: int, side: str, size: int, stop_price: float) -> dict:
        """Standalone reduce-only stop-market order (used to re-protect a position adopted after restart)."""
        return await self.request("POST", "/v2/orders", body={
            "product_id": product_id, "side": side, "size": int(size), "order_type": "market_order",
            "stop_order_type": "stop_loss_order", "stop_price": str(stop_price),
            "stop_trigger_method": "mark_price", "reduce_only": True}, auth=True)

    async def cancel_order(self, product_id: int, order_id: int) -> dict:
        return await self.request("DELETE", "/v2/orders", body={"id": order_id, "product_id": product_id}, auth=True)

    async def cancel_all_orders(self, product_id: int) -> dict:
        return await self.request("DELETE", "/v2/orders/all",
                                  body={"product_id": product_id, "cancel_limit_orders": True,
                                        "cancel_stop_orders": True, "cancel_reduce_only_orders": True}, auth=True)

    async def close_position(self, product_id: int) -> dict | None:
        """Flatten one product with a reduce-only market order. Returns None if already flat."""
        pos = await self.get_position(product_id)
        size = int(pos.get("size") or 0)
        if size == 0:
            return None
        return await self.place_order(product_id, "sell" if size > 0 else "buy", abs(size), reduce_only=True)
