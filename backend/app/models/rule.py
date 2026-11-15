from sqlalchemy import JSON, Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class Rule(Base, TimestampMixin):
    """A configurable deterministic quality condition for a source and field."""

    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    data_source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    column_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="MEDIUM", nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Thresholds and parameters, e.g. max null percentage or allowed categories.
    params: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
