// Mirrors backend/app/schemas/enums.py so the UI and API use the same words.

export const Role = {
  ADMIN: "admin",
  ANALYST: "analyst",
  VIEWER: "viewer",
};

// Higher number means more permissions; each role inherits the ones below it.
export const ROLE_RANK = {
  [Role.VIEWER]: 0,
  [Role.ANALYST]: 1,
  [Role.ADMIN]: 2,
};

export const SourceType = {
  CSV: "csv",
  EXCEL: "excel",
  POSTGRESQL: "postgresql",
  REST_API: "rest_api",
};

export const Severity = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export const IncidentStatus = {
  OPEN: "open",
  ACKNOWLEDGED: "acknowledged",
  RESOLVED: "resolved",
};

export const AlertStatus = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
  SUPPRESSED: "suppressed",
};

export const DetectorType = {
  RULE: "rule",
  SCHEMA: "schema",
  IQR: "iqr",
  ROLLING_ZSCORE: "rolling_zscore",
  KS: "ks",
  CHI_SQUARE: "chi_square",
  BASELINE: "baseline",
  FRESHNESS: "freshness",
  VOLUME: "volume",
  ISOLATION_FOREST: "isolation_forest",
};

export const WINDOW_HOURS_MIN = 1;
export const WINDOW_HOURS_MAX = 24;
