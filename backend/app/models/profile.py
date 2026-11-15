from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class Profile(Base, TimestampMixin):
    """Measured health of one batch: counts, null rates, statistics, freshness."""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    ingestion_batch_id: Mapped[int] = mapped_column(
        ForeignKey("ingestion_batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    data_source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Row/column counts, null and duplicate rates, quantiles, per-column stats.
    metrics: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
