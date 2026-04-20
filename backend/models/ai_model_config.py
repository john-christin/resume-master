import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class AIModelConfig(Base):
    __tablename__ = "ai_model_configs"
    __table_args__ = (
        Index("ix_ai_model_configs_active_role", "is_active", "role"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    provider: Mapped[str] = mapped_column(String(50))
    display_name: Mapped[str] = mapped_column(String(200))
    model_id: Mapped[str] = mapped_column(String(200))
    api_key: Mapped[str] = mapped_column(Text)
    endpoint: Mapped[str | None] = mapped_column(String(500), nullable=True)
    api_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    input_price_per_1k: Mapped[float] = mapped_column(Float, default=0.0)
    output_price_per_1k: Mapped[float] = mapped_column(Float, default=0.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str | None] = mapped_column(
        String(20), nullable=True, default=None
    )  # "primary" | "utility" | None
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, onupdate=datetime.utcnow
    )
