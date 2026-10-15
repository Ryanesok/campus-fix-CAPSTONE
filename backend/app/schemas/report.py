from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models import FacilityCategory, ReportStatus


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reporter_id: UUID
    photo_path: str
    location: str
    description: str
    ai_category: FacilityCategory | None
    final_category: FacilityCategory
    status: ReportStatus
    created_at: datetime
    updated_at: datetime


class ReportStatusUpdate(BaseModel):
    status: ReportStatus


def validate_report_text(value: str, field_name: str, max_length: int) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field_name} tidak boleh kosong.")
    if len(value) > max_length:
        raise ValueError(f"{field_name} maksimal {max_length} karakter.")
    return value
