from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    nama: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6)
    role: str | None = None


class AuthUserResponse(BaseModel):
    id: UUID
    role: str


class AuthResponse(BaseModel):
    token: str | None
    user: AuthUserResponse
    message: str | None = None
