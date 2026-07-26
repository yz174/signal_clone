from pathlib import Path
from typing import Protocol
from uuid import uuid4

import httpx

from app.core.config import settings
from app.core.errors import AppError

IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
DOCUMENT_TYPES = {"application/pdf", "text/plain"}
ALLOWED_TYPES = IMAGE_TYPES | DOCUMENT_TYPES

EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
}


class StorageError(AppError):
    status_code = 502
    code = "storage_unavailable"


class Storage(Protocol):
    async def save(self, content: bytes, content_type: str) -> str: ...


def object_name(content_type: str) -> str:
    return f"{uuid4().hex}{EXTENSIONS.get(content_type, '')}"


class LocalStorage:
    """Writes beside the app and serves through StaticFiles.

    Files live on the container's disk, so they do not survive a redeploy on an
    ephemeral host. Litestream replicates the database, not uploads.
    """

    def __init__(self, directory: Path, public_base_url: str) -> None:
        self._directory = directory
        self._public_base_url = public_base_url.rstrip("/")
        self._directory.mkdir(parents=True, exist_ok=True)

    async def save(self, content: bytes, content_type: str) -> str:
        name = object_name(content_type)
        (self._directory / name).write_bytes(content)
        return f"{self._public_base_url}/uploads/{name}"


class SupabaseStorage:
    def __init__(self, project_url: str, service_key: str, bucket: str) -> None:
        self._base = project_url.rstrip("/")
        self._service_key = service_key
        self._bucket = bucket

    async def save(self, content: bytes, content_type: str) -> str:
        name = object_name(content_type)
        endpoint = f"{self._base}/storage/v1/object/{self._bucket}/{name}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                endpoint,
                content=content,
                headers={
                    "Authorization": f"Bearer {self._service_key}",
                    "Content-Type": content_type,
                    "x-upsert": "false",
                },
            )

        if response.status_code >= 400:
            raise StorageError(f"Upload rejected by storage ({response.status_code})")

        return f"{self._base}/storage/v1/object/public/{self._bucket}/{name}"


def build_storage() -> Storage:
    if settings.storage_backend == "supabase":
        if not (settings.supabase_url and settings.supabase_service_key):
            raise StorageError("Supabase storage selected but credentials are missing")
        return SupabaseStorage(
            settings.supabase_url, settings.supabase_service_key, settings.supabase_bucket
        )

    return LocalStorage(Path(settings.upload_dir), settings.public_base_url)
