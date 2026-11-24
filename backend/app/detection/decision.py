"""Turn detector findings into explainable, deduplicated incidents."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity

# Fixed starting severity for each detector type. Threshold breaches from rules
# carry their configured severity and are handled by the calling detector.
BASE_SEVERITY: dict[DetectorType, Severity] = {
    DetectorType.RULE: Severity.MEDIUM,
    DetectorType.SCHEMA: Severity.HIGH,
    DetectorType.IQR: Severity.LOW,
    DetectorType.ROLLING_ZSCORE: Severity.MEDIUM,
    DetectorType.KS: Severity.MEDIUM,
    DetectorType.CHI_SQUARE: Severity.MEDIUM,
    DetectorType.BASELINE: Severity.HIGH,
    DetectorType.FRESHNESS: Severity.HIGH,
    DetectorType.VOLUME: Severity.MEDIUM,
    DetectorType.ISOLATION_FOREST: Severity.MEDIUM,
}

RANK = {
    Severity.LOW: 0,
    Severity.MEDIUM: 1,
    Severity.HIGH: 2,
    Severity.CRITICAL: 3,
}
LEVELS = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]

ACTIONS = {
    DetectorType.SCHEMA: "Inspect the upstream producer for a schema change.",
    DetectorType.RULE: "Inspect upstream ingestion and correct the affected values.",
    DetectorType.FRESHNESS: "Check the source connection and the last successful load.",
    DetectorType.BASELINE: "Review the approved reference period before accepting this change.",
    DetectorType.VOLUME: "Check whether the source stopped early or produced a partial batch.",
    DetectorType.ISOLATION_FOREST: "Compare flagged rows with the reference period.",
}


def decide_severity(findings: list[Finding], occurrences: int = 1) -> Severity:
    """Fixed table by detector, bumped for a large deviation or persistence."""
    if not findings:
        return Severity.LOW

    severity = max(
        (
            finding.severity
            if finding.detector == DetectorType.RULE
            else BASE_SEVERITY.get(finding.detector, Severity.MEDIUM)
            for finding in findings
        ),
        key=lambda level: RANK[level],
    )

    large = any(f.magnitude is not None and f.magnitude >= 5 for f in findings)
    if large or occurrences >= 3:
        severity = LEVELS[min(RANK[severity] + 1, RANK[Severity.CRITICAL])]

    return severity


def persist_findings(
    db: Session,
    data_source_id: int,
    ingestion_batch_id: int,
    findings: list[Finding],
) -> list[Incident]:
    saved: list[Incident] = []
    now = datetime.now(timezone.utc)

    for finding in findings:
        detector = finding.detector.value
        existing = (
            db.query(Incident)
            .filter(
                Incident.data_source_id == data_source_id,
                Incident.column_name == finding.field,
                Incident.detection_method == detector,
                Incident.status.in_(["open", "acknowledged"]),
            )
            .first()
        )

        occurrences = (existing.occurrences + 1) if existing else 1
        severity = decide_severity([finding], occurrences=occurrences)
        evidence = {**finding.evidence, "occurrences": occurrences}

        if existing:
            existing.occurrences = occurrences
            existing.last_seen_at = now
            if RANK[severity] > RANK[Severity(existing.severity)]:
                existing.severity = severity.value
            existing.ingestion_batch_id = ingestion_batch_id
            existing.evidence = evidence
            existing.observed = {"value": finding.observed}
            existing.expected = {"value": finding.expected}
            existing.explanation = finding.message
            incident = existing
        else:
            incident = Incident(
                data_source_id=data_source_id,
                ingestion_batch_id=ingestion_batch_id,
                column_name=finding.field,
                detection_method=detector,
                severity=severity.value,
                status="open",
                occurrences=1,
                last_seen_at=now,
                observed={"value": finding.observed},
                expected={"value": finding.expected},
                evidence=evidence,
                explanation=finding.message,
                recommended_action=ACTIONS.get(
                    finding.detector, "Review the evidence and compare with the reference period."
                ),
            )
            db.add(incident)

        saved.append(incident)

    db.commit()
    for incident in saved:
        db.refresh(incident)
    return saved
