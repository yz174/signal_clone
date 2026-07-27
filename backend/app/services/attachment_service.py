from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.models import Attachment, AttachmentKind, User
from app.services.storage import ALLOWED_TYPES, IMAGE_TYPES, Storage, UploadTicket

MAX_ATTACHMENTS_PER_MESSAGE = 5


def _reject_unusable(content_type: str, size_bytes: int) -> None:
    if content_type not in ALLOWED_TYPES:
        raise ValidationError(f"{content_type} files are not accepted")

    if size_bytes <= 0:
        raise ValidationError("The file is empty")

    if size_bytes > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise ValidationError(f"Files must be smaller than {limit_mb}MB")


class AttachmentService:
    def __init__(self, session: AsyncSession, storage: Storage) -> None:
        self._session = session
        self._storage = storage

    async def create_ticket(self, content_type: str, size_bytes: int) -> UploadTicket:
        _reject_unusable(content_type, size_bytes)
        return await self._storage.create_upload_ticket(content_type)

    async def register(
        self,
        user: User,
        object_name: str,
        width: int | None = None,
        height: int | None = None,
    ) -> Attachment:
        stored = await self._storage.stat(object_name)
        if stored is None:
            raise ValidationError("The upload never reached storage")

        _reject_unusable(stored.mime_type, stored.size_bytes)

        url = self._storage.public_url(object_name)
        if await self._session.scalar(select(Attachment).where(Attachment.url == url)):
            raise ConflictError("That upload is already registered")

        attachment = Attachment(
            uploaded_by=user.id,
            kind=AttachmentKind.IMAGE if stored.mime_type in IMAGE_TYPES else AttachmentKind.FILE,
            url=url,
            mime_type=stored.mime_type,
            size_bytes=stored.size_bytes,
            width=width,
            height=height,
        )
        self._session.add(attachment)
        await self._session.commit()

        return attachment

    async def claim(self, user: User, attachment_ids: list[str], message_id: str) -> None:
        if not attachment_ids:
            return

        if len(attachment_ids) > MAX_ATTACHMENTS_PER_MESSAGE:
            raise ValidationError(
                f"A message can carry at most {MAX_ATTACHMENTS_PER_MESSAGE} attachments"
            )

        found = (
            await self._session.scalars(select(Attachment).where(Attachment.id.in_(attachment_ids)))
        ).all()

        if len(found) != len(set(attachment_ids)):
            raise NotFoundError("Attachment not found")

        for attachment in found:
            if attachment.uploaded_by != user.id:
                raise ForbiddenError("That attachment belongs to someone else")
            if attachment.message_id is not None:
                raise ValidationError("That attachment is already attached to a message")
            attachment.message_id = message_id


async def claim_attachments(
    session: AsyncSession, user: User, attachment_ids: list[str], message_id: str
) -> list[Attachment]:
    if not attachment_ids:
        return []

    if len(attachment_ids) > MAX_ATTACHMENTS_PER_MESSAGE:
        raise ValidationError(
            f"A message can carry at most {MAX_ATTACHMENTS_PER_MESSAGE} attachments"
        )

    found = (
        await session.scalars(select(Attachment).where(Attachment.id.in_(attachment_ids)))
    ).all()

    if len(found) != len(set(attachment_ids)):
        raise NotFoundError("Attachment not found")

    for attachment in found:
        if attachment.uploaded_by != user.id:
            raise ForbiddenError("That attachment belongs to someone else")
        if attachment.message_id is not None:
            raise ValidationError("That attachment is already attached to a message")
        attachment.message_id = message_id

    return list(found)
