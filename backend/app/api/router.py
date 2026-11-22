"""Aggregates every route module into one router mounted under the API prefix."""

from fastapi import APIRouter

from app.api.routes import (
    alerts,
    auth,
    baselines,
    incidents,
    ingestion,
    monitoring,
    profiles,
    reports,
    rules,
    sources,
)

api_router = APIRouter()

# Auth endpoints are public (login/token); user management checks roles itself.
api_router.include_router(auth.router)

api_router.include_router(sources.router)
api_router.include_router(ingestion.router)
api_router.include_router(profiles.router)
api_router.include_router(monitoring.router)
api_router.include_router(incidents.router)
api_router.include_router(baselines.router)
api_router.include_router(rules.router)
api_router.include_router(alerts.router)
api_router.include_router(reports.router)
