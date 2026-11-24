from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.data_source import DataSource
from app.models.incident import Incident
from app.models.ingestion_batch import IngestionBatch
from app.models.profile import Profile
from app.schemas.enums import IncidentStatus, Severity

router = APIRouter(
    prefix="/monitoring",
    tags=["monitoring"],
    dependencies=[Depends(get_current_user)],
)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _window_hours(source: DataSource | None, override: int | None) -> int:
    if override is not None:
        return max(1, min(24, override))
    config = (source.config or {}) if source else {}
    return max(1, min(24, int(config.get("window_hours") or 1)))


def _recent_batches(db: Session, source_id: int, hours: int) -> list[IngestionBatch]:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    batches = (
        db.query(IngestionBatch)
        .filter(IngestionBatch.data_source_id == source_id)
        .order_by(IngestionBatch.received_at.desc())
        .limit(500)
        .all()
    )
    selected = [batch for batch in batches if _as_utc(batch.received_at) >= cutoff]
    return list(reversed(selected))


@router.get("/summary")
def summary(
    source_id: int | None = None,
    window_hours: int | None = Query(default=None, ge=1, le=24),
    db: Session = Depends(get_db),
) -> dict:
    sources = (
        [db.query(DataSource).filter(DataSource.id == source_id).first()]
        if source_id is not None
        else db.query(DataSource).order_by(DataSource.id).all()
    )
    sources = [source for source in sources if source is not None]
    if source_id is not None and not sources:
        raise HTTPException(status_code=404, detail="Source not found")

    total_rows = 0
    total_flagged = 0
    batch_count = 0
    null_rates: list[float] = []
    duplicate_rates: list[float] = []
    trend: list[dict] = []

    for source in sources:
        hours = _window_hours(source, window_hours)
        batches = _recent_batches(db, source.id, hours)
        batch_ids = [batch.id for batch in batches]
        profiles = (
            {
                profile.ingestion_batch_id: profile.metrics
                for profile in db.query(Profile)
                .filter(Profile.ingestion_batch_id.in_(batch_ids))
                .all()
            }
            if batch_ids
            else {}
        )

        for batch in batches:
            metrics = profiles.get(batch.id) or {}
            rows = int(batch.row_count or metrics.get("row_count") or 0)
            flagged = int(batch.flagged_rows or 0)
            total_rows += rows
            total_flagged += flagged
            batch_count += 1
            null_rate = sum(
                (col.get("null_rate") or 0.0)
                for col in (metrics.get("columns") or {}).values()
            ) / max(len(metrics.get("columns") or {}), 1)
            duplicate_rate = float(metrics.get("duplicate_rate") or 0.0)
            null_rates.append(null_rate)
            duplicate_rates.append(duplicate_rate)
            trend.append(
                {
                    "label": batch.received_at.isoformat() if batch.received_at else str(batch.id),
                    "source_id": source.id,
                    "rows": rows,
                    "flagged_rows": flagged,
                    "anomaly_rate": (flagged / rows) if rows else 0.0,
                    "null_rate": null_rate,
                    "duplicate_rate": duplicate_rate,
                }
            )

    open_query = db.query(Incident).filter(Incident.status != IncidentStatus.RESOLVED.value)
    critical_query = open_query.filter(Incident.severity == Severity.CRITICAL.value)
    if source_id is not None:
        open_query = open_query.filter(Incident.data_source_id == source_id)
        critical_query = critical_query.filter(Incident.data_source_id == source_id)

    return {
        "sources": len(sources),
        "total_rows": total_rows,
        "batches": batch_count,
        "avg_null_rate": sum(null_rates) / len(null_rates) if null_rates else 0.0,
        "avg_duplicate_rate": sum(duplicate_rates) / len(duplicate_rates) if duplicate_rates else 0.0,
        "flagged_rows": total_flagged,
        "anomaly_rate": (total_flagged / total_rows) if total_rows else 0.0,
        "open_incidents": open_query.count(),
        "critical_incidents": critical_query.count(),
        "trend": trend[-48:],
    }


@router.get("/anomaly-rate")
def anomaly_rate(
    source_id: int | None = None,
    window_hours: int | None = Query(default=None, ge=1, le=24),
    db: Session = Depends(get_db),
) -> list[dict]:
    source_query = db.query(DataSource)
    if source_id is not None:
        source_query = source_query.filter(DataSource.id == source_id)
    sources = source_query.all()
    if source_id is not None and not sources:
        raise HTTPException(status_code=404, detail="Source not found")

    points: list[dict] = []
    for source in sources:
        hours = _window_hours(source, window_hours)
        for batch in _recent_batches(db, source.id, hours):
            rows = int(batch.row_count or 0)
            flagged = int(batch.flagged_rows or 0)
            points.append(
                {
                    "batch_id": batch.id,
                    "source_id": source.id,
                    "received_at": batch.received_at.isoformat() if batch.received_at else None,
                    "window_start": batch.window_start.isoformat() if batch.window_start else None,
                    "row_count": rows,
                    "flagged_rows": flagged,
                    "anomaly_rate": (flagged / rows) if rows else 0.0,
                }
            )
    return points
