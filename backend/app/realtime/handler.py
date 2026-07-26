from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.errors import AppError
from app.core.security import decode_token
from app.models import User
from app.realtime.bus import EventBus
from app.realtime.events import Event, EventType
from app.services.membership import require_membership
from app.services.message_service import MessageService
from app.services.presence_service import PresenceService

if TYPE_CHECKING:
    from app.realtime.registry import ConnectionRegistry

router = APIRouter()

SessionFactory = async_sessionmaker[AsyncSession]


async def _identify(websocket: WebSocket, sessions: SessionFactory) -> str | None:
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        return decode_token(token, "access")
    except AppError:
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    sessions: SessionFactory = websocket.app.state.session_factory
    registry: ConnectionRegistry = websocket.app.state.registry
    bus: EventBus = websocket.app.state.bus

    user_id = await _identify(websocket, sessions)
    if user_id is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    async with sessions() as session:
        user = await session.get(User, user_id)
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await websocket.accept()

    if registry.add(user_id, websocket):
        await _announce(sessions, bus, user_id, is_online=True)

    try:
        while True:
            frame = await websocket.receive_json()
            await _handle_frame(frame, user_id, sessions, bus)
    except WebSocketDisconnect:
        pass
    finally:
        if registry.remove(user_id, websocket):
            await _announce(sessions, bus, user_id, is_online=False)


async def _announce(
    sessions: SessionFactory, bus: EventBus, user_id: str, is_online: bool
) -> None:
    async with sessions() as session:
        user = await session.get(User, user_id)
        if user is not None:
            await PresenceService(session, bus).announce(user, is_online=is_online)


async def _handle_frame(
    frame: dict[str, Any], user_id: str, sessions: SessionFactory, bus: EventBus
) -> None:
    kind = frame.get("type")

    if kind == "typing":
        await _broadcast_typing(frame, user_id, sessions, bus)
    elif kind == "ack.delivered":
        await _acknowledge(frame, user_id, sessions, bus)


async def _broadcast_typing(
    frame: dict[str, Any], user_id: str, sessions: SessionFactory, bus: EventBus
) -> None:
    conversation_id = frame.get("conversation_id")
    if not isinstance(conversation_id, str):
        return

    async with sessions() as session:
        try:
            await require_membership(session, conversation_id, user_id)
        except AppError:
            return

        peers = await MessageService(session).peer_ids(conversation_id, user_id)

    if not peers:
        return

    await bus.publish(
        Event(
            type=EventType.TYPING_UPDATED,
            payload={
                "conversation_id": conversation_id,
                "user_id": user_id,
                "is_typing": bool(frame.get("is_typing")),
            },
            recipients=peers,
        )
    )


async def _acknowledge(
    frame: dict[str, Any], user_id: str, sessions: SessionFactory, bus: EventBus
) -> None:
    conversation_id = frame.get("conversation_id")
    seq = frame.get("seq")
    if not isinstance(conversation_id, str) or not isinstance(seq, int):
        return

    async with sessions() as session:
        user = await session.get(User, user_id)
        if user is None:
            return
        try:
            await MessageService(session, bus).mark_delivered(user, conversation_id, seq)
        except AppError:
            return
