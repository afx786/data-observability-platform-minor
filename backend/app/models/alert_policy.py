from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class AlertPolicy(Base, TimestampMixin):
    """Per-source email notification settings."""

    __tablename__ = "alert_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    data_source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    recipients: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    severity_filter: Mapped[list] = mapped_column(
        JSON, default=lambda: ["high", "critical"], nullable=False
    )
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
