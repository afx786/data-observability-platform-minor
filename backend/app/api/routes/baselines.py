from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

router = APIRouter(
    prefix="/baselines",
    tags=["baselines"],
    dependencies=[Depends(get_current_user)],
)

# Baseline listing, comparison and controlled update endpoints are not implemented yet.
