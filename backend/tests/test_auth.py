from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.schemas.enums import Role


def test_password_hashing_roundtrip() -> None:
    hashed = hash_password("correct horse battery")

    assert hashed != "correct horse battery"
    assert verify_password("correct horse battery", hashed)
    assert not verify_password("wrong password", hashed)


def test_token_carries_subject_and_role() -> None:
    token = create_access_token("admin@example.com", Role.ADMIN)
    payload = decode_access_token(token)

    assert payload["sub"] == "admin@example.com"
    assert payload["role"] == "admin"
    assert payload["exp"] > payload["iat"]
