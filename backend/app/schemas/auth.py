from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.schemas.user import UserOut

PhoneNumber = Annotated[str, Field(pattern=r"^\+[1-9]\d{7,14}$", examples=["+15550100001"])]


class RequestOtpIn(BaseModel):
    phone_e164: PhoneNumber


class RequestOtpOut(BaseModel):
    expires_at: datetime


class VerifyOtpIn(BaseModel):
    phone_e164: PhoneNumber
    code: str = Field(min_length=4, max_length=8)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int


class AuthenticatedOut(BaseModel):
    status: Literal["authenticated"] = "authenticated"
    tokens: TokenPair
    user: UserOut


class RegistrationRequiredOut(BaseModel):
    status: Literal["registration_required"] = "registration_required"
    registration_token: str


VerifyOtpOut = Annotated[
    AuthenticatedOut | RegistrationRequiredOut,
    Field(discriminator="status"),
]


class RegisterIn(BaseModel):
    registration_token: str
    display_name: str = Field(min_length=1, max_length=64)
    username: str | None = Field(
        default=None, min_length=3, max_length=32, pattern=r"^[a-z0-9_.]+$"
    )
    avatar_url: str | None = None


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str
