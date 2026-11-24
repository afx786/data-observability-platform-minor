import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.core.config import settings
from app.detection.statistics import detect_iqr


def _frame(mean: float, category: str, rows: int = 100, seed: int = 7) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        {
            "id": range(1, rows + 1),
            "amount": rng.normal(mean, 5, rows).round(2),
            "region": [category] * rows,
        }
    )


def _upload(
    client: TestClient,
    headers: dict[str, str],
    source_id: int,
    frame: pd.DataFrame,
) -> None:
    response = client.post(
        "/api/ingestion/upload",
        files={"file": ("batch.csv", frame.to_csv(index=False).encode("utf-8"), "text/csv")},
        data={"name": "fault-source", "source_id": str(source_id)},
        headers=headers,
    )
    assert response.status_code == 200, response.text


def test_iqr_detector_flags_outliers() -> None:
    values = [10.0] * 90 + [1_000.0] * 10
    findings = detect_iqr(pd.DataFrame({"amount": values}))
    assert any(finding.field == "amount" for finding in findings)


def test_injected_drift_and_isolation_forest_are_detected(
    client: TestClient,
    admin_headers: dict[str, str],
    monkeypatch,
    tmp_path,
) -> None:
    monkeypatch.setattr(settings, "ml_model_dir", str(tmp_path / "models"))

    source = client.post(
        "/api/sources",
        json={
            "name": "fault-source",
            "config": {
                "source_type": "csv",
                "window_hours": 1,
                "ml_exclude_columns": ["id"],
            },
        },
        headers=admin_headers,
    ).json()
    source_id = source["id"]

    # Three stable batches give the rolling detector enough history.
    for index in range(3):
        clean = _frame(100.0, "A" if index % 2 == 0 else "B", seed=7 + index)
        clean["region"] = np.where(
            np.arange(len(clean)) < len(clean) // 2, "A", "B"
        )
        _upload(client, admin_headers, source_id, clean)

    baseline = client.post(
        "/api/baselines", params={"source_id": source_id}, headers=admin_headers
    )
    assert baseline.status_code in {200, 201}, baseline.text

    anomalous = _frame(200.0, "C", seed=17)
    # First post-baseline batch trains the model; it is not scored against itself.
    _upload(client, admin_headers, source_id, anomalous)

    active = client.get(
        "/api/baselines/active", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert active["model_version"] == "v1"

    # Second anomalous batch is scored by the trained model.
    _upload(client, admin_headers, source_id, anomalous)

    incidents = client.get(
        "/api/incidents", params={"source_id": source_id}, headers=admin_headers
    ).json()
    detectors = {incident["detector"] for incident in incidents}
    assert "ks" in detectors
    assert "chi_square" in detectors
    assert "rolling_zscore" in detectors
    assert "isolation_forest" in detectors

    batches = client.get(
        "/api/ingestion/batches", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert any(batch["flagged_rows"] > 0 for batch in batches)

    active_again = client.get(
        "/api/baselines/active", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert active_again["model_version"] == "v1"
