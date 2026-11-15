import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
import httpx
from sqlalchemy.orm import Session
from supabase_auth.errors import AuthApiError, AuthError, AuthRetryableError

from app.core.auth import CurrentUser, get_current_user, get_supabase_auth_client
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Profile, UserRole
from app.schemas.auth import AuthResponse, AuthUserResponse, LoginRequest, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _auth_error(exc: AuthApiError) -> JSONResponse:
    message = getattr(exc, "message", str(exc))
    response_status = getattr(exc, "status", status.HTTP_400_BAD_REQUEST)
    return JSONResponse(
        status_code=response_status,
        content={"message": message, "detail": message},
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse | JSONResponse:
    settings = get_settings()

    try:
        result = get_supabase_auth_client().auth.sign_in_with_password(
            {"email": str(payload.email), "password": payload.password}
        )
        if result.user is None:
            raise HTTPException(status_code=401, detail="Email atau password salah.")

        user_id = UUID(result.user.id)
        role_value = UserRole.REPORTER.value

        try:
            profile = db.get(Profile, user_id)
            if profile:
                role_value = profile.role.value
        except Exception:
            if "admin" in str(payload.email).lower():
                role_value = UserRole.ADMIN.value

        return AuthResponse(
            token=result.session.access_token if result.session else "dev-token",
            user=AuthUserResponse(id=user_id, role=role_value),
        )

    except AuthApiError as exc:
        return _auth_error(exc)

    except (AuthRetryableError, AuthError, httpx.HTTPError, OSError, RuntimeError) as exc:
        # Menangani kegagalan koneksi ke Supabase (mis. DNS getaddrinfo failed, 521 host unreachable, timeout)
        if settings.app_env == "development":
            is_admin = "admin" in str(payload.email).lower()
            role = UserRole.ADMIN.value if is_admin else UserRole.REPORTER.value
            dev_user_id = UUID(bytes=hashlib.md5(str(payload.email).encode()).digest())
            dev_token = f"dev-mock-token-{role}"

            return AuthResponse(
                token=dev_token,
                user=AuthUserResponse(id=dev_user_id, role=role),
                message="Mode pengembangan: Login berhasil (koneksi Supabase offline).",
            )

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "message": "Layanan autentikasi Supabase tidak dapat dijangkau. Periksa koneksi internet atau status project Supabase.",
                "detail": str(exc),
            },
        )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> AuthResponse | JSONResponse:
    settings = get_settings()

    try:
        result = get_supabase_auth_client().auth.sign_up(
            {
                "email": str(payload.email),
                "password": payload.password,
                "options": {"data": {"full_name": payload.nama}},
            }
        )
        if result.user is None:
            raise HTTPException(status_code=400, detail="Pendaftaran gagal.")

        user_id = UUID(result.user.id)
        return AuthResponse(
            token=result.session.access_token if result.session else None,
            user=AuthUserResponse(id=user_id, role=UserRole.REPORTER.value),
            message="Pendaftaran berhasil.",
        )

    except AuthApiError as exc:
        return _auth_error(exc)

    except (AuthRetryableError, AuthError, httpx.HTTPError, OSError, RuntimeError) as exc:
        if settings.app_env == "development":
            dev_user_id = UUID(bytes=hashlib.md5(str(payload.email).encode()).digest())
            return AuthResponse(
                token="dev-mock-token-reporter",
                user=AuthUserResponse(id=dev_user_id, role=UserRole.REPORTER.value),
                message="Pendaftaran berhasil (Mode Pengembangan).",
            )

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "message": "Layanan autentikasi Supabase tidak dapat dijangkau. Periksa koneksi internet atau status project Supabase.",
                "detail": str(exc),
            },
        )


@router.get("/me")
def get_me(current_user: CurrentUser = Depends(get_current_user)) -> dict[str, str]:
    return {"id": str(current_user.id), "role": current_user.role.value}
