from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.v1 import api_router
from app.core.config import settings
from app.core.errors import register_error_handlers
from app.core.ratelimit import register_rate_limiting


def create_app() -> FastAPI:
    app = FastAPI(
        title="Signal Clone API",
        version="0.1.0",
        description="Secure messaging platform — REST for durable writes, WebSocket for push.",
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
    app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()
