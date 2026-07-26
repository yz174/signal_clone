from fastapi import APIRouter, File, Form, UploadFile

from app.core.deps import CurrentUser, SessionDep
from app.schemas.message import AttachmentOut
from app.services.attachment_service import AttachmentService
from app.services.storage import build_storage

router = APIRouter(tags=["attachments"])


@router.post("/attachments", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    user: CurrentUser,
    session: SessionDep,
    file: UploadFile = File(),
    width: int | None = Form(default=None),
    height: int | None = Form(default=None),
) -> AttachmentOut:
    content = await file.read()
    attachment = await AttachmentService(session, build_storage()).upload(
        user, content, file.content_type or "application/octet-stream", width, height
    )
    return AttachmentOut.model_validate(attachment)
