import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any

from app.db.base import utcnow


class EventType(StrEnum):
    MESSAGE_CREATED = "message.created"
    MESSAGE_DELETED = "message.deleted"
    RECEIPT_UPDATED = "receipt.updated"
    TYPING_UPDATED = "typing.updated"
    PRESENCE_UPDATED = "presence.updated"
    CONVERSATION_UPDATED = "conversation.updated"
    MEMBER_CHANGED = "member.changed"


@dataclass(frozen=True)
class Event:
    type: EventType
    payload: dict[str, Any]
    recipients: tuple[str, ...]
    sent_at: datetime = field(default_factory=utcnow)

    def for_client(self) -> dict[str, Any]:
        return {
            "type": self.type.value,
            "sent_at": self.sent_at.isoformat(),
            "payload": self.payload,
        }

    def serialise(self) -> str:
        return json.dumps(
            {
                "type": self.type.value,
                "payload": self.payload,
                "recipients": list(self.recipients),
                "sent_at": self.sent_at.isoformat(),
            }
        )

    @classmethod
    def deserialise(cls, raw: str) -> "Event":
        data = json.loads(raw)
        return cls(
            type=EventType(data["type"]),
            payload=data["payload"],
            recipients=tuple(data["recipients"]),
            sent_at=datetime.fromisoformat(data["sent_at"]),
        )
