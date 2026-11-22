"""Data contracts shared by the API and the frontend.

``Finding`` is the single shape every detector emits. The decision engine turns a
list of findings into one incident, so no detector needs to know about severity
policy or persistence.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.enums import (
    BatchStatus,
    DetectorType,
    IncidentStatus,
    Severity,
)


class Finding(BaseModel):
    detector: DetectorType
    field: str | None = None
    severity: Severity
    observed: Any = None
    expected: Any = None
    magnitude: float | None = None
    message: str
    evidence: dict[str, Any] = Field(default_factory=dict)
    batch_id: int | None = None


class BatchSummary(BaseModel):
    id: int
    data_source_id: int
    status: BatchStatus
    received_at: datetime
    window_start: datetime | None = None
    window_end: datetime | None = None
    row_count: int = 0
    flagged_rows: int = 0


class ProfileSummary(BaseModel):
    batch_id: int
    row_count: int
    column_count: int
    null_rate: float = 0.0
    duplicate_rate: float = 0.0
    flagged_rows: int = 0
    metrics: dict[str, Any] = Field(default_factory=dict)


class IncidentDetail(BaseModel):
    """The full answer to: what changed, when, where, how much, why, evidence."""

    id: int
    data_source_id: int
    ingestion_batch_id: int | None = None
    field: str | None = None
    detection_method: DetectorType
    severity: Severity
    status: IncidentStatus
    occurrences: int = 1
    observed: Any = None
    expected: Any = None
    evidence: dict[str, Any] = Field(default_factory=dict)
    explanation: str | None = None
    recommended_action: str | None = None
    created_at: datetime
