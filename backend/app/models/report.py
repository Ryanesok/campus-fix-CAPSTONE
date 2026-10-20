import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FacilityCategory(str, Enum):
    AC = "AC"
    KURSI = "KURSI"
    LAMPU = "LAMPU"
    PROYEKTOR = "PROYEKTOR"
    LAINNYA = "LAINNYA"


class ReportStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    COMPLETED = "completed"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    photo_path: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_category: Mapped[FacilityCategory | None] = mapped_column(
        SqlEnum(
            FacilityCategory,
            name="facility_category",
            values_callable=lambda enum: [item.value for item in enum],
        )
    )
    final_category: Mapped[FacilityCategory] = mapped_column(
        SqlEnum(
            FacilityCategory,
            name="facility_category",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
    )
    status: Mapped[ReportStatus] = mapped_column(
        SqlEnum(
            ReportStatus,
            name="report_status",
            values_callable=lambda enum: [item.value for item in enum],
        ),
        default=ReportStatus.PENDING,
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    @property
    def category(self) -> FacilityCategory:
        return self.final_category

    @property
    def photo_url(self) -> str:
        return ""
