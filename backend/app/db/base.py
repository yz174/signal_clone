from datetime import UTC, datetime
from enum import Enum
from typing import Any

from sqlalchemy import JSON, MetaData, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from ulid import ULID

from app.db.types import UtcDateTime

NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s",
    "pk": "pk_%(table_name)s",
}

ID_LENGTH = 26


def new_id() -> str:
    return str(ULID())


def utcnow() -> datetime:
    return datetime.now(UTC)


def enum_column(enum_cls: type[Enum], name: str) -> SAEnum:
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=False,
        create_constraint=True,
        values_callable=lambda members: [member.value for member in members],
        validate_strings=True,
    )


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)

    type_annotation_map = {
        datetime: UtcDateTime(),
        dict[str, Any]: JSON,
    }


class IdMixin:
    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, default=new_id)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)
