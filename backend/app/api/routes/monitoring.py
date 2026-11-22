from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/monitoring",
    tags=["monitoring"],
    dependencies=[Depends(get_current_user)],
)

# Monitoring, drift and batch-history endpoints are not implemented yet.
