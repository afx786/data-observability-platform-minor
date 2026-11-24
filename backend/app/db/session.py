from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

def _create_engine():
    # SQLite is supported as a local/dev fallback (set DATABASE_URL=sqlite:///./dev.db).
    # Render deployments use PostgreSQL with the psycopg 3 driver.
    if settings.database_url.startswith("sqlite"):
        return create_engine(
            settings.database_url,
            connect_args={"check_same_thread": False},
            future=True,
        )
    return create_engine(settings.database_url, pool_pre_ping=True, future=True)


engine = _create_engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    """FastAPI dependency that yields a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
