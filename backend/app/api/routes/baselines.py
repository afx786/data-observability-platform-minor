from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.baseline import Baseline
from app.schemas.enums import Role
from app.services.baselines import active_baseline, create_baseline

router = APIRouter(
    prefix="/baselines",
    tags=["baselines"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_baselines(db: Session = Depends(get_db)) -> list[dict]:
    return [
        {
            "id": row.id,
            "source_id": row.data_source_id,
            "version": row.version,
            "reference_window": row.reference_window,
            "model_version": row.model_version,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in db.query(Baseline).order_by(Baseline.id.desc()).all()
    ]


@router.post("", status_code=201)
def approve_baseline(
    source_id: int,
    _analyst=Depends(require_role(Role.ANALYST)),
    db: Session = Depends(get_db),
) -> dict:
    try:
        baseline = create_baseline(db, source_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "id": baseline.id,
        "source_id": baseline.data_source_id,
        "version": baseline.version,
        "status": baseline.status,
    }


@router.get("/active")
def get_active_baseline(source_id: int, db: Session = Depends(get_db)) -> dict | None:
    baseline = active_baseline(db, source_id)
    if baseline is None:
        return None
    return {
        "id": baseline.id,
        "source_id": baseline.data_source_id,
        "version": baseline.version,
        "model_version": baseline.model_version,
        "reference_window": baseline.reference_window,
        "statistics": baseline.statistics,
        "status": baseline.status,
    }
