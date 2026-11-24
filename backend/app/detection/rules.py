"""Deterministic data-quality checks with configurable thresholds."""

from typing import Any

from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity

DEFAULT_RULES: list[dict[str, Any]] = [
    {
        "rule_type": "null_rate",
        "column_name": None,
        "params": {"max_null_rate": 0.10, "columns": "all"},
        "severity": "medium",
    },
    {
        "rule_type": "duplicate_rate",
        "column_name": None,
        "params": {"max_duplicate_rate": 0.01},
        "severity": "high",
    },
]


def evaluate_rules(
    profile: dict[str, Any],
    rules: list[dict[str, Any]],
) -> list[Finding]:
    findings: list[Finding] = []

    for rule in rules:
        kind = rule["rule_type"]
        params = rule.get("params") or {}
        severity = Severity(rule.get("severity", "medium"))
        columns = (
            [rule["column_name"]]
            if rule.get("column_name")
            else list(profile.get("columns", {}))
        )

        if kind == "null_rate":
            limit = float(params.get("max_null_rate", 0.10))
            selected = columns if params.get("columns", "all") == "all" else columns
            for column in selected:
                stats = profile.get("columns", {}).get(column)
                if not stats:
                    continue
                observed = stats["null_rate"]
                if observed > limit:
                    findings.append(
                        Finding(
                            detector=DetectorType.RULE,
                            field=column,
                            severity=severity,
                            observed=observed,
                            expected=limit,
                            magnitude=observed / limit if limit else None,
                            message=f"NULL rate {observed:.1%} exceeds limit {limit:.1%}",
                            evidence={"rule": kind, "observed": observed, "expected": limit},
                        )
                    )

        elif kind == "duplicate_rate":
            limit = float(params.get("max_duplicate_rate", 0.01))
            observed = profile.get("duplicate_rate", 0.0)
            if observed > limit:
                findings.append(
                    Finding(
                        detector=DetectorType.RULE,
                        field=None,
                        severity=severity,
                        observed=observed,
                        expected=limit,
                        magnitude=observed / limit if limit else None,
                        message=f"Duplicate rate {observed:.1%} exceeds limit {limit:.1%}",
                        evidence={"rule": kind, "observed": observed, "expected": limit},
                    )
                )

        elif kind == "required_column":
            for column in params.get("columns", []):
                if column not in profile.get("columns", {}):
                    findings.append(
                        Finding(
                            detector=DetectorType.RULE,
                            field=column,
                            severity=severity,
                            message=f"Required column '{column}' is missing",
                            evidence={"rule": kind},
                        )
                    )

        elif kind == "freshness":
            limit = float(params.get("max_freshness_hours", 24))
            observed = profile.get("freshness_hours")
            if observed is not None and observed > limit:
                findings.append(
                    Finding(
                        detector=DetectorType.FRESHNESS,
                        field=None,
                        severity=severity,
                        observed=observed,
                        expected=limit,
                        message=f"Data is {observed:.1f}h old, limit is {limit:.1f}h",
                        evidence={"rule": kind},
                    )
                )

    return findings
