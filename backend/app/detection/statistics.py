"""Statistical detectors: IQR, rolling z-score, KS and chi-square drift.

All detectors emit the same ``Finding`` contract. A viewing window only chooses
which historical profiles participate in the rolling comparison; it never
changes a baseline or a fitted model.
"""

from typing import Any, Iterable

import numpy as np
import pandas as pd
from scipy import stats

from app.models.baseline import Baseline
from app.models.profile import Profile
from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity

ID_HINTS = ("id", "key", "uuid")


def feature_columns(frame: pd.DataFrame, config: dict | None = None) -> list[str]:
    """Numeric, non-ID columns eligible for statistical and ML detectors."""
    config = config or {}
    explicit = config.get("ml_features")
    excluded = {str(name).lower() for name in config.get("ml_exclude_columns") or []}

    def eligible(name: str) -> bool:
        lower = name.lower()
        if lower in excluded:
            return False
        if any(hint in lower for hint in ID_HINTS):
            return False
        return pd.api.types.is_numeric_dtype(frame[name])

    if explicit:
        return [name for name in explicit if name in frame.columns and eligible(name)]
    return [name for name in frame.columns if eligible(name)]


def _numeric_values(frame: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(frame[column], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()


def detect_iqr(frame: pd.DataFrame, config: dict | None = None) -> list[Finding]:
    config = config or {}
    threshold = float(config.get("iqr_outlier_rate", 0.05))
    findings: list[Finding] = []

    for column in feature_columns(frame, config):
        values = _numeric_values(frame, column)
        if len(values) < 10:
            continue

        q1, q3 = values.quantile(0.25), values.quantile(0.75)
        iqr = q3 - q1
        if iqr <= 0:
            iqr = 2 * float(values.std(ddof=0) or 0)
        if iqr <= 0:
            continue

        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outliers = int(((values < lower) | (values > upper)).sum())
        rate = outliers / len(values)
        if rate <= threshold:
            continue

        findings.append(
            Finding(
                detector=DetectorType.IQR,
                field=column,
                severity=Severity.LOW,
                observed=rate,
                expected=threshold,
                magnitude=rate / threshold if threshold else None,
                message=(
                    f"{column}: {rate:.1%} of values fall outside the IQR bounds "
                    f"[{lower:.4g}, {upper:.4g}]"
                ),
                evidence={
                    "outlier_count": outliers,
                    "row_count": len(values),
                    "lower_bound": float(lower),
                    "upper_bound": float(upper),
                    "q1": float(q1),
                    "q3": float(q3),
                },
            )
        )
    return findings


def detect_rolling_zscore(
    current: dict[str, Any],
    history: Iterable[Profile],
    config: dict | None = None,
) -> list[Finding]:
    config = config or {}
    threshold = float(config.get("zscore_threshold", 2.5))
    findings: list[Finding] = []
    columns = current.get("columns") or {}

    # One mean per previous batch. This measures batch-level movement, not rows.
    for column, stats_now in columns.items():
        if "mean" not in stats_now:
            continue
        samples = []
        for profile in history:
            previous = (profile.metrics or {}).get("columns", {}).get(column, {})
            if previous.get("mean") is not None:
                samples.append(float(previous["mean"]))
        if len(samples) < 3:
            continue

        mean = float(np.mean(samples))
        std = float(np.std(samples, ddof=1))
        if std <= 0:
            continue

        observed = float(stats_now["mean"])
        z_score = (observed - mean) / std
        if abs(z_score) <= threshold:
            continue

        findings.append(
            Finding(
                detector=DetectorType.ROLLING_ZSCORE,
                field=column,
                severity=Severity.MEDIUM,
                observed=observed,
                expected=mean,
                magnitude=abs(z_score) / threshold,
                message=(
                    f"{column}: batch mean moved {z_score:+.1f} standard deviations "
                    f"from the recent batch means"
                ),
                evidence={
                    "z_score": z_score,
                    "threshold": threshold,
                    "history_size": len(samples),
                    "history_mean": mean,
                    "history_std": std,
                },
            )
        )
    return findings


def detect_numeric_drift(
    frame: pd.DataFrame,
    baseline: Baseline,
    config: dict | None = None,
) -> list[Finding]:
    """Kolmogorov-Smirnov test of current values against the reference normal fit."""
    config = config or {}
    p_value_limit = float(config.get("drift_pvalue", 0.01))
    findings: list[Finding] = []
    reference = (baseline.statistics or {}).get("columns") or {}

    for column in feature_columns(frame, config):
        reference_stats = reference.get(column) or {}
        values = _numeric_values(frame, column)
        if len(values) < 20 or reference_stats.get("mean") is None:
            continue

        mean = float(reference_stats["mean"])
        std = float(reference_stats.get("std") or 0)
        if std <= 0:
            continue

        result = stats.kstest(values, "norm", args=(mean, std))
        if result.pvalue >= p_value_limit:
            continue

        findings.append(
            Finding(
                detector=DetectorType.KS,
                field=column,
                severity=Severity.MEDIUM,
                observed=float(result.statistic),
                expected=p_value_limit,
                magnitude=float(result.statistic) * 5,
                message=(
                    f"{column}: numeric distribution drifted from baseline v{baseline.version} "
                    f"(KS={result.statistic:.3f}, p={result.pvalue:.4g})"
                ),
                evidence={
                    "baseline_version": baseline.version,
                    "ks_statistic": float(result.statistic),
                    "p_value": float(result.pvalue),
                    "reference_mean": mean,
                    "reference_std": std,
                    "current_mean": float(values.mean()),
                },
            )
        )
    return findings


def detect_categorical_drift(
    frame: pd.DataFrame,
    baseline: Baseline,
    config: dict | None = None,
) -> list[Finding]:
    """Chi-square goodness-of-fit against baseline category frequencies."""
    config = config or {}
    p_value_limit = float(config.get("drift_pvalue", 0.01))
    findings: list[Finding] = []
    reference = (baseline.statistics or {}).get("columns") or {}

    for column, reference_stats in reference.items():
        expected_counts = reference_stats.get("categories") or {}
        if len(expected_counts) < 2 or column not in frame.columns:
            continue

        observed_counts = frame[column].dropna().astype(str).value_counts().to_dict()
        categories = sorted(set(expected_counts) | set(observed_counts))
        reference_total = sum(expected_counts.values()) or 1
        observed = [float(observed_counts.get(category, 0)) for category in categories]
        total_observed = sum(observed)
        if total_observed < 20:
            continue

        # Keep reference proportions but scale to the observed sample size and
        # reserve a small probability for previously unseen categories.
        proportions = [
            max(float(expected_counts.get(category, 0)) / reference_total, 1e-6)
            for category in categories
        ]
        scale = total_observed / sum(proportions)
        expected = [proportion * scale for proportion in proportions]

        result = stats.chisquare(f_obs=observed, f_exp=expected)
        if result.pvalue >= p_value_limit:
            continue

        findings.append(
            Finding(
                detector=DetectorType.CHI_SQUARE,
                field=column,
                severity=Severity.MEDIUM,
                observed=float(result.statistic),
                expected=p_value_limit,
                magnitude=float(result.statistic) / max(len(categories), 1),
                message=(
                    f"{column}: category mix changed from baseline v{baseline.version} "
                    f"(chi-square={result.statistic:.2f}, p={result.pvalue:.4g})"
                ),
                evidence={
                    "baseline_version": baseline.version,
                    "chi_square": float(result.statistic),
                    "p_value": float(result.pvalue),
                    "expected_categories": expected_counts,
                    "observed_categories": {
                        str(key): int(value) for key, value in observed_counts.items()
                    },
                },
            )
        )
    return findings


def detect_statistical_drift(
    frame: pd.DataFrame,
    profile: dict[str, Any],
    baseline: Baseline | None,
    history: Iterable[Profile] = (),
    config: dict | None = None,
) -> list[Finding]:
    config = config or {}
    findings = detect_iqr(frame, config)
    findings.extend(detect_rolling_zscore(profile, history, config))
    if baseline:
        findings.extend(detect_numeric_drift(frame, baseline, config))
        findings.extend(detect_categorical_drift(frame, baseline, config))
    return findings
