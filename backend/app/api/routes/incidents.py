from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.incident import Incident
from app.schemas.enums import IncidentStatus, Role

router = APIRouter(
    prefix="/incidents",
    tags=["incidents"],
    dependencies=[Depends(get_current_user)],
)


def _incident_dict(incident: Incident) -> dict:
    return {
        "id": incident.id,
        "source_id": incident.data_source_id,
        "batch_id": incident.ingestion_batch_id,
        "field": incident.column_name,
        "detector": incident.detection_method,
        "severity": incident.severity,
        "status": incident.status,
        "occurrences": incident.occurrences,
        "observed": incident.observed,
        "expected": incident.expected,
        "evidence": incident.evidence,
        "explanation": incident.explanation,
        "recommended_action": incident.recommended_action,
        "created_at": incident.created_at.isoformat() if incident.created_at else None,
        "last_seen_at": incident.last_seen_at.isoformat() if incident.last_seen_at else None,
    }


@router.get("")
def list_incidents(
    source_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Incident)
    if source_id is not None:
        query = query.filter(Incident.data_source_id == source_id)
    if status:
        query = query.filter(Incident.status == status)
    return [_incident_dict(row) for row in query.order_by(Incident.id.desc()).limit(200).all()]


@router.get("/{incident_id}")
def get_incident(incident_id: int, db: Session = Depends(get_db)) -> dict:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _incident_dict(incident)


@router.patch("/{incident_id}")
def update_status(
    incident_id: int,
    status: IncidentStatus,
    _analyst=Depends(require_role(Role.ANALYST)),
    db: Session = Depends(get_db),
) -> dict:
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    incident.status = status.value
    db.commit()
    db.refresh(incident)
    return _incident_dict(incident)
