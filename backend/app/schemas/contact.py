from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class ContactOut(BaseModel):
    user: UserOut
    nickname: str | None


class ContactCreate(BaseModel):
    user_id: str
    nickname: str | None = Field(default=None, max_length=64)
