import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Call(Base):
    __tablename__ = "calls"
    __table_args__ = (
        UniqueConstraint("application_id", name="uq_calls_application_id"),
        Index("ix_calls_application_id", "application_id"),
        Index("ix_calls_stage", "stage"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    application_id: Mapped[str] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    stage: Mapped[str] = mapped_column(String(60), nullable=False)
    # phone_interview | intro_interview | hr_interview | technical_interview_1 | technical_interview_2 | final_interview
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")
    # scheduled | pending | passed | failed | cancelled
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    recording_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    with_whom: Mapped[str | None] = mapped_column(String(200), nullable=True)
    interviewer_role: Mapped[str | None] = mapped_column(String(200), nullable=True)
    call_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # video | phone
    call_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    stage_statuses: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON dict mapping stage -> status, e.g. {"phone_interview": "passed"}
    is_closed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    application: Mapped["Application"] = relationship(back_populates="call")
