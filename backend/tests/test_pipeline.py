from fastapi.testclient import TestClient

from app.schemas.enums import DetectorType, Severity


def test_csv_upload_profiles_and_creates_incident(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    csv = (
        b"email,country,amount\n"
        + b"a@example.com,US,10\n" * 4
        + b"b@example.com,US,20\n" * 4
        + b",US,30\n" * 3
        + b"c@example.com,US,40\n"
    )

    response = client.post(
        "/api/ingestion/upload",
        files={"file": ("customers.csv", csv, "text/csv")},
        data={"name": "customers", "window_hours": "1"},
        headers=admin_headers,
    )

    assert response.status_code == 200, response.text
    result = response.json()[0]
    assert result["row_count"] == 12
    assert result["incidents"] >= 1

    source_id = result["source_id"]
    incidents = client.get(
        "/api/incidents", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert any(incident["detector"] == DetectorType.RULE.value for incident in incidents)
    assert any(incident["field"] == "email" for incident in incidents)
    assert incidents[0]["severity"] in {level.value for level in Severity}


def test_profiles_are_persisted(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    csv = b"id,value\n1,10\n2,20\n3,30\n"
    uploaded = client.post(
        "/api/ingestion/upload",
        files={"file": ("simple.csv", csv, "text/csv")},
        data={"name": "simple"},
        headers=admin_headers,
    ).json()[0]

    profiles = client.get(
        "/api/profiles",
        params={"source_id": uploaded["source_id"]},
        headers=admin_headers,
    ).json()

    assert profiles
    assert profiles[0]["metrics"]["row_count"] == 3
    assert "columns" in profiles[0]["metrics"]


def test_baseline_comparison_and_alert_record(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    clean = b"email,amount\n" + b"a@example.com,10\n" * 10
    first = client.post(
        "/api/ingestion/upload",
        files={"file": ("clean.csv", clean, "text/csv")},
        data={"name": "baseline-source"},
        headers=admin_headers,
    ).json()[0]
    source_id = first["source_id"]

    baseline = client.post(
        "/api/baselines",
        params={"source_id": source_id},
        headers=admin_headers,
    )
    assert baseline.status_code in {200, 201}, baseline.text
    assert baseline.json()["version"] == 1

    degraded = b"email,amount\n" + b"a@example.com,10\n" * 7 + b",99\n" * 3
    second = client.post(
        "/api/ingestion/upload",
        files={"file": ("degraded.csv", degraded, "text/csv")},
        data={"name": "baseline-source", "source_id": str(source_id)},
        headers=admin_headers,
    )
    assert second.status_code == 200, second.text

    incidents = client.get(
        "/api/incidents", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert any(incident["detector"] == "baseline" for incident in incidents)

    alerts = client.get("/api/alerts", headers=admin_headers).json()
    assert alerts
    assert alerts[0]["status"] in {"sent", "failed", "suppressed"}
