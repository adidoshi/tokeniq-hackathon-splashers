"""FastAPI entry point.

Node analogy: this is your `server.ts` with Express/Fastify. `lifespan` is the place for
startup/shutdown work (like `app.listen` callback + SIGTERM handler).
Run: uv run uvicorn app.main:app --reload
"""
import asyncio
import contextlib
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes, stream
from app.config import get_settings
from app.delta.client import DeltaClient
from app.delta.ws import MarketStream
from app.engine import Engine
from app.store import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # hide per-request noise
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = DeltaClient(settings.delta_base_url, settings.delta_api_key, settings.delta_api_secret)
    try:
        await client.sync_clock()
    except Exception as e:
        logging.getLogger("delta.client").warning("Startup sync_clock failed: %s; using local time", e)
    engine = Engine(settings, client, Store(settings.db_url))
    await engine.setup()
    market = MarketStream(settings.delta_ws_public_url, settings.symbol, engine.on_market_message)
    market_task = asyncio.create_task(market.run())
    app.state.engine, app.state.market = engine, market
    engine.market = market
    if settings.auto_start:
        await engine.start()
    yield
    # graceful shutdown: stop loops (exchange-side stops keep protecting any open position)
    await engine.stop()
    market.stop()
    market_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await market_task
    await client.close()


app = FastAPI(title="TokenIQ Algo Bot", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_origin_regex=settings.cors_origin_regex,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(routes.router)
app.include_router(stream.router)


@app.get("/health")
async def health():
    market = app.state.market
    return {"ok": True, "time": time.time(), "dry_run": app.state.engine.dry_run, "symbol": settings.symbol,
            "running": app.state.engine.running, "market_ws": market.connected, "ws_reconnects": market.reconnects}


@app.get("/")
async def root():
    """The dashboard is the Next.js app in frontend/; this API has docs at /docs."""
    return {"service": "TokenIQ bot API", "docs": "/docs", "health": "/health", "dashboard": "frontend (Next.js)"}
