"""PostgreSQL pull connector for scheduled monitoring.

Only profiles and small evidence snapshots are persisted. The monitored data
itself is read into memory, measured, and discarded.
"""

import os
import re

import pandas as pd
from sqlalchemy import create_engine, text

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$")


def _normalize_url(url: str) -> str:
    return url.replace("postgres://", "postgresql://", 1)


def _quote_identifier(identifier: str) -> str:
    if not _IDENTIFIER.match(identifier):
        raise ValueError(f"Unsafe PostgreSQL identifier: {identifier}")
    return ".".join(f'"{part}"' for part in identifier.split("."))


def fetch_postgres(config: dict) -> pd.DataFrame:
    url = config.get("database_url") or os.getenv("MONITORED_DATABASE_URL")
    if not url:
        raise ValueError(
            "PostgreSQL source requires database_url or MONITORED_DATABASE_URL"
        )

    table = config.get("table")
    query = config.get("query")
    if not table and not query:
        raise ValueError("PostgreSQL source requires a table or query")

    if query:
        if ";" in str(query).strip().rstrip(";"):
            raise ValueError("Only a single SELECT statement is allowed")
        sql = str(query)
        params: dict = {}
    else:
        qualified = _quote_identifier(str(table))
        hours = int(config.get("window_hours") or 1)
        timestamp_column = config.get("timestamp_column")
        if timestamp_column:
            column = _quote_identifier(str(timestamp_column))
            sql = (
                f"SELECT * FROM {qualified} "
                f"WHERE {column} >= NOW() - (:window_hours * INTERVAL '1 hour')"
            )
            params = {"window_hours": hours}
        else:
            sql = f"SELECT * FROM {qualified}"
            params = {}

    engine = create_engine(_normalize_url(str(url)), pool_pre_ping=True, future=True)
    try:
        with engine.connect() as connection:
            return pd.read_sql_query(text(sql), connection, params=params)
    finally:
        engine.dispose()
