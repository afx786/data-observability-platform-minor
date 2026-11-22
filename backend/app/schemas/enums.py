"""Shared enumerations used by the API, database and frontend."""

from enum import Enum


class Role(str, Enum):
    """Role hierarchy: admin inherits analyst, analyst inherits viewer."""

    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class SourceType(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    POSTGRESQL = "postgresql"
    REST_API = "rest_api"


class BatchStatus(str, Enum):
    RECEIVED = "received"
    PROFILED = "profiled"
    ANALYZED = "analyzed"
    FAILED = "failed"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class AlertStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    SUPPRESSED = "suppressed"


class DetectorType(str, Enum):
    RULE = "rule"
    SCHEMA = "schema"
    IQR = "iqr"
    ROLLING_ZSCORE = "rolling_zscore"
    KS = "ks"
    CHI_SQUARE = "chi_square"
    BASELINE = "baseline"
    FRESHNESS = "freshness"
    VOLUME = "volume"
    ISOLATION_FOREST = "isolation_forest"
