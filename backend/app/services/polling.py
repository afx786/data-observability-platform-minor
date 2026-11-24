"""Fetch external sources and feed them through the common monitoring pipeline."""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.connectors.postgres import fetch_postgres
from app.connectors.rest import fetch_rest
from app.models.data_source import DataSource
from app.models.ingestion_batch import IngestionBatch
from app.schemas.enums import SourceType
from app.services.monitoring import monitor_frame

POLLABLE = {SourceType.POSTGRESQL.value, SourceType.REST_API.value}


def window_bounds(config: dict) -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    hours = int(config.get("window_hours") or 1)
    return end - timedelta(hours=hours), end


def poll_source(db: Session, source: DataSource) -> dict[str, Any]:
    config = source.config or {}
    start, end = window_bounds(config)

    try:
        if source.source_type == SourceType.REST_API.value:
            frame = fetch_rest(config)
        elif source.source_type == SourceType.POSTGRESQL.value:
            frame = fetch_postgres(config)
        else:
            raise ValueError(f"Source type '{source.source_type}' is not pollable")
    except Exception as exc:
        failed = IngestionBatch(
            data_source_id=source.id,
            status="failed",
            row_count=None,
            window_start=start,
            window_end=end,
            message=str(exc)[:1024],
        )
        db.add(failed)
        db.commit()
        return {
            "source_id": source.id,
            "batch_id": failed.id,
            "status": "failed",
            "error": str(exc),
        }

    outcome = monitor_frame(db, source, frame, window_start=start, window_end=end)
    return {
        "source_id": source.id,
        "batch_id": outcome["batch"].id,
        "status": "analyzed",
        "row_count": len(frame),
        "findings": len(outcome["findings"]),
        "incidents": len(outcome["incidents"]),
    }
