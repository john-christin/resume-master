import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Experience(Base):
    __tablename__ = "experiences"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    company: Mapped[str] = mapped_column(String(300))
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    start_date: Mapped[str] = mapped_column(String(10))
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    profile: Mapped["Profile"] = relationship(back_populates="experiences")
