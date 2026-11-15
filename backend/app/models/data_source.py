from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class DataSource(Base, TimestampMixin):
    """A configured monitored source: CSV/Excel, PostgreSQL or REST API."""

    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    # Connection details differ per source type, so they are stored as JSON.
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
