"""Request contracts for configurable quality rules."""

from typing import Any, Literal

from pydantic import BaseModel, Field

RuleType = Literal["null_rate", "duplicate_rate", "required_column", "freshness"]


class RuleCreate(BaseModel):
    data_source_id: int
    rule_type: RuleType
    column_name: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    severity: str = "medium"
    enabled: bool = True


class RuleUpdate(BaseModel):
    enabled: bool | None = None
    column_name: str | None = None
    params: dict[str, Any] | None = None
    severity: str | None = None
