from fastapi import APIRouter

from app.core.deps import BusDep, CurrentUser, SessionDep
from app.schemas.message import MessageOut
from app.services.message_service import MessageService

router = APIRouter(prefix="/messages", tags=["messages"])


@router.delete("/{message_id}", response_model=MessageOut)
async def delete_message(
    message_id: str, user: CurrentUser, session: SessionDep, bus: BusDep
) -> MessageOut:
    message = await MessageService(session, bus).delete(user, message_id)
    return MessageOut.model_validate(message)
