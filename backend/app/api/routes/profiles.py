from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/profiles",
    tags=["profiles"],
    dependencies=[Depends(get_current_user)],
)

# Profiling endpoints are not implemented yet.
