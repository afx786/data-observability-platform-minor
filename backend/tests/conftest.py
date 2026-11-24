"""Shared SQLite test database so the whole pipeline can run without PostgreSQL."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import ROLE_RANK  # noqa: F401 - keeps role hierarchy imported
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.user import User
from app.schemas.enums import Role

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(engine)


def override_get_db() -> Iterator[Session]:
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def configure_app():
    app.dependency_overrides[get_db] = override_get_db
    with TestSession() as db:
        for email, password, role in [
            ("admin@example.com", "adminpass123", Role.ADMIN),
            ("viewer@example.com", "viewerpass123", Role.VIEWER),
        ]:
            if db.query(User).filter(User.email == email).first() is None:
                db.add(
                    User(
                        email=email,
                        password_hash=hash_password(password),
                        role=role.value,
                        is_active=True,
                    )
                )
        db.commit()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def admin_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "adminpass123"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
