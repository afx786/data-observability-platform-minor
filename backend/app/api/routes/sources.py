from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/sources",
    tags=["sources"],
    dependencies=[Depends(get_current_user)],
)

# Source management endpoints (list, create, update, delete) are not implemented yet.
