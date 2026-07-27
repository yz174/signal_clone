from pathlib import Path

from fastapi import APIRouter, Request, Response

from app.core.config import settings
from app.core.deps import CurrentUser, SessionDep
from app.core.errors import NotFoundError, UnauthorizedError, ValidationError
from app.core.security import decode_token
from app.schemas.message import (
    AttachmentCreate,
    AttachmentOut,
    UploadTicketIn,
    UploadTicketOut,
)
from app.services.attachment_service import AttachmentService
from app.services.storage import LocalStorage, build_storage

router = APIRouter(tags=["attachments"])


@router.post("/attachments/upload-url", response_model=UploadTicketOut, status_code=201)
async def create_upload_url(
    user: CurrentUser, session: SessionDep, payload: UploadTicketIn
) -> UploadTicketOut:
    ticket = await AttachmentService(session, build_storage()).create_ticket(
        payload.content_type, payload.size_bytes
    )
    return UploadTicketOut(
        upload_url=ticket.upload_url,
        object_name=ticket.object_name,
        headers=ticket.headers,
    )


@router.post("/attachments", response_model=AttachmentOut, status_code=201)
async def register_attachment(
    user: CurrentUser, session: SessionDep, payload: AttachmentCreate
) -> AttachmentOut:
    attachment = await AttachmentService(session, build_storage()).register(
        user, payload.object_name, payload.width, payload.height
    )
    return AttachmentOut.model_validate(attachment)


@router.put("/attachments/local/{name}", status_code=204)
async def receive_local_upload(name: str, token: str, request: Request) -> Response:
    if settings.storage_backend != "local":
        raise NotFoundError("Not found")

    if decode_token(token, "upload") != name:
        raise UnauthorizedError("That upload token is for a different object")

    storage = LocalStorage(Path(settings.upload_dir), settings.public_base_url)

    buffer = bytearray()
    async for chunk in request.stream():
        buffer.extend(chunk)
        if len(buffer) > settings.max_upload_bytes:
            limit_mb = settings.max_upload_bytes // (1024 * 1024)
            raise ValidationError(f"Files must be smaller than {limit_mb}MB")

    storage.write(name, bytes(buffer))
    return Response(status_code=204)
