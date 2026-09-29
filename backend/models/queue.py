import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class QueueTask(Base):
    __tablename__ = "queue_tasks"
    __table_args__ = (
        Index("ix_queue_tasks_user_status", "user_id", "status"),
        Index("ix_queue_tasks_user_order", "user_id", "order", "created_at"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    profile_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    doc_style_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("doc_styles.id", ondelete="SET NULL"), nullable=True
    )
    job_source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    job_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    company: Mapped[str | None] = mapped_column(String(300), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    job_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # status: queued | processing | needs_review | approved | completed | failed | skipped
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    warnings: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    application_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("applications.id", ondelete="SET NULL"), nullable=True
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_api_key_pool_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("api_key_pool.id", ondelete="SET NULL"), nullable=True
    )
    used_key_label: Mapped[str | None] = mapped_column(String(100), nullable=True)

    user: Mapped["User"] = relationship(back_populates="queue_tasks")
    profile: Mapped["Profile | None"] = relationship(foreign_keys=[profile_id])
    application: Mapped["Application | None"] = relationship(foreign_keys=[application_id])
