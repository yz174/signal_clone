from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1 import api_router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.ratelimit import register_rate_limiting
from app.db.session import SessionFactory
from app.realtime.bus import build_bus
from app.realtime.handler import router as websocket_router
from app.realtime.registry import ConnectionRegistry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    registry = ConnectionRegistry()
    bus = build_bus(settings.event_bus, registry.deliver, settings.redis_url)

    app.state.registry = registry
    app.state.bus = bus
    app.state.session_factory = SessionFactory

    await bus.start()
    try:
        yield
    finally:
        await bus.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Signal Clone API",
        version="0.1.0",
        description="Secure messaging platform. REST for durable writes, WebSocket for push.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    register_rate_limiting(app)

    app.include_router(health_router)
    app.include_router(websocket_router)
    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
