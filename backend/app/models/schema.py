from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class Schema(Base, TimestampMixin):
    """Expected structure for a source (created from the first accepted baseline)."""

    __tablename__ = "schemas"

    id: Mapped[int] = mapped_column(primary_key=True)
    data_source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(default=1, nullable=False)

    # Column names, types, nullability, uniqueness and category constraints.
    definition: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
