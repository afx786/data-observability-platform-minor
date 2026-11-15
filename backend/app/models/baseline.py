from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.common import TimestampMixin


class Baseline(Base, TimestampMixin):
    """A versioned reference used for comparison. Never replaced by an incoming batch."""

    __tablename__ = "baselines"

    id: Mapped[int] = mapped_column(primary_key=True)
    data_source_id: Mapped[int] = mapped_column(
        ForeignKey("data_sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Reference period, metric set and the fitted model version it belongs to.
    reference_window: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    statistics: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)

    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
