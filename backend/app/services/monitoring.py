"""Orchestrates one batch from raw frame to persisted incidents."""

from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session

from app.detection.decision import persist_findings
from app.detection.isolation_forest import detect_isolation_forest
from app.detection.rules import DEFAULT_RULES, evaluate_rules
from app.detection.statistics import detect_statistical_drift
from app.models.data_source import DataSource
from app.models.ingestion_batch import IngestionBatch
from app.models.profile import Profile
from app.models.rule import Rule
from app.models.schema import Schema
from app.processing.profiler import profile_dataframe
from app.processing.schema_registry import compare_schema, infer_schema
from app.schemas.common import Finding
from app.services.baselines import active_baseline, compare_baseline


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
    # A viewing window selects the slice being described. It never changes a
    # baseline, a rule threshold or a fitted model.
    if window_end is None:
        window_end = datetime.now(timezone.utc)
    if window_start is None:
        hours = int((source.config or {}).get("window_hours") or 1)
        window_start = window_end - timedelta(hours=hours)

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
    profile_row = Profile(
        ingestion_batch_id=batch.id,
        data_source_id=source.id,
        metrics=profile,
    )
    db.add(profile_row)
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

    baseline = active_baseline(db, source.id)
    if baseline:
        findings.extend(compare_baseline(profile, baseline))

    config = source.config or {}
    hours = max(1, min(24, int(config.get("window_hours") or 1)))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    history = (
        db.query(Profile)
        .filter(
            Profile.data_source_id == source.id,
            Profile.id != profile_row.id,
            Profile.created_at >= cutoff,
        )
        .order_by(Profile.id.asc())
        .limit(200)
        .all()
    )

    findings.extend(detect_statistical_drift(frame, profile, baseline, history, config))

    if_findings, flagged_rows, model_version = detect_isolation_forest(
        db, source, frame, baseline
    )
    findings.extend(if_findings)
    batch.flagged_rows = flagged_rows

    incidents = persist_findings(db, source.id, batch.id, findings)

    from app.services.alerts import evaluate_alerts

    evaluate_alerts(db, incidents)

    batch.status = "analyzed"
    db.commit()
    db.refresh(batch)

    return {
        "batch": batch,
        "profile": profile,
        "findings": findings,
        "incidents": incidents,
        "model_version": model_version,
    }
