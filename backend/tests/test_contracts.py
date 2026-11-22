import pytest
from pydantic import ValidationError

from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Role, Severity, SourceType
from app.schemas.source import FileSourceConfig, SourceCreate

from app.api.deps import ROLE_RANK


@pytest.mark.parametrize("hours", [1, 12, 24])
def test_window_hours_accepts_1_to_24(hours: int) -> None:
    config = FileSourceConfig(source_type=SourceType.CSV, window_hours=hours)

    assert config.window_hours == hours


@pytest.mark.parametrize("hours", [0, -1, 25])
def test_window_hours_rejects_out_of_range(hours: int) -> None:
    with pytest.raises(ValidationError):
        FileSourceConfig(source_type=SourceType.CSV, window_hours=hours)


def test_source_create_reads_type_from_config() -> None:
    source = SourceCreate(
        name="payments",
        config={
            "source_type": "rest_api",
            "url": "https://example.com/api/orders",
            "json_path": "data",
            "window_hours": 6,
        },
    )

    assert source.config.source_type == SourceType.REST_API
    assert source.config.window_hours == 6


def test_postgres_source_requires_table_or_query() -> None:
    with pytest.raises(ValidationError):
        SourceCreate(name="db", config={"source_type": "postgresql"})


def test_finding_has_uniform_shape() -> None:
    finding = Finding(
        detector=DetectorType.RULE,
        severity=Severity.HIGH,
        field="email",
        observed=14.7,
        expected=1.8,
        message="NULL rate exceeded threshold",
    )

    assert finding.evidence == {}
    assert finding.batch_id is None


def test_roles_inherit_permissions() -> None:
    assert ROLE_RANK[Role.VIEWER] < ROLE_RANK[Role.ANALYST] < ROLE_RANK[Role.ADMIN]
