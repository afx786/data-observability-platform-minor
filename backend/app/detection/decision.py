"""Turn detector findings into explainable, deduplicated incidents."""

from sqlalchemy.orm import Session

from app.models.incident import Incident
from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity

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

ACTIONS = {
    DetectorType.SCHEMA: "Inspect the upstream producer for a schema change.",
    DetectorType.RULE: "Inspect upstream ingestion and correct the affected values.",
    DetectorType.FRESHNESS: "Check the source connection and the last successful load.",
    DetectorType.ISOLATION_FOREST: "Compare flagged rows with the reference period.",
}


def decide_severity(findings: list[Finding], occurrences: int = 1) -> Severity:
    """Fixed table by detector, bumped for a large deviation or persistence."""
    if not findings:
        return Severity.LOW

    severity = max(
        (BASE_SEVERITY.get(f.detector, Severity.MEDIUM) for f in findings),
        key=lambda level: RANK[level],
    )

    large = any(f.magnitude is not None and f.magnitude >= 5 for f in findings)
    if large or occurrences >= 3:
        index = min(RANK[severity] + 1, RANK[Severity.CRITICAL])
        severity = [level for level, rank in RANK.items() if rank == index][0]

    return severity


def persist_findings(
    db: Session,
    data_source_id: int,
    ingestion_batch_id: int,
    findings: list[Finding],
) -> list[Incident]:
    severity = decide_severity(findings)
    saved: list[Incident] = []

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

        if existing:
            existing.occurrences += 1
            if RANK[Severity(severity)] > RANK[Severity(existing.severity)]:
                existing.severity = severity.value
            existing.evidence = finding.evidence
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
                observed={"value": finding.observed},
                expected={"value": finding.expected},
                evidence=finding.evidence,
                explanation=finding.message,
                recommended_action=ACTIONS.get(
                    finding.detector, "Review the evidence and compare with the reference period."
                ),
            )
            db.add(incident)

        saved.append(incident)

    db.commit()
    return saved
