import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        Index("ix_applications_user_profile", "user_id", "profile_id"),
        Index("ix_applications_profile_company", "profile_id", "company"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    profile_name: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    job_title: Mapped[str] = mapped_column(String(300))
    company: Mapped[str | None] = mapped_column(String(300), nullable=True, index=True)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    job_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    job_description: Mapped[str] = mapped_column(Text)
    resume_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tailored_bullets: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_letter_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_letter_path: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    user: Mapped["User"] = relationship(back_populates="applications")
    profile: Mapped["Profile | None"] = relationship()
