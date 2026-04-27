import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class SystemLog(Base):
    __tablename__ = "system_logs"
    __table_args__ = (
        Index("ix_system_logs_level", "level"),
        Index("ix_system_logs_category", "category"),
        Index("ix_system_logs_user_id", "user_id"),
        Index("ix_system_logs_created_at", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    level: Mapped[str] = mapped_column(String(10))          # INFO | WARNING | ERROR | CRITICAL
    category: Mapped[str] = mapped_column(String(20))       # api | ai_call | generation | auth | admin
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # IPv4 or IPv6
    endpoint: Mapped[str | None] = mapped_column(String(200), nullable=True)
    message: Mapped[str] = mapped_column(Text)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    error_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
