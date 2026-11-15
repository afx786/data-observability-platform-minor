from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class Incident(Base, TimestampMixin):
    """An actionable, evidence-backed deviation. The unit the user investigates."""

    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    data_source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ingestion_batch_id: Mapped[int | None] = mapped_column(
        ForeignKey("ingestion_batches.id", ondelete="SET NULL"), nullable=True, index=True
    )

    column_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detection_method: Mapped[str] = mapped_column(String(100), nullable=False)

    # LOW / MEDIUM / HIGH / CRITICAL - scoring rules are not designed yet.
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False)

    # Expected vs observed values, supporting statistics and the explanation shown to users.
    evidence: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommended_action: Mapped[str | None] = mapped_column(Text, nullable=True)
