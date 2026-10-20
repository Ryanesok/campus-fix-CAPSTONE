from functools import lru_cache

from fastapi import HTTPException, status
from supabase import Client, create_client

from app.core.config import get_settings


@lru_cache
def get_storage_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Penyimpanan foto belum dikonfigurasi.",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def upload_report_photo(path: str, data: bytes, content_type: str) -> None:
    settings = get_settings()
    try:
        get_storage_client().storage.from_(settings.supabase_storage_bucket).upload(
            path,
            data,
            {"content-type": content_type, "upsert": "false"},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Foto laporan gagal disimpan.",
        ) from exc
