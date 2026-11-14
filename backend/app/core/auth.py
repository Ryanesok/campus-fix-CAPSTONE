from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import httpx
from sqlalchemy.orm import Session
from supabase import Client, create_client
from supabase_auth.errors import AuthApiError, AuthError, AuthRetryableError

from app.core.config import get_settings
from app.db.session import get_db
from app.models import Profile, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    role: UserRole


@lru_cache
def get_supabase_auth_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError("Supabase Auth belum dikonfigurasi.")
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi diperlukan.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    settings = get_settings()
    token = credentials.credentials

    # Mendukung pengujian dev/dummy token saat Supabase offline di lingkungan development
    if settings.app_env == "development":
        if token == "dummy-token" or token.startswith("dev-mock-token-") or token == "dev-token":
            role = UserRole.ADMIN if "admin" in token else UserRole.REPORTER
            return CurrentUser(id=UUID("00000000-0000-0000-0000-000000000001"), role=role)

    try:
        response = get_supabase_auth_client().auth.get_user(token)
    except AuthApiError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak valid.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (AuthRetryableError, AuthError, httpx.HTTPError, OSError) as exc:
        if settings.app_env == "development":
            return CurrentUser(id=UUID("00000000-0000-0000-0000-000000000001"), role=UserRole.REPORTER)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Layanan autentikasi Supabase tidak dapat dijangkau.",
        ) from exc

    if response.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token autentikasi tidak valid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(response.user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identitas user tidak valid.",
        ) from exc

    profile = None
    try:
        profile = db.get(Profile, user_id)
    except Exception:
        if settings.app_env == "development":
            return CurrentUser(id=user_id, role=UserRole.REPORTER)

    if profile is None:
        if settings.app_env == "development":
            return CurrentUser(id=user_id, role=UserRole.REPORTER)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile user belum tersedia.")

    return CurrentUser(id=user_id, role=profile.role)


def require_role(role: UserRole):
    def dependency(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role is not role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses tidak diizinkan.")
        return current_user

    return dependency
