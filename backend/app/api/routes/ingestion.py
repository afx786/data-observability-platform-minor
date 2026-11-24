from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.data_source import DataSource
from app.models.ingestion_batch import IngestionBatch
from app.processing.normalize import from_csv, from_excel
from app.services.monitoring import monitor_frame

router = APIRouter(
    prefix="/ingestion",
    tags=["ingestion"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    window_hours: int = Form(1),
    timestamp_column: str | None = Form(None),
    source_id: int | None = Form(None),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    if not 1 <= window_hours <= 24:
        raise HTTPException(status_code=422, detail="window_hours must be 1-24")

    content = await file.read()
    filename = (file.filename or "").lower()

    if filename.endswith((".csv", ".txt")):
        datasets = [(name, from_csv(content), "csv", None)]
    elif filename.endswith((".xlsx", ".xls")):
        datasets = [
            (f"{name}::{sheet}", frame, "excel", sheet)
            for sheet, frame in from_excel(content).items()
        ]
    else:
        raise HTTPException(status_code=400, detail="Upload a CSV or Excel file")

    if not datasets:
        raise HTTPException(status_code=400, detail="No readable sheets found")

    results: list[dict[str, Any]] = []
    for dataset_name, frame, source_type, sheet in datasets:
        config = {
            "source_type": source_type,
            "window_hours": window_hours,
            "timestamp_column": timestamp_column,
        }
        if sheet:
            config["sheet_name"] = sheet

        source = (
            db.query(DataSource).filter(DataSource.id == source_id).first()
            if source_id is not None
            else None
        )
        if source is None:
            source = DataSource(
                name=dataset_name,
                source_type=source_type,
                config=config,
                status="active",
            )
            db.add(source)
        else:
            # Re-uploading to an existing source updates its view settings but keeps
            # the schema, baseline and incident history attached to that source.
            source.config = {**(source.config or {}), **config}
            source.status = "active"
        db.commit()
        db.refresh(source)

        outcome = monitor_frame(db, source, frame)
        results.append(
            {
                "source_id": source.id,
                "source_name": source.name,
                "batch_id": outcome["batch"].id,
                "row_count": outcome["batch"].row_count,
                "findings": len(outcome["findings"]),
                "incidents": len(outcome["incidents"]),
            }
        )

    return results


@router.get("/batches")
def list_batches(
    source_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    query = db.query(IngestionBatch)
    if source_id is not None:
        query = query.filter(IngestionBatch.data_source_id == source_id)

    batches = query.order_by(IngestionBatch.id.desc()).limit(200).all()
    return [
        {
            "id": batch.id,
            "source_id": batch.data_source_id,
            "status": batch.status,
            "received_at": batch.received_at.isoformat() if batch.received_at else None,
            "window_start": batch.window_start.isoformat() if batch.window_start else None,
            "window_end": batch.window_end.isoformat() if batch.window_end else None,
            "row_count": batch.row_count,
            "flagged_rows": batch.flagged_rows,
        }
        for batch in batches
    ]
