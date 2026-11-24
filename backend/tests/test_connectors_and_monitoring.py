import json

import pytest
from fastapi.testclient import TestClient

from app.connectors.postgres import _quote_identifier, fetch_postgres
from app.connectors.rest import _extract_records, fetch_rest


class FakeResponse:
    def __init__(self, payload: dict) -> None:
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


def test_rest_extracts_nested_records(monkeypatch) -> None:
    payload = {"data": {"orders": [{"id": 1, "amount": 10}, {"id": 2, "amount": 20}]}}
    monkeypatch.setattr(
        "app.connectors.rest.urlopen", lambda request, timeout: FakeResponse(payload)
    )

    frame = fetch_rest(
        {"url": "https://example.test/orders", "json_path": "data.orders"}
    )
    assert list(frame.columns) == ["id", "amount"]
    assert len(frame) == 2


def test_rest_extract_rejects_non_objects() -> None:
    with pytest.raises(ValueError):
        _extract_records([1, 2, 3], "")


def test_postgres_identifier_validation() -> None:
    assert _quote_identifier("public.orders") == '"public"."orders"'
    with pytest.raises(ValueError):
        _quote_identifier("orders; DROP TABLE users")


def test_postgres_requires_dsn(monkeypatch) -> None:
    monkeypatch.delenv("MONITORED_DATABASE_URL", raising=False)
    with pytest.raises(ValueError, match="database_url"):
        fetch_postgres({"table": "orders"})


def test_monitoring_window_and_reports(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    source = client.post(
        "/api/sources",
        json={
            "name": "window-source",
            "config": {"source_type": "csv", "window_hours": 2},
        },
        headers=admin_headers,
    ).json()

    csv = b"id,value\n1,10\n2,20\n3,30\n4,40\n"
    upload = client.post(
        "/api/ingestion/upload",
        files={"file": ("window.csv", csv, "text/csv")},
        data={
            "name": "window-source",
            "source_id": str(source["id"]),
            "window_hours": "2",
        },
        headers=admin_headers,
    )
    assert upload.status_code == 200, upload.text
    assert upload.json()[0]["source_id"] == source["id"]

    summary = client.get(
        "/api/monitoring/summary",
        params={"source_id": source["id"], "window_hours": 2},
        headers=admin_headers,
    )
    assert summary.status_code == 200, summary.text
    body = summary.json()
    assert body["total_rows"] >= 4
    assert body["batches"] >= 1
    assert len(body["trend"]) >= 1

    rate = client.get(
        "/api/monitoring/anomaly-rate",
        params={"source_id": source["id"], "window_hours": 2},
        headers=admin_headers,
    )
    assert rate.status_code == 200, rate.text
    assert any(point["source_id"] == source["id"] for point in rate.json())

    quality = client.get(
        "/api/reports/quality", params={"window_hours": 2}, headers=admin_headers
    )
    assert quality.status_code == 200, quality.text
    assert "by_detector" in quality.json()

    status = client.get("/api/reports/system-status", headers=admin_headers)
    assert status.status_code == 200, status.text
    assert status.json()["database"] == "connected"
