from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.config import get_settings
from app.db.session import get_db
from app.models import FacilityCategory, Report, ReportStatus, UserRole
from app.schemas.report import ReportResponse, ReportStatusUpdate, validate_report_text
from app.services.storage import upload_report_photo

router = APIRouter(prefix="/api", tags=["reports"])
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
IMAGE_SIGNATURES = (b"\xff\xd8\xff", b"\x89PNG\r\n\x1a\n")
CATEGORY_ALIASES = {
    "ac": FacilityCategory.AC,
    "kursi": FacilityCategory.KURSI,
    "lampu": FacilityCategory.LAMPU,
    "proyektor": FacilityCategory.PROYEKTOR,
    "lainnya": FacilityCategory.LAINNYA,
}


def _is_allowed_image(data: bytes) -> bool:
    return data.startswith(IMAGE_SIGNATURES) or (
        data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    )


def _get_report_or_404(report_id: UUID, db: Session) -> Report:
    report = db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Laporan tidak ditemukan.")
    return report


def _parse_category(value: str, field_name: str) -> FacilityCategory:
    category = CATEGORY_ALIASES.get(value.strip().casefold())
    if category is None:
        allowed = ", ".join(item.value for item in FacilityCategory)
        raise HTTPException(
            status_code=422,
            detail=f"{field_name} tidak valid. Pilih salah satu: {allowed}.",
        )
    return category


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    photo: UploadFile = File(...),
    location: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    ai_category: str | None = Form(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Report:
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Format foto harus JPEG, PNG, atau WebP.")

    settings = get_settings()
    data = await photo.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"Ukuran foto maksimal {settings.max_upload_mb} MB.")
    if not _is_allowed_image(data):
        raise HTTPException(status_code=415, detail="Isi foto tidak valid.")

    try:
        clean_location = validate_report_text(location, "Lokasi", 255)
        clean_description = validate_report_text(description, "Deskripsi", 5000)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    final_category = _parse_category(category, "Kategori")
    parsed_ai_category = _parse_category(ai_category, "Kategori AI") if ai_category else None

    report_id = uuid4()
    extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[photo.content_type]
    photo_path = f"{current_user.id}/{report_id}.{extension}"
    upload_report_photo(photo_path, data, photo.content_type)

    report = Report(
        id=report_id,
        reporter_id=current_user.id,
        photo_path=photo_path,
        location=clean_location,
        description=clean_description,
        ai_category=parsed_ai_category,
        final_category=final_category,
        status=ReportStatus.PENDING,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.get("/reports/me", response_model=list[ReportResponse])
def get_my_reports(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Report]:
    return list(
        db.scalars(
            select(Report)
            .where(Report.reporter_id == current_user.id)
            .order_by(Report.created_at.desc())
        )
    )


@router.get("/admin/reports", response_model=list[ReportResponse])
def get_admin_reports(
    _admin: CurrentUser = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> list[Report]:
    return list(db.scalars(select(Report).order_by(Report.created_at.desc())))


@router.patch("/admin/reports/{report_id}/status", response_model=ReportResponse)
def update_report_status(
    report_id: UUID,
    update: ReportStatusUpdate,
    _admin: CurrentUser = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
) -> Report:
    report = _get_report_or_404(report_id, db)
    allowed_transitions = {
        ReportStatus.PENDING: {ReportStatus.ACCEPTED, ReportStatus.REJECTED},
        ReportStatus.ACCEPTED: {ReportStatus.COMPLETED},
        ReportStatus.REJECTED: set(),
        ReportStatus.COMPLETED: set(),
    }
    if update.status not in allowed_transitions[report.status]:
        raise HTTPException(
            status_code=409,
            detail=f"Status {report.status.value} tidak dapat diubah menjadi {update.status.value}.",
        )
    report.status = update.status
    report.admin_note = update.admin_note
    db.commit()
    db.refresh(report)
    return report
