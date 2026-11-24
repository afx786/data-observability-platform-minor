from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.alert import Alert
from app.models.alert_policy import AlertPolicy
from app.schemas.enums import Role
from app.services.alerts import ensure_policy

router = APIRouter(
    prefix="/alerts",
    tags=["alerts"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_alerts(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "id": row.id,
            "incident_id": row.incident_id,
            "recipient": row.recipient,
            "status": row.status,
            "message": row.message,
            "sent_at": row.sent_at.isoformat() if row.sent_at else None,
        }
        for row in db.query(Alert).order_by(Alert.id.desc()).limit(200).all()
    ]


@router.get("/policies")
def list_policies(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "source_id": row.data_source_id,
            "recipients": row.recipients,
            "severity_filter": row.severity_filter,
            "cooldown_minutes": row.cooldown_minutes,
            "enabled": row.enabled,
        }
        for row in db.query(AlertPolicy).order_by(AlertPolicy.id).all()
    ]


@router.put("/policies/{source_id}")
def save_policy(
    source_id: int,
    payload: dict,
    _analyst=Depends(require_role(Role.ANALYST)),
    db: Session = Depends(get_db),
) -> dict:
    policy = ensure_policy(db, source_id)
    recipients = payload.get("recipients")
    severities = payload.get("severity_filter")

    if recipients is not None and not isinstance(recipients, list):
        raise HTTPException(status_code=422, detail="recipients must be a list")
    if severities is not None and not isinstance(severities, list):
        raise HTTPException(status_code=422, detail="severity_filter must be a list")

    if recipients is not None:
        policy.recipients = recipients
    if severities is not None:
        policy.severity_filter = severities
    if "cooldown_minutes" in payload:
        policy.cooldown_minutes = int(payload["cooldown_minutes"])
    if "enabled" in payload:
        policy.enabled = bool(payload["enabled"])

    db.commit()
    db.refresh(policy)
    return {
        "source_id": policy.data_source_id,
        "recipients": policy.recipients,
        "severity_filter": policy.severity_filter,
        "cooldown_minutes": policy.cooldown_minutes,
        "enabled": policy.enabled,
    }
