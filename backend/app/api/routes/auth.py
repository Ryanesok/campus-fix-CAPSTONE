from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from supabase_auth.errors import AuthApiError
from sqlalchemy.orm import Session

from app.core.auth import CurrentUser, get_current_user
from app.core.auth import get_supabase_auth_client
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
    try:
        result = get_supabase_auth_client().auth.sign_in_with_password(
            {"email": str(payload.email), "password": payload.password}
        )
    except AuthApiError as exc:
        return _auth_error(exc)

    if result.user is None:
        raise HTTPException(status_code=401, detail="Email atau password salah.")

    profile = db.get(Profile, result.user.id)
    if profile is None:
        raise HTTPException(status_code=403, detail="Profile user belum tersedia.")

    return AuthResponse(
        token=result.session.access_token if result.session else None,
        user=AuthUserResponse(id=result.user.id, role=profile.role.value),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest) -> AuthResponse | JSONResponse:
    try:
        result = get_supabase_auth_client().auth.sign_up(
            {
                "email": str(payload.email),
                "password": payload.password,
                "options": {"data": {"full_name": payload.nama}},
            }
        )
    except AuthApiError as exc:
        return _auth_error(exc)

    if result.user is None:
        raise HTTPException(status_code=400, detail="Pendaftaran gagal.")

    return AuthResponse(
        token=result.session.access_token if result.session else None,
        user=AuthUserResponse(id=result.user.id, role=UserRole.REPORTER.value),
        message="Pendaftaran berhasil.",
    )


@router.get("/me")
def get_me(current_user: CurrentUser = Depends(get_current_user)) -> dict[str, str]:
    return {"id": str(current_user.id), "role": current_user.role.value}
