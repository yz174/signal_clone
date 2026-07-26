from fastapi import APIRouter, Response, status

from app.core.deps import CurrentUser, SessionDep
from app.schemas.contact import ContactCreate, ContactOut
from app.schemas.user import UserOut
from app.services.contact_service import ContactService

router = APIRouter(tags=["contacts"])


@router.get("/contacts", response_model=list[ContactOut])
async def list_contacts(user: CurrentUser, session: SessionDep) -> list[ContactOut]:
    entries = await ContactService(session).list_for_user(user)
    return [
        ContactOut(user=UserOut.model_validate(entry.user), nickname=entry.nickname)
        for entry in entries
    ]


@router.post("/contacts", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def add_contact(payload: ContactCreate, user: CurrentUser, session: SessionDep) -> ContactOut:
    entry = await ContactService(session).add(user, payload.user_id, payload.nickname)
    return ContactOut(user=UserOut.model_validate(entry.user), nickname=entry.nickname)


@router.delete("/contacts/{contact_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_contact(contact_user_id: str, user: CurrentUser, session: SessionDep) -> Response:
    await ContactService(session).remove(user, contact_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
