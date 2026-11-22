"""Session-level database initialisation."""

import logging

from app.db.base import Base
from app.db.session import engine

import app.models  # noqa: F401 - registers all tables on Base.metadata

logger = logging.getLogger(__name__)


def init_db() -> None:
    """Create tables that do not exist yet.

    A failure is logged rather than raised so the health endpoint still works on a
    machine where PostgreSQL is not running yet.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # pragma: no cover - depends on local infrastructure
        logger.warning("Database initialisation skipped: %s", exc)
