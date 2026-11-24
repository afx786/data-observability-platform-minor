"""Orchestrates one batch from raw frame to persisted incidents."""

from datetime import datetime
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.detection.decision import persist_findings
from app.detection.rules import DEFAULT_RULES, evaluate_rules
from app.models.data_source import DataSource
from app.models.ingestion_batch import IngestionBatch
from app.models.profile import Profile
from app.models.rule import Rule
from app.models.schema import Schema
from app.processing.profiler import profile_dataframe
from app.processing.schema_registry import compare_schema, infer_schema
from app.schemas.common import Finding


def _configured_rules(db: Session, source_id: int) -> list[dict[str, Any]]:
    rows = (
        db.query(Rule)
        .filter(Rule.data_source_id == source_id, Rule.enabled.is_(True))
        .all()
    )
    return [
        {
            "rule_type": row.rule_type,
            "column_name": row.column_name,
            "params": row.params,
            "severity": row.severity.lower(),
        }
        for row in rows
    ] or DEFAULT_RULES


def monitor_frame(
    db: Session,
    source: DataSource,
    frame: pd.DataFrame,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
) -> dict[str, Any]:
    batch = IngestionBatch(
        data_source_id=source.id,
        status="received",
        row_count=len(frame),
        window_start=window_start,
        window_end=window_end,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    timestamp_column = (source.config or {}).get("timestamp_column")
    profile = profile_dataframe(frame, timestamp_column=timestamp_column)
    db.add(
        Profile(
            ingestion_batch_id=batch.id,
            data_source_id=source.id,
            metrics=profile,
        )
    )
    batch.status = "profiled"
    db.commit()

    observed_schema = infer_schema(frame)
    expected_schema = (
        db.query(Schema)
        .filter(Schema.data_source_id == source.id, Schema.status == "active")
        .first()
    )

    findings: list[Finding] = []
    if expected_schema is None:
        db.add(
            Schema(
                data_source_id=source.id,
                version=1,
                definition=observed_schema,
                status="active",
            )
        )
    else:
        findings.extend(compare_schema(expected_schema.definition, observed_schema))

    findings.extend(evaluate_rules(profile, _configured_rules(db, source.id)))
    incidents = persist_findings(db, source.id, batch.id, findings)

    batch.status = "analyzed"
    batch.flagged_rows = 0
    db.commit()

    return {
        "batch": batch,
        "profile": profile,
        "findings": findings,
        "incidents": incidents,
    }
