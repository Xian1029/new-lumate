"""Auth request/response schemas."""

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")
    password: str = Field(..., min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(default="", max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: "UserResponse | None" = None


class UserResponse(BaseModel):
    id: str
    email: str | None
    name: str
    username: str | None = None
    role: str = "student"
    must_change_password: bool = False
    can_create_courses: bool = True
    max_courses: int | None = None
    ai_key_mode: str = "auto"

    model_config = {"from_attributes": True}
