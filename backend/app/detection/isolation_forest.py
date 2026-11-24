"""Isolation Forest anomaly detector with one model per source and baseline version.

The model is trained only when a baseline is explicitly approved (or when its
feature set changes), never on every incoming batch. Row scores are aggregated
into a single batch finding; no row-level data is persisted.
"""

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy.orm import Session

from app.core.config import settings
from app.detection.statistics import _numeric_values, feature_columns
from app.models.baseline import Baseline
from app.models.data_source import DataSource
from app.schemas.common import Finding
from app.schemas.enums import DetectorType, Severity


def _paths(source_id: int, version: str) -> tuple[Path, Path]:
    directory = Path(settings.ml_model_dir)
    directory.mkdir(parents=True, exist_ok=True)
    stem = f"source_{source_id}_{version.replace('/', '_')}"
    return directory / f"{stem}.joblib", directory / f"{stem}.json"


def _matrix(frame: pd.DataFrame, features: list[str]) -> np.ndarray:
    columns = [_numeric_values(frame, feature).reindex(frame.index) for feature in features]
    return np.column_stack(columns)


def detect_isolation_forest(
    db: Session,
    source: DataSource,
    frame: pd.DataFrame,
    baseline: Baseline | None,
) -> tuple[list[Finding], int, str | None]:
    if baseline is None or frame.empty:
        return [], 0, None

    config = source.config or {}
    features = feature_columns(frame, config)
    if not features or len(frame) < 10:
        return [], 0, None

    version = baseline.model_version or f"v{baseline.version}"
    model_path, metadata_path = _paths(source.id, version)
    metadata = {
        "version": version,
        "baseline_version": baseline.version,
        "features": features,
        "source_id": source.id,
    }
    needs_training = not model_path.exists() or not metadata_path.exists()
    if not needs_training:
        try:
            saved = json.loads(metadata_path.read_text(encoding="utf-8"))
            needs_training = saved.get("features") != features
        except (OSError, ValueError):
            needs_training = True

    if needs_training:
        pipeline = Pipeline(
            [
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
                (
                    "model",
                    IsolationForest(
                        n_estimators=100,
                        contamination="auto",
                        random_state=42,
                        n_jobs=-1,
                    ),
                ),
            ]
        )
        pipeline.fit(_matrix(frame, features))
        joblib.dump(pipeline, model_path)
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

        baseline.model_version = version
        db.commit()
        # The training batch is the reference. It is not scored against itself.
        return [], 0, version

    pipeline = joblib.load(model_path)
    matrix = _matrix(frame, features)
    predictions = pipeline.predict(matrix)
    flagged = int(np.count_nonzero(predictions == -1))
    rate = flagged / len(frame)
    threshold = float(config.get("isolation_forest_rate_threshold", 0.10))

    findings: list[Finding] = []
    if rate > threshold:
        findings.append(
            Finding(
                detector=DetectorType.ISOLATION_FOREST,
                field=None,
                severity=Severity.MEDIUM,
                observed=rate,
                expected=threshold,
                magnitude=rate / threshold if threshold else None,
                message=(
                    f"{rate:.1%} of rows were flagged as anomalous by Isolation Forest "
                    f"({version})"
                ),
                evidence={
                    **metadata,
                    "flagged_rows": flagged,
                    "row_count": len(frame),
                    "threshold": threshold,
                    "features": features,
                },
            )
        )
    return findings, flagged, version
