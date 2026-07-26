from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_JWT_SECRET_BYTES = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite+aiosqlite:///./signal.db"
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    jwt_secret: str = Field(min_length=MIN_JWT_SECRET_BYTES)
    jwt_algorithm: str = "HS256"
    access_token_ttl_seconds: int = 15 * 60
    refresh_token_ttl_seconds: int = 30 * 24 * 60 * 60

    mock_otp_code: str = "123456"
    otp_ttl_seconds: int = 5 * 60

    event_bus: Literal["inprocess", "redis"] = "inprocess"
    redis_url: str = "redis://localhost:6379/0"
    typing_ttl_seconds: int = 6

    storage_backend: Literal["local", "supabase"] = "local"
    upload_dir: str = "uploads"
    public_base_url: str = "http://localhost:8000"
    max_upload_bytes: int = 10 * 1024 * 1024
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "attachments"


settings = Settings()
