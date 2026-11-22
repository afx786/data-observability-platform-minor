from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/rules",
    tags=["rules"],
    dependencies=[Depends(get_current_user)],
)

# Schema and rule configuration endpoints are not implemented yet.
