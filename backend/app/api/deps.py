"""Request dependencies for authentication and role-based access."""

from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.enums import Role

# Swagger's Authorize button posts form data to /auth/token; the React app uses
# the JSON endpoint /auth/login directly.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

# Higher number means more permissions; each role inherits the ones below it.
ROLE_RANK: dict[Role, int] = {
    Role.VIEWER: 0,
    Role.ANALYST: 1,
    Role.ADMIN: 2,
}


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if not email:
            raise _credentials_error()
    except Exception:
        raise _credentials_error()

    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.is_active:
        raise _credentials_error()
    return user


def require_role(minimum: Role) -> Callable[..., User]:
    """Require at least ``minimum`` role level, including inherited permissions."""

    def checker(user: User = Depends(get_current_user)) -> User:
        try:
            current = Role(user.role)
        except ValueError:
            raise _credentials_error()
        if ROLE_RANK[current] < ROLE_RANK[minimum]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum.value} role or higher",
            )
        return user

    return checker
