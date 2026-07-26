from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import UnauthorizedError
from app.core.security import decode_token
from app.db.session import get_session
from app.models import User

_bearer = HTTPBearer(auto_error=False)

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)] = None,
) -> User:
    if credentials is None:
        raise UnauthorizedError("Authentication required")

    user_id = decode_token(credentials.credentials, "access")
    user = await session.get(User, user_id)
    if user is None:
        # The token is well-formed but its subject is gone — a deleted account.
        raise UnauthorizedError("Account no longer exists")

    return user


CurrentUser = Annotated[User, Depends(current_user)]
