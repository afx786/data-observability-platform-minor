"""Platform database models.

Importing this package registers every table on ``Base.metadata``, which is what
Alembic or ``Base.metadata.create_all()`` will use.
"""

from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.baseline import Baseline
from app.models.common import TimestampMixin
from app.models.data_source import DataSource
from app.models.incident import Incident
from app.models.ingestion_batch import IngestionBatch
from app.models.profile import Profile
from app.models.rule import Rule
from app.models.schema import Schema
from app.models.user import User

__all__ = [
    "Alert",
    "AuditLog",
    "Baseline",
    "DataSource",
    "Incident",
    "IngestionBatch",
    "Profile",
    "Rule",
    "Schema",
    "User",
    "TimestampMixin",
]
