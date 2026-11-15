from fastapi import APIRouter

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

# Upload, fetch and batch-status endpoints are not implemented yet.
