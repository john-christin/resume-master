import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    profile_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True
    )
    profile_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # pending → running → completed | partial | failed
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)

    total_jobs: Mapped[int] = mapped_column(Integer)
    completed_jobs: Mapped[int] = mapped_column(Integer, default=0)
    failed_jobs: Mapped[int] = mapped_column(Integer, default=0)

    # JSON array of JobDescriptionEntry dicts
    jobs_input: Mapped[str] = mapped_column(Text)
    # JSON int array — indices of sub-jobs that already completed (crash recovery)
    completed_job_indices: Mapped[str] = mapped_column(Text, default="[]")
    # JSON array of {index, job_title, error} dicts
    error_details: Mapped[str | None] = mapped_column(Text, nullable=True)

    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    total_prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_completion_tokens: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
