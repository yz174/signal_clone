from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    phone_e164: str
    username: str | None
    display_name: str
    about: str | None
    avatar_url: str | None
    avatar_color: str
    last_seen_at: datetime | None


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=64)
    username: str | None = Field(
        default=None, min_length=3, max_length=32, pattern=r"^[a-z0-9_.]+$"
    )
    about: str | None = Field(default=None, max_length=140)
    avatar_url: str | None = None
