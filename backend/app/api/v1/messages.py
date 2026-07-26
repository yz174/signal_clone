from fastapi import APIRouter

from app.core.deps import BusDep, CurrentUser, SessionDep
from app.schemas.message import MessageOut, ReactionIn
from app.services.message_service import MessageService
from app.services.reaction_service import ReactionService

router = APIRouter(prefix="/messages", tags=["messages"])


@router.delete("/{message_id}", response_model=MessageOut)
async def delete_message(
    message_id: str, user: CurrentUser, session: SessionDep, bus: BusDep
) -> MessageOut:
    message = await MessageService(session, bus).delete(user, message_id)
    return MessageOut.model_validate(message)


@router.put("/{message_id}/reaction", response_model=MessageOut)
async def set_reaction(
    message_id: str,
    payload: ReactionIn,
    user: CurrentUser,
    session: SessionDep,
    bus: BusDep,
) -> MessageOut:
    message = await ReactionService(session, bus).react(user, message_id, payload.emoji)
    return MessageOut.model_validate(message)


@router.delete("/{message_id}/reaction", response_model=MessageOut)
async def clear_reaction(
    message_id: str, user: CurrentUser, session: SessionDep, bus: BusDep
) -> MessageOut:
    message = await ReactionService(session, bus).clear(user, message_id)
    return MessageOut.model_validate(message)
