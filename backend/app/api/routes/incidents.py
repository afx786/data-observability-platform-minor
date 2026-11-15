from fastapi import APIRouter

router = APIRouter(prefix="/incidents", tags=["incidents"])

# Incident listing, detail and status endpoints are not implemented yet.
