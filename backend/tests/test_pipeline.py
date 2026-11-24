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
