from collections import Counter
from datetime import datetime, timedelta, timezone
from time import monotonic

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.monitoring import _as_utc, summary
from app.core.config import settings
from app.db.session import get_db
from app.models.alert import Alert
from app.models.data_source import DataSource
from app.models.incident import Incident
from app.models.ingestion_batch import IngestionBatch

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)

STARTED_AT = monotonic()


@router.get("/quality")
def quality_report(
    source_id: int | None = None,
    window_hours: int | None = Query(default=None, ge=1, le=24),
    db: Session = Depends(get_db),
) -> dict:
    summary_data = summary(source_id=source_id, window_hours=window_hours, db=db)
    hours = max(1, min(24, window_hours or 1))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    query = db.query(Incident)
    if source_id is not None:
        query = query.filter(Incident.data_source_id == source_id)
    incidents = [
        incident
        for incident in query.order_by(Incident.id.desc()).limit(500).all()
        if incident.created_at is None or _as_utc(incident.created_at) >= cutoff
    ]

    by_detector = Counter(incident.detection_method for incident in incidents)
    by_severity = Counter(incident.severity for incident in incidents)

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_hours": hours,
        "sources": summary_data["sources"],
        "summary": {
            key: value
            for key, value in summary_data.items()
            if key not in {"sources", "trend"}
        },
        "by_detector": [
            {"detector": name, "count": count}
            for name, count in sorted(by_detector.items(), key=lambda item: -item[1])
        ],
        "by_severity": [
            {"severity": name, "count": count}
            for name, count in sorted(by_severity.items(), key=lambda item: -item[1])
        ],
        "top_incidents": [
            {
                "id": incident.id,
                "source_id": incident.data_source_id,
                "severity": incident.severity,
                "detector": incident.detection_method,
                "field": incident.column_name,
                "explanation": incident.explanation,
                "created_at": incident.created_at.isoformat() if incident.created_at else None,
            }
            for incident in incidents[:10]
        ],
    }


@router.get("/system-status")
def system_status(db: Session = Depends(get_db)) -> dict:
    try:
        db.execute(text("SELECT 1"))
        database = "connected"
    except Exception:
        database = "unavailable"

    return {
        "database": database,
        "smtp": "configured" if settings.smtp_host else "not configured",
        "cron": "Render Cron Job entrypoint available",
        "version": "1.0.0",
        "uptime_seconds": int(monotonic() - STARTED_AT),
        "counts": {
            "sources": db.query(DataSource).count(),
            "batches": db.query(IngestionBatch).count(),
            "incidents": db.query(Incident).count(),
            "alerts": db.query(Alert).count(),
        },
    }
