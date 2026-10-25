"""SQLite persistence for trades and events (audit trail for the demo + restart recovery).

SQLModel = Pydantic models that are also DB tables (Node analogy: Prisma/Drizzle models).
"""
import json
from datetime import datetime, timezone

from sqlmodel import Field, Session, SQLModel, create_engine, select


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TradeRow(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    symbol: str
    side: str
    size: int
    entry_time: datetime
    entry_price: float
    entry_reason: str = ""
    exit_time: datetime | None = None
    exit_price: float | None = None
    exit_reason: str = ""
    pnl: float | None = None
    dry_run: bool = True
    order_id: str = ""


class EventRow(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    ts: datetime
    kind: str  # system | signal | order | trade | risk | error
    message: str
    data: str = "{}"


class Store:
    def __init__(self, url: str = "sqlite:///tokeniq.db"):
        self.engine = create_engine(url, connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(self.engine)

    def add_event(self, kind: str, message: str, data: dict | None = None) -> None:
        with Session(self.engine) as s:
            s.add(EventRow(ts=utcnow(), kind=kind, message=message, data=json.dumps(data or {}, default=str)))
            s.commit()

    def open_trade(self, **fields) -> int:
        with Session(self.engine) as s:
            row = TradeRow(entry_time=utcnow(), **fields)
            s.add(row)
            s.commit()
            return row.id

    def close_trade(self, trade_id: int, exit_price: float, exit_reason: str, pnl: float) -> TradeRow | None:
        with Session(self.engine) as s:
            row = s.get(TradeRow, trade_id)
            if row is None:
                return None
            row.exit_time, row.exit_price, row.exit_reason, row.pnl = utcnow(), exit_price, exit_reason, round(pnl, 4)
            s.add(row)
            s.commit()
            s.refresh(row)
            return row

    def open_trade_row(self, symbol: str) -> TradeRow | None:
        with Session(self.engine) as s:
            return s.exec(select(TradeRow).where(TradeRow.symbol == symbol, TradeRow.exit_time == None)  # noqa: E711
                          .order_by(TradeRow.id.desc())).first()

    def recent_trades(self, limit: int = 50) -> list[TradeRow]:
        with Session(self.engine) as s:
            return list(s.exec(select(TradeRow).order_by(TradeRow.id.desc()).limit(limit)))

    def recent_events(self, limit: int = 100) -> list[EventRow]:
        with Session(self.engine) as s:
            return list(s.exec(select(EventRow).order_by(EventRow.id.desc()).limit(limit)))
