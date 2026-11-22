from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/ingestion",
    tags=["ingestion"],
    dependencies=[Depends(get_current_user)],
)

# Upload, fetch and batch-status endpoints are not implemented yet.
