from fastapi import APIRouter

router = APIRouter(prefix="/alerts", tags=["alerts"])

# Alert policy, history and notification-status endpoints are not implemented yet.
