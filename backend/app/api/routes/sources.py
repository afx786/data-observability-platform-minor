from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.data_source import DataSource
from app.schemas.source import SourceCreate

router = APIRouter(
    prefix="/sources",
    tags=["sources"],
    dependencies=[Depends(get_current_user)],
)


@router.get("")
def list_sources(db: Session = Depends(get_db)) -> list[dict]:
    sources = db.query(DataSource).order_by(DataSource.id).all()
    return [
        {
            "id": source.id,
            "name": source.name,
            "source_type": source.source_type,
            "status": source.status,
            "config": source.config,
        }
        for source in sources
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_source(payload: SourceCreate, db: Session = Depends(get_db)) -> dict:
    config = payload.config.model_dump(mode="json")
    source = DataSource(
        name=payload.name,
        description=payload.description,
        source_type=config["source_type"],
        config=config,
        status="active",
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return {"id": source.id, "name": source.name, "source_type": source.source_type}


@router.get("/{source_id}")
def get_source(source_id: int, db: Session = Depends(get_db)) -> dict:
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return {
        "id": source.id,
        "name": source.name,
        "description": source.description,
        "source_type": source.source_type,
        "status": source.status,
        "config": source.config,
    }
