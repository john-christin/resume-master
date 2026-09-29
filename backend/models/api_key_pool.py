import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class ApiKeyPool(Base):
    __tablename__ = "api_key_pool"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    model_config_id: Mapped[str] = mapped_column(
        ForeignKey("ai_model_configs.id", ondelete="CASCADE"), index=True
    )
    api_key: Mapped[str] = mapped_column(Text)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    model_config: Mapped["AIModelConfig"] = relationship()
