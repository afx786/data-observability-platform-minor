"""Source configuration contracts.

``window_hours`` is always 1-24. It never changes a baseline: it only selects how
many hourly batches a dashboard view or rolling comparison looks at.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.enums import SourceType

WindowHours = Annotated[int, Field(default=1, ge=1, le=24)]


class WindowedConfig(BaseModel):
    window_hours: WindowHours = 1
    timestamp_column: str | None = None
    # Polling cadence for pull-based sources. Viewing window never changes this.
    poll_interval_minutes: int = Field(default=60, ge=1, le=1440)


class FileSourceConfig(WindowedConfig):
    source_type: Literal[SourceType.CSV, SourceType.EXCEL]
    # An Excel workbook is split into one table (and one source) per sheet.
    sheet_name: str | None = None


class PostgresSourceConfig(WindowedConfig):
    source_type: Literal[SourceType.POSTGRESQL]
    table: str | None = None
    query: str | None = None
    # Optional per-source DSN. Falls back to MONITORED_DATABASE_URL.
    database_url: str | None = None

    @model_validator(mode="after")
    def require_table_or_query(self) -> "PostgresSourceConfig":
        if not self.table and not self.query:
            raise ValueError("provide either 'table' or 'query'")
        return self


class RestSourceConfig(WindowedConfig):
    source_type: Literal[SourceType.REST_API]
    url: str
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    auth_header: str | None = None
    # Dot path to the records array in the response, e.g. "data.orders".
    json_path: str = ""
    paginated: bool = False
    page_param: str = "page"
    max_pages: int = Field(default=10, ge=1, le=100)


SourceConfig = Annotated[
    FileSourceConfig | PostgresSourceConfig | RestSourceConfig,
    Field(discriminator="source_type"),
]


class SourceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    # source_type is read from config.source_type, so there is only one source of truth.
    config: SourceConfig
