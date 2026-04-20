import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Education(Base):
    __tablename__ = "educations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    school: Mapped[str] = mapped_column(String(300))
    degree: Mapped[str] = mapped_column(String(200))
    field: Mapped[str] = mapped_column(String(200))
    gpa: Mapped[str | None] = mapped_column(String(10), nullable=True)
    start_date: Mapped[str] = mapped_column(String(10))
    end_date: Mapped[str | None] = mapped_column(String(10), nullable=True)

    profile: Mapped["Profile"] = relationship(back_populates="educations")
