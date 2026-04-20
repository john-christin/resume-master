import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class TokenPricing(Base):
    __tablename__ = "token_pricing"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    input_price_per_1k: Mapped[float] = mapped_column(Float, default=0.0)
    output_price_per_1k: Mapped[float] = mapped_column(Float, default=0.0)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    created_by: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
