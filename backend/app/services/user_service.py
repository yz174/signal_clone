from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError
from app.models import User
from app.schemas.user import UserUpdate


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def update_profile(self, user: User, changes: UserUpdate) -> User:
        for field, value in changes.model_dump(exclude_unset=True).items():
            setattr(user, field, value)

        try:
            await self._session.commit()
        except IntegrityError as exc:
            await self._session.rollback()
            raise ConflictError("That username is already taken") from exc

        return user
