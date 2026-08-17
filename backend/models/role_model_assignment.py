from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class RoleModelAssignment(Base):
    """Maps a fixed task role to whichever model currently serves it.

    `role` as the primary key enforces one model per role, but places no
    constraint on how many roles point at the same `ai_model_config_id` —
    that's what lets one model serve multiple roles at once.
    """

    __tablename__ = "role_model_assignments"

    role: Mapped[str] = mapped_column(String(20), primary_key=True)
    ai_model_config_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_model_configs.id", ondelete="CASCADE")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
