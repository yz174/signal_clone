from fastapi import APIRouter

from app.core.deps import CurrentUser, SessionDep
from app.schemas.user import UserOut, UserUpdate
from app.services.user_service import UserService

router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserOut)
async def read_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/users/me", response_model=UserOut)
async def update_me(payload: UserUpdate, user: CurrentUser, session: SessionDep) -> UserOut:
    updated = await UserService(session).update_profile(user, payload)
    return UserOut.model_validate(updated)
