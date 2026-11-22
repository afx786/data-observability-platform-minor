"""Seed the first admin user.

Run once after the database is reachable:

    python -m jobs.create_admin

Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in the environment to
avoid the interactive prompts. All later users are created through the API by
an admin.
"""

import getpass
import os

from app.core.security import hash_password
from app.db.init import init_db
from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.enums import Role


def main() -> None:
    init_db()

    email = (os.getenv("BOOTSTRAP_ADMIN_EMAIL") or input("Admin email: ")).strip().lower()
    password = os.getenv("BOOTSTRAP_ADMIN_PASSWORD") or getpass.getpass("Admin password: ")

    if len(password) < 8:
        raise SystemExit("Admin password must be at least 8 characters")

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first() is not None:
            raise SystemExit(f"User {email} already exists")

        user = User(
            email=email,
            password_hash=hash_password(password),
            role=Role.ADMIN.value,
            is_active=True,
        )
        db.add(user)
        db.commit()
        print(f"Created admin user: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
