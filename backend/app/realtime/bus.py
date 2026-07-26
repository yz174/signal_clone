import asyncio
import contextlib
import logging
from collections.abc import Awaitable, Callable
from typing import Protocol

from redis.asyncio import Redis
from redis.asyncio.client import PubSub

from app.realtime.events import Event

Deliver = Callable[[Event], Awaitable[None]]

logger = logging.getLogger(__name__)

REDIS_CHANNEL = "signal.events"


class EventBus(Protocol):
    async def start(self) -> None: ...

    async def stop(self) -> None: ...

    async def publish(self, event: Event) -> None: ...


class InProcessBus:
    def __init__(self, deliver: Deliver) -> None:
        self._deliver = deliver

    async def start(self) -> None:
        return None

    async def stop(self) -> None:
        return None

    async def publish(self, event: Event) -> None:
        await self._deliver(event)


class RedisBus:
    def __init__(self, deliver: Deliver, redis_url: str) -> None:
        self._deliver = deliver
        self._redis: Redis = Redis.from_url(redis_url, decode_responses=True)
        self._reader: asyncio.Task[None] | None = None

    async def start(self) -> None:
        pubsub = self._redis.pubsub()
        await pubsub.subscribe(REDIS_CHANNEL)
        self._reader = asyncio.create_task(self._consume(pubsub))

    async def stop(self) -> None:
        if self._reader is not None:
            self._reader.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._reader
        await self._redis.aclose()

    async def publish(self, event: Event) -> None:
        await self._redis.publish(REDIS_CHANNEL, event.serialise())

    async def _consume(self, pubsub: PubSub) -> None:
        logger.info("redis subscriber listening on %s", REDIS_CHANNEL)
        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    await self._deliver(Event.deserialise(message["data"]))
                except Exception:
                    logger.exception("failed to deliver an event from redis")
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("redis subscriber stopped; realtime fanout is now degraded")
            raise


def build_bus(kind: str, deliver: Deliver, redis_url: str) -> EventBus:
    return RedisBus(deliver, redis_url) if kind == "redis" else InProcessBus(deliver)
