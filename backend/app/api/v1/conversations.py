from fastapi import APIRouter, Query, Response, status

from app.core.deps import BusDep, CurrentUser, SessionDep
from app.schemas.conversation import (
    AddMembersIn,
    ConversationCreate,
    ConversationOut,
    ConversationPageOut,
    ConversationUpdate,
    DirectConversationIn,
    MemberOut,
    SetRoleIn,
)
from app.schemas.message import (
    MessageCreate,
    MessageOut,
    MessagePageOut,
    ReadReceiptIn,
    ReceiptOut,
)
from app.services.conversation_service import (
    MAX_PAGE_SIZE,
    ConversationService,
    ConversationView,
)
from app.services.message_service import MessageService

router = APIRouter(prefix="/conversations", tags=["conversations"])

MAX_MESSAGE_PAGE_SIZE = 100


def to_out(view: ConversationView) -> ConversationOut:
    conversation = view.conversation
    return ConversationOut(
        id=conversation.id,
        type=conversation.type,
        name=conversation.name,
        description=conversation.description,
        avatar_url=conversation.avatar_url,
        last_activity_at=conversation.last_activity_at,
        last_seq=conversation.last_seq,
        disappear_seconds=conversation.disappear_seconds,
        members=[MemberOut.model_validate(member) for member in conversation.members],
        unread_count=view.unread_count,
        last_message=MessageOut.model_validate(view.last_message) if view.last_message else None,
    )


@router.get("", response_model=ConversationPageOut)
async def list_conversations(
    user: CurrentUser,
    session: SessionDep,
    cursor: str | None = None,
    limit: int = Query(default=30, ge=1, le=MAX_PAGE_SIZE),
) -> ConversationPageOut:
    page = await ConversationService(session).list_for_user(user, cursor, limit)
    return ConversationPageOut(
        items=[to_out(view) for view in page.items], next_cursor=page.next_cursor
    )


@router.post("", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreate, user: CurrentUser, session: SessionDep
) -> ConversationOut:
    service = ConversationService(session)
    if isinstance(payload, DirectConversationIn):
        view = await service.create_direct(user, payload.user_id)
    else:
        view = await service.create_group(
            user, payload.name, payload.member_ids, payload.description
        )
    return to_out(view)


@router.get("/{conversation_id}", response_model=ConversationOut)
async def read_conversation(
    conversation_id: str, user: CurrentUser, session: SessionDep
) -> ConversationOut:
    return to_out(await ConversationService(session).get(user, conversation_id))


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdate,
    user: CurrentUser,
    session: SessionDep,
) -> ConversationOut:
    return to_out(await ConversationService(session).update(user, conversation_id, payload))


@router.get("/{conversation_id}/members", response_model=list[MemberOut])
async def list_members(
    conversation_id: str, user: CurrentUser, session: SessionDep
) -> list[MemberOut]:
    view = await ConversationService(session).get(user, conversation_id)
    return [MemberOut.model_validate(member) for member in view.conversation.members]


@router.post("/{conversation_id}/members", response_model=ConversationOut)
async def add_members(
    conversation_id: str, payload: AddMembersIn, user: CurrentUser, session: SessionDep
) -> ConversationOut:
    view = await ConversationService(session).add_members(user, conversation_id, payload.user_ids)
    return to_out(view)


@router.patch("/{conversation_id}/members/{member_id}", response_model=ConversationOut)
async def set_member_role(
    conversation_id: str,
    member_id: str,
    payload: SetRoleIn,
    user: CurrentUser,
    session: SessionDep,
) -> ConversationOut:
    view = await ConversationService(session).set_role(
        user, conversation_id, member_id, payload.role
    )
    return to_out(view)


@router.delete("/{conversation_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: str, member_id: str, user: CurrentUser, session: SessionDep
) -> Response:
    service = ConversationService(session)
    if member_id == user.id:
        await service.leave(user, conversation_id)
    else:
        await service.remove_member(user, conversation_id, member_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{conversation_id}/messages", response_model=MessagePageOut)
async def list_messages(
    conversation_id: str,
    user: CurrentUser,
    session: SessionDep,
    before_seq: int | None = Query(default=None, ge=1),
    after_seq: int | None = Query(default=None, ge=0),
    limit: int = Query(default=50, ge=1, le=MAX_MESSAGE_PAGE_SIZE),
) -> MessagePageOut:
    page = await MessageService(session).list_for_conversation(
        user, conversation_id, before_seq, after_seq, limit
    )
    return MessagePageOut(
        items=[MessageOut.model_validate(message) for message in page.items],
        has_more=page.has_more,
    )


@router.post(
    "/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    conversation_id: str,
    payload: MessageCreate,
    user: CurrentUser,
    session: SessionDep,
    bus: BusDep,
) -> MessageOut:
    message = await MessageService(session, bus).send(
        user,
        conversation_id,
        payload.client_message_id,
        payload.body,
        payload.reply_to_id,
        payload.attachment_ids,
    )
    return MessageOut.model_validate(message)


@router.post("/{conversation_id}/read", response_model=ReceiptOut)
async def mark_read(
    conversation_id: str,
    payload: ReadReceiptIn,
    user: CurrentUser,
    session: SessionDep,
    bus: BusDep,
) -> ReceiptOut:
    member = await MessageService(session, bus).mark_read(user, conversation_id, payload.seq)
    return ReceiptOut.model_validate(member)


@router.post("/{conversation_id}/delivered", response_model=ReceiptOut)
async def mark_delivered(
    conversation_id: str,
    payload: ReadReceiptIn,
    user: CurrentUser,
    session: SessionDep,
    bus: BusDep,
) -> ReceiptOut:
    member = await MessageService(session, bus).mark_delivered(user, conversation_id, payload.seq)
    return ReceiptOut.model_validate(member)
