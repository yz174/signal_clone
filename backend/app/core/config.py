from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_JWT_SECRET_BYTES = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./signal.db"
    cors_origins: list[str] = ["http://localhost:3000"]

    jwt_secret: str = Field(min_length=MIN_JWT_SECRET_BYTES)
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 30 * 24 * 60 * 60

    mock_otp_code: str = "123456"
    otp_ttl_seconds: int = 5 * 60

    event_bus: Literal["inprocess", "redis"] = "inprocess"
    redis_url: str = "redis://localhost:6379/0"
    typing_ttl_seconds: int = 6


settings = Settings()
