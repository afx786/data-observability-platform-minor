from fastapi.testclient import TestClient


def _create_source(client: TestClient, headers: dict[str, str], name: str) -> int:
    response = client.post(
        "/api/sources",
        json={
            "name": name,
            "config": {"source_type": "csv", "window_hours": 1},
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_rules_and_incident_lifecycle(
    client: TestClient,
    admin_headers: dict[str, str],
) -> None:
    source_id = _create_source(client, admin_headers, "rules-source")

    rule = client.post(
        "/api/rules",
        json={
            "data_source_id": source_id,
            "rule_type": "null_rate",
            "column_name": "email",
            "params": {"max_null_rate": 0.0},
            "severity": "high",
        },
        headers=admin_headers,
    )
    assert rule.status_code == 201, rule.text
    rule_id = rule.json()["id"]

    listed = client.get("/api/rules", params={"source_id": source_id}, headers=admin_headers).json()
    assert any(item["id"] == rule_id for item in listed)

    csv = b"email,amount\n" + b"a@example.com,10\n" * 7 + b",99\n" * 3
    upload = client.post(
        "/api/ingestion/upload",
        files={"file": ("rules.csv", csv, "text/csv")},
        data={"name": "rules-source", "source_id": str(source_id)},
        headers=admin_headers,
    )
    assert upload.status_code == 200, upload.text

    incidents = client.get(
        "/api/incidents", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert incidents
    incident = incidents[0]

    updated = client.patch(
        f"/api/incidents/{incident['id']}",
        params={"status": "acknowledged"},
        headers=admin_headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "acknowledged"

    disabled = client.patch(
        f"/api/rules/{rule_id}", json={"enabled": False}, headers=admin_headers
    )
    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["enabled"] is False


def test_alert_cooldown_suppresses_repeat_notification(
    client: TestClient,
    admin_headers: dict[str, str],
    monkeypatch,
) -> None:
    sent: list[str] = []
    monkeypatch.setattr(
        "app.services.alerts._send_email",
        lambda recipients, subject, body: sent.append(subject),
    )

    source_id = _create_source(client, admin_headers, "alert-source")
    policy = client.put(
        f"/api/alerts/policies/{source_id}",
        json={
            "recipients": ["ops@example.com"],
            "severity_filter": ["low", "medium", "high", "critical"],
            "cooldown_minutes": 60,
            "enabled": True,
        },
        headers=admin_headers,
    )
    assert policy.status_code == 200, policy.text

    csv = b"email,amount\n" + b"a@example.com,10\n" * 7 + b",99\n" * 3
    for index in range(2):
        response = client.post(
            "/api/ingestion/upload",
            files={"file": ("alert.csv", csv, "text/csv")},
            data={"name": "alert-source", "source_id": str(source_id)},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        if index == 0:
            sends_after_first_batch = len(sent)

    incidents = client.get(
        "/api/incidents", params={"source_id": source_id}, headers=admin_headers
    ).json()
    assert incidents
    assert incidents[0]["occurrences"] >= 2

    alerts = client.get("/api/alerts", headers=admin_headers).json()
    source_alerts = [
        alert
        for alert in alerts
        if any(item["id"] == alert["incident_id"] for item in incidents)
    ]
    assert any(alert["status"] == "sent" for alert in source_alerts)
    assert any(alert["status"] == "suppressed" for alert in source_alerts)
    assert len(sent) == sends_after_first_batch
