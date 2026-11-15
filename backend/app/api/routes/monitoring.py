from fastapi import APIRouter

router = APIRouter(prefix="/monitoring", tags=["monitoring"])

# Monitoring, drift and batch-history endpoints are not implemented yet.
