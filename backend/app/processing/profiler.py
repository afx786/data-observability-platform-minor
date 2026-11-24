"""Column and dataset level measurements used by every later stage."""

import math
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd


def jsonable(value: Any) -> Any:
    """Make numpy/pandas values safe for a JSON column."""
    if isinstance(value, dict):
        return {str(key): jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value) if math.isfinite(float(value)) else None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _column_profile(series: pd.Series) -> dict[str, Any]:
    info: dict[str, Any] = {
        "dtype": str(series.dtype),
        "null_count": int(series.isna().sum()),
        "null_rate": float(series.isna().mean()),
        "distinct": int(series.nunique(dropna=True)),
    }

    if pd.api.types.is_numeric_dtype(series):
        values = series.dropna()
        if not values.empty:
            info.update(
                {
                    "min": jsonable(values.min()),
                    "max": jsonable(values.max()),
                    "mean": jsonable(values.mean()),
                    "std": jsonable(values.std()),
                    "q1": jsonable(values.quantile(0.25)),
                    "median": jsonable(values.quantile(0.5)),
                    "q3": jsonable(values.quantile(0.75)),
                }
            )
    else:
        frequencies = series.dropna().astype(str).value_counts().head(20)
        info["categories"] = {
            str(key): int(value) for key, value in frequencies.items()
        }

    return jsonable(info)


def profile_dataframe(
    frame: pd.DataFrame,
    timestamp_column: str | None = None,
    key_columns: list[str] | None = None,
) -> dict[str, Any]:
    rows = len(frame)
    duplicate_subset = key_columns or (list(frame.columns) if rows else None)
    duplicates = int(frame.duplicated(subset=duplicate_subset).sum()) if rows else 0

    profile: dict[str, Any] = {
        "row_count": rows,
        "column_count": len(frame.columns),
        "duplicate_count": duplicates,
        "duplicate_rate": duplicates / rows if rows else 0.0,
        "columns": {str(column): _column_profile(frame[column]) for column in frame.columns},
    }

    if timestamp_column and timestamp_column in frame.columns:
        times = pd.to_datetime(frame[timestamp_column], errors="coerce", utc=True).dropna()
        if not times.empty:
            latest = times.max()
            now = pd.Timestamp.now(tz="UTC")
            profile["date_coverage"] = {
                "start": jsonable(times.min()),
                "end": jsonable(latest),
                "span_days": (latest - times.min()).total_seconds() / 86400,
            }
            profile["freshness_hours"] = (now - latest).total_seconds() / 3600

    return jsonable(profile)
