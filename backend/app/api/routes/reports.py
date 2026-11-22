from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/reports",
    tags=["reports"],
    dependencies=[Depends(get_current_user)],
)

# Quality/anomaly reports and system-status endpoints are not implemented yet.
