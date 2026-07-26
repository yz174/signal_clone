from fastapi import APIRouter

from app.api.v1 import attachments, auth, contacts, conversations, messages, search, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(contacts.router)
api_router.include_router(conversations.router)
api_router.include_router(messages.router)
api_router.include_router(search.router)
api_router.include_router(attachments.router)
