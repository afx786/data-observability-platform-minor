from app.detection.decision import decide_severity
from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity


def finding(detector: DetectorType, **kwargs) -> Finding:
    kwargs.setdefault("severity", Severity.MEDIUM)
    return Finding(detector=detector, message="test finding", **kwargs)


def test_fixed_severity_table() -> None:
    assert decide_severity([finding(DetectorType.SCHEMA)]) == Severity.HIGH
    assert decide_severity([finding(DetectorType.IQR)]) == Severity.LOW
    assert decide_severity([finding(DetectorType.VOLUME)]) == Severity.MEDIUM


def test_large_deviation_bumps_one_level() -> None:
    result = decide_severity(
        [finding(DetectorType.VOLUME, magnitude=6, observed=70, expected=10)]
    )
    assert result == Severity.HIGH


def test_three_occurrences_bump_and_cap_at_critical() -> None:
    assert decide_severity([finding(DetectorType.SCHEMA)], occurrences=3) == Severity.CRITICAL
    assert decide_severity([finding(DetectorType.SCHEMA)], occurrences=10) == Severity.CRITICAL


def test_configured_rule_severity_is_respected() -> None:
    result = decide_severity(
        [
            finding(
                DetectorType.RULE,
                severity=Severity.MEDIUM,
                observed=0.2,
                expected=0.1,
                magnitude=2,
            )
        ]
    )
    assert result == Severity.MEDIUM
