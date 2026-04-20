import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    username: Mapped[str] = mapped_column(String(100), unique=True)
    hashed_password: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), default="bidder", index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    approved_by: Mapped[str | None] = mapped_column(
        String(36), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow
    )

    profiles: Mapped[list["Profile"]] = relationship(
        back_populates="owner",
        cascade="all, delete-orphan",
        foreign_keys="[Profile.owner_id]",
    )
    shared_profiles: Mapped[list["Profile"]] = relationship(
        secondary="profile_shares", back_populates="shared_with"
    )
    applications: Mapped[list["Application"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
