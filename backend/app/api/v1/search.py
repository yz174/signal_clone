from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, SessionDep
from app.schemas.message import MessageOut
from app.schemas.search import ConversationHitOut, MessageHitOut, SearchResultsOut
from app.schemas.user import UserOut
from app.services.search_service import SearchService

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResultsOut)
async def search(
    user: CurrentUser,
    session: SessionDep,
    q: str = Query(min_length=1, max_length=100),
) -> SearchResultsOut:
    results = await SearchService(session).search(user, q)

    return SearchResultsOut(
        contacts=[UserOut.model_validate(contact) for contact in results.contacts],
        conversations=[
            ConversationHitOut(id=hit.id, title=hit.title, type=hit.type)
            for hit in results.conversations
        ],
        messages=[
            MessageHitOut(
                message=MessageOut.model_validate(hit.message),
                conversation_id=hit.conversation_id,
                conversation_title=hit.conversation_title,
            )
            for hit in results.messages
        ],
    )
