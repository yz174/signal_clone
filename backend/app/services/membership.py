from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.models import ConversationMember


async def require_membership(
    session: AsyncSession, conversation_id: str, user_id: str
) -> ConversationMember:
    member = await session.get(
        ConversationMember, {"conversation_id": conversation_id, "user_id": user_id}
    )
    if member is None or member.left_at is not None:
        raise NotFoundError("Conversation not found")
    return member
