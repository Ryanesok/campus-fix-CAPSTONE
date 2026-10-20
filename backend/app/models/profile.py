import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserRole(str, Enum):
    REPORTER = "reporter"
    ADMIN = "admin"


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("auth.users.id", ondelete="CASCADE"), primary_key=True
    )
    full_name: Mapped[str | None] = mapped_column(String(120))
    role: Mapped[UserRole] = mapped_column(
        SqlEnum(UserRole, name="user_role", values_callable=lambda enum: [item.value for item in enum]),
        default=UserRole.REPORTER,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
