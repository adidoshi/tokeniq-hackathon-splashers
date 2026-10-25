"""Public market-data WebSocket with auto-reconnect.

Fail-safes: heartbeat watchdog (no message for 35s -> reconnect), exponential backoff
(1s, 2s, 4s ... max 30s), and re-subscribe on every new connection.
Node analogy: like a `ws` client with an on('close') -> setTimeout(reconnect) loop.
"""
import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable

import websockets

log = logging.getLogger(__name__)
Handler = Callable[[dict], Awaitable[None]]


class MarketStream:
    def __init__(self, url: str, symbol: str, on_message: Handler):
        self.url = url
        self.symbol = symbol
        self.on_message = on_message
        self.connected = False
        self.last_message_at = 0.0
        self.reconnects = 0
        self._stop = False

    def stop(self) -> None:
        self._stop = True

    async def run(self) -> None:
        backoff = 1
        while not self._stop:
            try:
                async with websockets.connect(self.url, ping_interval=20, open_timeout=10) as ws:
                    await ws.send(json.dumps({"type": "enable_heartbeat"}))
                    await ws.send(json.dumps({"type": "subscribe", "payload": {"channels": [
                        {"name": "ticker", "symbols": [self.symbol]},
                        {"name": "candlestick_1m", "symbols": [self.symbol]},
                    ]}}))
                    self.connected, backoff = True, 1
                    log.info("Market WS connected (%s)", self.url)
                    while not self._stop:
                        raw = await asyncio.wait_for(ws.recv(), timeout=35)  # heartbeat watchdog
                        self.last_message_at = time.time()
                        msg = json.loads(raw)
                        if msg.get("type") not in ("heartbeat", "subscriptions"):
                            await self.on_message(msg)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # network drop, timeout, server close...
                log.warning("Market WS dropped (%s: %s), reconnecting in %ss", type(e).__name__, e, backoff)
            self.connected = False
            if self._stop:
                break
            self.reconnects += 1
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)
