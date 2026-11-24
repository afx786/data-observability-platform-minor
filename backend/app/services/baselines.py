"""Versioned reference profiles. A baseline is only changed by explicit approval."""

from typing import Any

from sqlalchemy.orm import Session

from app.models.baseline import Baseline
from app.models.profile import Profile
from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity


def active_baseline(db: Session, source_id: int) -> Baseline | None:
    return (
        db.query(Baseline)
        .filter(
            Baseline.data_source_id == source_id,
            Baseline.status == "active",
        )
        .order_by(Baseline.version.desc())
        .first()
    )


def create_baseline(db: Session, source_id: int) -> Baseline:
    latest = (
        db.query(Profile)
        .filter(Profile.data_source_id == source_id)
        .order_by(Profile.id.desc())
        .first()
    )
    if latest is None:
        raise ValueError("No profile available to establish a baseline")

    previous = active_baseline(db, source_id)
    version = previous.version + 1 if previous else 1
    if previous:
        previous.status = "superseded"

    baseline = Baseline(
        data_source_id=source_id,
        version=version,
        reference_window={"profile_id": latest.id, "batch_id": latest.ingestion_batch_id},
        statistics=latest.metrics,
        model_version=None,
        status="active",
    )
    db.add(baseline)
    db.commit()
    db.refresh(baseline)
    return baseline


def compare_baseline(profile: dict[str, Any], baseline: Baseline) -> list[Finding]:
    findings: list[Finding] = []
    reference = baseline.statistics or {}

    for column, reference_stats in (reference.get("columns") or {}).items():
        current = (profile.get("columns") or {}).get(column)
        if not current:
            continue

        expected = reference_stats.get("null_rate", 0.0)
        observed = current.get("null_rate", 0.0)
        change = observed - expected
        if abs(change) >= max(0.05, expected * 0.5):
            findings.append(
                Finding(
                    detector=DetectorType.BASELINE,
                    field=column,
                    severity=Severity.HIGH,
                    observed=observed,
                    expected=expected,
                    magnitude=abs(change) / expected if expected else abs(change) * 100,
                    message=(
                        f"NULL rate for '{column}' moved from {expected:.1%} to "
                        f"{observed:.1%} vs baseline v{baseline.version}"
                    ),
                    evidence={
                        "baseline_version": baseline.version,
                        "observed": observed,
                        "expected": expected,
                        "change_percentage_points": change * 100,
                    },
                )
            )

    expected_rows = reference.get("row_count", 0)
    observed_rows = profile.get("row_count", 0)
    if expected_rows and abs(observed_rows - expected_rows) / expected_rows > 0.30:
        findings.append(
            Finding(
                detector=DetectorType.VOLUME,
                field=None,
                severity=Severity.MEDIUM,
                observed=observed_rows,
                expected=expected_rows,
                magnitude=abs(observed_rows - expected_rows) / expected_rows,
                message="Record volume differs substantially from the reference batch",
                evidence={"baseline_version": baseline.version},
            )
        )

    return findings
