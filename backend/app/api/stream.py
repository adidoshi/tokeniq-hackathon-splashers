"""WebSocket feed for the dashboard: pushes engine events live + a status snapshot every 2s.

Node analogy: a `ws` server where each client gets its own queue (pub/sub fan-out).
"""
import asyncio
import contextlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws")
async def ws_feed(ws: WebSocket):
    await ws.accept()
    engine = ws.app.state.engine
    queue: asyncio.Queue = asyncio.Queue(maxsize=500)
    engine.listeners.add(queue)

    async def push_status():
        while True:
            await ws.send_json({"kind": "status", "data": engine.snapshot()})
            await asyncio.sleep(2)

    status_task = asyncio.create_task(push_status())
    try:
        await ws.send_json({"kind": "history", "data": list(engine.events)})
        while True:
            await ws.send_json(await queue.get())
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        engine.listeners.discard(queue)
        status_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await status_task
