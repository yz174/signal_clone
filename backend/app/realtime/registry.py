import asyncio
from collections import defaultdict

from fastapi import WebSocket

from app.realtime.events import Event


class ConnectionRegistry:
    def __init__(self) -> None:
        self._sockets: dict[str, set[WebSocket]] = defaultdict(set)

    def add(self, user_id: str, socket: WebSocket) -> bool:
        first = not self._sockets[user_id]
        self._sockets[user_id].add(socket)
        return first

    def remove(self, user_id: str, socket: WebSocket) -> bool:
        self._sockets[user_id].discard(socket)
        if not self._sockets[user_id]:
            del self._sockets[user_id]
            return True
        return False

    def is_online(self, user_id: str) -> bool:
        return user_id in self._sockets

    async def deliver(self, event: Event) -> None:
        frame = event.for_client()
        targets = [
            socket
            for user_id in event.recipients
            for socket in tuple(self._sockets.get(user_id, ()))
        ]
        if not targets:
            return

        results = await asyncio.gather(
            *(socket.send_json(frame) for socket in targets), return_exceptions=True
        )
        for socket, result in zip(targets, results, strict=True):
            if isinstance(result, BaseException):
                self._drop(socket)

    def _drop(self, socket: WebSocket) -> None:
        for user_id, sockets in list(self._sockets.items()):
            sockets.discard(socket)
            if not sockets:
                del self._sockets[user_id]
