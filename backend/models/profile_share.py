from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Table

from database import Base

profile_shares = Table(
    "profile_shares",
    Base.metadata,
    Column(
        "profile_id",
        String(36),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "user_id",
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
        index=True,
    ),
    Column("shared_at", DateTime, default=datetime.utcnow),
)
