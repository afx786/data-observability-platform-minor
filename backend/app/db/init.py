"""Session-level database initialisation."""

import logging
import os

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.schemas.enums import Role

import app.models  # noqa: F401 - registers all tables on Base.metadata

logger = logging.getLogger(__name__)


def _bootstrap_admin(db: Session) -> None:
    """Create the first admin once when bootstrap credentials are provided."""
    email = (os.getenv("BOOTSTRAP_ADMIN_EMAIL") or "").strip().lower()
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or ""

    if not email or not password:
        return
    if len(password) < 8:
        logger.warning("Bootstrap admin password is shorter than 8 characters; skipping")
        return
    if db.query(User).filter(User.email == email).first() is not None:
        return

    db.add(
        User(
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN.value,
            is_active=True,
        )
    )
    db.commit()
    logger.info("Created bootstrap admin user: %s", email)


def init_db() -> None:
    """Create tables and seed the first admin when configured.

    Database initialisation failures are logged rather than raised so the health
    endpoint still responds on a machine where PostgreSQL is not reachable yet.
    """
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # pragma: no cover - depends on local infrastructure
        logger.warning("Database initialisation skipped: %s", exc)
        return

    try:
        with SessionLocal() as db:
            _bootstrap_admin(db)
    except Exception as exc:  # pragma: no cover - depends on bootstrap credentials
        logger.warning("Bootstrap admin creation skipped: %s", exc)
