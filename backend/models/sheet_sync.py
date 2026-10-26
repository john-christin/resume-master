import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SheetSyncJob(Base):
    """One pending write to a profile's Google Sheet (outbox row, retried until it lands)."""

    __tablename__ = "sheet_sync_jobs"
    __table_args__ = (Index("ix_sheet_sync_status_created", "status", "created_at"),)

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    # "add_row" inserts a job; "update_row" patches fields on a row found by its links
    op: Mapped[str] = mapped_column(String(20))
    # add_row: full job fields. update_row: {"match": {...}, "fields": {...}}
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(10), default="pending")  # pending | done | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    done_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
