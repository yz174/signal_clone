import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from uuid import uuid4

import httpx

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import create_upload_token

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

TYPES_BY_EXTENSION = {extension: mime for mime, extension in EXTENSIONS.items()}

OBJECT_NAME = re.compile(r"^[0-9a-f]{32}\.[a-z]{3,4}$")


class StorageError(AppError):
    status_code = 502
    code = "storage_unavailable"


@dataclass(frozen=True)
class UploadTicket:
    upload_url: str
    object_name: str
    headers: dict[str, str]


@dataclass(frozen=True)
class StoredObject:
    size_bytes: int
    mime_type: str


class Storage(Protocol):
    def public_url(self, object_name: str) -> str: ...

    async def create_upload_ticket(self, content_type: str) -> UploadTicket: ...

    async def stat(self, object_name: str) -> StoredObject | None: ...


def object_name(content_type: str) -> str:
    return f"{uuid4().hex}{EXTENSIONS.get(content_type, '')}"


def is_safe_object_name(name: str) -> bool:
    return bool(OBJECT_NAME.fullmatch(name))


class LocalStorage:
    def __init__(self, directory: Path, public_base_url: str) -> None:
        self._directory = directory
        self._public_base_url = public_base_url.rstrip("/")
        self._directory.mkdir(parents=True, exist_ok=True)

    def public_url(self, name: str) -> str:
        return f"{self._public_base_url}/uploads/{name}"

    async def create_upload_ticket(self, content_type: str) -> UploadTicket:
        name = object_name(content_type)
        token = create_upload_token(name)
        return UploadTicket(
            upload_url=f"{self._public_base_url}/api/v1/attachments/local/{name}?token={token}",
            object_name=name,
            headers={"Content-Type": content_type},
        )

    async def stat(self, name: str) -> StoredObject | None:
        path = self._directory / name
        if not is_safe_object_name(name) or not path.is_file():
            return None

        return StoredObject(
            size_bytes=path.stat().st_size,
            mime_type=TYPES_BY_EXTENSION.get(path.suffix, "application/octet-stream"),
        )

    def write(self, name: str, content: bytes) -> None:
        if not is_safe_object_name(name):
            raise StorageError("Rejected object name")
        (self._directory / name).write_bytes(content)


class SupabaseStorage:
    def __init__(self, project_url: str, service_key: str, bucket: str) -> None:
        self._base = project_url.rstrip("/")
        self._service_key = service_key
        self._bucket = bucket

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._service_key}", "apikey": self._service_key}

    def public_url(self, name: str) -> str:
        return f"{self._base}/storage/v1/object/public/{self._bucket}/{name}"

    async def create_upload_ticket(self, content_type: str) -> UploadTicket:
        name = object_name(content_type)

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base}/storage/v1/object/upload/sign/{self._bucket}/{name}",
                headers=self._headers,
            )

        if response.status_code >= 400:
            raise StorageError(f"Storage refused to sign the upload ({response.status_code})")

        signed = response.json().get("url")
        if not isinstance(signed, str):
            raise StorageError("Storage returned a malformed upload URL")

        return UploadTicket(
            upload_url=f"{self._base}/storage/v1{signed}",
            object_name=name,
            headers={"Content-Type": content_type, "x-upsert": "false"},
        )

    async def stat(self, name: str) -> StoredObject | None:
        if not is_safe_object_name(name):
            return None

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{self._base}/storage/v1/object/list/{self._bucket}",
                headers={**self._headers, "Content-Type": "application/json"},
                json={"prefix": "", "search": name, "limit": 100},
            )

        if response.status_code >= 400:
            raise StorageError(f"Storage lookup failed ({response.status_code})")

        for entry in response.json():
            if entry.get("name") != name:
                continue
            metadata = entry.get("metadata") or {}
            size = metadata.get("size")
            mime = metadata.get("mimetype")
            if not isinstance(size, int) or not isinstance(mime, str):
                return None
            return StoredObject(size_bytes=size, mime_type=mime)

        return None


def build_storage() -> Storage:
    if settings.storage_backend == "supabase":
        if not (settings.supabase_url and settings.supabase_service_key):
            raise StorageError("Supabase storage selected but credentials are missing")
        return SupabaseStorage(
            settings.supabase_url, settings.supabase_service_key, settings.supabase_bucket
        )

    return LocalStorage(Path(settings.upload_dir), settings.public_base_url)
