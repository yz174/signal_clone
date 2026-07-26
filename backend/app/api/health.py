from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness: the process is up. Deliberately touches no dependencies."""
    return HealthResponse(status="ok")


@router.get("/ready", response_model=HealthResponse)
async def ready(session: AsyncSession = Depends(get_session)) -> HealthResponse:
    """Readiness: the process can serve traffic, which requires a reachable database."""
    await session.execute(text("SELECT 1"))
    return HealthResponse(status="ready")
