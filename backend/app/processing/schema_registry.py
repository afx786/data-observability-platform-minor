"""Expected structure for a source, and comparison of later batches against it."""

from typing import Any

import pandas as pd

from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity


def infer_schema(frame: pd.DataFrame) -> dict[str, Any]:
    return {
        str(column): {
            "dtype": str(frame[column].dtype),
            "nullable": bool(frame[column].isna().any()),
            "unique": bool(len(frame) and frame[column].is_unique),
        }
        for column in frame.columns
    }


def compare_schema(expected: dict[str, Any], observed: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []

    for column, spec in expected.items():
        if column not in observed:
            findings.append(
                Finding(
                    detector=DetectorType.SCHEMA,
                    field=column,
                    severity=Severity.HIGH,
                    message=f"Required column '{column}' is missing",
                    evidence={"expected": spec, "observed": None},
                )
            )
            continue

        current = observed[column]
        if spec["dtype"] != current["dtype"]:
            findings.append(
                Finding(
                    detector=DetectorType.SCHEMA,
                    field=column,
                    severity=Severity.HIGH,
                    message=f"Column '{column}' changed type: {spec['dtype']} -> {current['dtype']}",
                    evidence={"expected": spec["dtype"], "observed": current["dtype"]},
                )
            )
        elif spec.get("nullable") is False and current.get("nullable") is True:
            findings.append(
                Finding(
                    detector=DetectorType.SCHEMA,
                    field=column,
                    severity=Severity.MEDIUM,
                    message=f"Column '{column}' now contains NULL values",
                    evidence={"expected": "no nulls", "observed": "nulls present"},
                )
            )

    for column in observed:
        if column not in expected:
            findings.append(
                Finding(
                    detector=DetectorType.SCHEMA,
                    field=column,
                    severity=Severity.MEDIUM,
                    message=f"Unexpected column '{column}' appeared",
                    evidence={"expected": None, "observed": observed[column]},
                )
            )

    return findings
