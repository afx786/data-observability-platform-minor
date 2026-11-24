from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.profile import Profile

router = APIRouter(
    prefix="/profiles",
    tags=["profiles"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_profiles(
    source_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Profile)
    if source_id is not None:
        query = query.filter(Profile.data_source_id == source_id)

    return [
        {
            "id": row.id,
            "source_id": row.data_source_id,
            "batch_id": row.ingestion_batch_id,
            "metrics": row.metrics,
        }
        for row in query.order_by(Profile.id.desc()).limit(100).all()
    ]
