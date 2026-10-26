import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Certification(Base):
    __tablename__ = "certifications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(300))
    issuer: Mapped[str | None] = mapped_column(String(300), nullable=True)
    issue_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    expiry_date: Mapped[str | None] = mapped_column(String(50), nullable=True)

    profile: Mapped["Profile"] = relationship(back_populates="certifications")
