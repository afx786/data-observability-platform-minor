from sqlalchemy.schema import CreateTable
from sqlalchemy.dialects import postgresql

import app.models  # noqa: F401 - registers every model on Base.metadata
from app.db.base import Base

EXPECTED_TABLES = {
    "users",
    "data_sources",
    "schemas",
    "rules",
    "ingestion_batches",
    "profiles",
    "baselines",
    "incidents",
    "alerts",
    "audit_logs",
}


def test_all_platform_tables_are_registered() -> None:
    assert set(Base.metadata.tables) == EXPECTED_TABLES


def test_tables_compile_for_postgresql() -> None:
    dialect = postgresql.dialect()

    for table in Base.metadata.sorted_tables:
        assert str(CreateTable(table).compile(dialect=dialect))
