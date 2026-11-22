"""End-to-end auth test using SQLite so no PostgreSQL server is needed."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import ROLE_RANK
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


app.dependency_overrides[get_db] = override_get_db

with TestSession() as db:
    db.add_all(
        [
            User(
                email="admin@example.com",
                password_hash=hash_password("adminpass123"),
                role=Role.ADMIN.value,
                is_active=True,
            ),
            User(
                email="viewer@example.com",
                password_hash=hash_password("viewerpass123"),
                role=Role.VIEWER.value,
                is_active=True,
            ),
        ]
    )
    db.commit()


client = TestClient(app)


def _token(email: str, password: str) -> str:
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def admin_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_token('admin@example.com', 'adminpass123')}"}


@pytest.fixture
def viewer_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_token('viewer@example.com', 'viewerpass123')}"}


def test_login_rejects_bad_password() -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "wrong"},
    )

    assert response.status_code == 401


def test_me_returns_current_user(admin_headers: dict[str, str]) -> None:
    response = client.get("/api/auth/me", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["email"] == "admin@example.com"
    assert response.json()["role"] == "admin"


def test_admin_can_list_users(admin_headers: dict[str, str]) -> None:
    response = client.get("/api/auth/users", headers=admin_headers)

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_viewer_cannot_list_users(viewer_headers: dict[str, str]) -> None:
    response = client.get("/api/auth/users", headers=viewer_headers)

    assert response.status_code == 403


def test_missing_token_is_rejected() -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == 401


def test_role_ranking_matches_expectation() -> None:
    assert [ROLE_RANK[role] for role in Role] == [2, 1, 0]
