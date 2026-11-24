"""Email notification policy, severity filter, deduplication and cooldown."""

import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.alert_policy import AlertPolicy
from app.models.incident import Incident


def ensure_policy(db: Session, source_id: int) -> AlertPolicy:
    policy = (
        db.query(AlertPolicy)
        .filter(AlertPolicy.data_source_id == source_id)
        .first()
    )
    if policy is None:
        policy = AlertPolicy(
            data_source_id=source_id,
            recipients=[],
            severity_filter=["high", "critical"],
            cooldown_minutes=60,
            enabled=True,
        )
        db.add(policy)
        db.commit()
        db.refresh(policy)
    return policy


def _recently_sent(db: Session, incident_id: int, cooldown_minutes: int) -> bool:
    sent = (
        db.query(Alert)
        .filter(Alert.incident_id == incident_id, Alert.status == "sent")
        .order_by(Alert.sent_at.desc())
        .all()
    )
    for alert in sent:
        if alert.sent_at is None:
            continue
        sent_at = alert.sent_at
        if sent_at.tzinfo is None:
            sent_at = sent_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - sent_at < timedelta(minutes=cooldown_minutes):
            return True
    return False


def _send_email(recipients: list[str], subject: str, body: str) -> None:
    if not settings.smtp_host:
        raise RuntimeError("SMTP host is not configured")
    if not recipients:
        raise RuntimeError("No recipients configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from or settings.smtp_user or "noreply@observability.local"
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user and settings.smtp_password:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)


def evaluate_alerts(db: Session, incidents: Iterable[Incident]) -> list[Alert]:
    created: list[Alert] = []

    for incident in incidents:
        policy = ensure_policy(db, incident.data_source_id)
        status = "pending"
        reason = None

        if not policy.enabled:
            status, reason = "suppressed", "Alert policy disabled"
        elif incident.status == "resolved":
            status, reason = "suppressed", "Incident already resolved"
        elif incident.severity.lower() not in [s.lower() for s in policy.severity_filter]:
            status, reason = "suppressed", "Severity below policy filter"
        elif _recently_sent(db, incident.id, policy.cooldown_minutes):
            status, reason = "suppressed", "Inside cooldown window"
        else:
            subject = f"[{incident.severity.upper()}] Data quality incident #{incident.id}"
            body = "\n".join(
                [
                    subject,
                    f"Field: {incident.column_name or 'dataset-level'}",
                    f"Detector: {incident.detection_method}",
                    f"Explanation: {incident.explanation}",
                    f"Evidence: {incident.evidence}",
                    f"Recommended action: {incident.recommended_action}",
                ]
            )
            try:
                _send_email(policy.recipients, subject, body)
                status = "sent"
            except Exception as exc:
                status, reason = "failed", str(exc)

        alert = Alert(
            incident_id=incident.id,
            channel="email",
            recipient=", ".join(policy.recipients),
            status=status,
            sent_at=datetime.now(timezone.utc) if status == "sent" else None,
            message=reason,
        )
        db.add(alert)
        created.append(alert)

    db.commit()
    return created
