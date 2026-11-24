from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.data_source import DataSource
from app.models.rule import Rule
from app.models.schema import Schema
from app.schemas.enums import Role, Severity
from app.schemas.rule import RuleCreate, RuleUpdate

router = APIRouter(
    prefix="/rules",
    tags=["rules"],
    dependencies=[Depends(get_current_user)],
)


def _rule_dict(row: Rule) -> dict:
    return {
        "id": row.id,
        "data_source_id": row.data_source_id,
        "column_name": row.column_name,
        "rule_type": row.rule_type,
        "severity": row.severity.lower(),
        "enabled": row.enabled,
        "params": row.params,
    }


@router.get("/schemas")
def list_schemas(
    source_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Schema)
    if source_id is not None:
        query = query.filter(Schema.data_source_id == source_id)
    return [
        {
            "id": row.id,
            "data_source_id": row.data_source_id,
            "version": row.version,
            "definition": row.definition,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in query.order_by(Schema.id.desc()).all()
    ]


@router.get("")
def list_rules(
    source_id: int | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    query = db.query(Rule)
    if source_id is not None:
        query = query.filter(Rule.data_source_id == source_id)
    return [_rule_dict(row) for row in query.order_by(Rule.id).all()]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_rule(
    payload: RuleCreate,
    _analyst=Depends(require_role(Role.ANALYST)),
    db: Session = Depends(get_db),
) -> dict:
    if db.query(DataSource).filter(DataSource.id == payload.data_source_id).first() is None:
        raise HTTPException(status_code=404, detail="Source not found")
    try:
        Severity(payload.severity.lower())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid severity") from exc

    rule = Rule(
        data_source_id=payload.data_source_id,
        rule_type=payload.rule_type,
        column_name=payload.column_name,
        params=payload.params,
        severity=payload.severity.lower(),
        enabled=payload.enabled,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _rule_dict(rule)


@router.patch("/{rule_id}")
def update_rule(
    rule_id: int,
    payload: RuleUpdate,
    _analyst=Depends(require_role(Role.ANALYST)),
    db: Session = Depends(get_db),
) -> dict:
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")

    updates = payload.model_dump(exclude_unset=True)
    if "severity" in updates and updates["severity"] is not None:
        try:
            Severity(updates["severity"].lower())
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid severity") from exc
        updates["severity"] = updates["severity"].lower()
    for key, value in updates.items():
        setattr(rule, key, value)

    db.commit()
    db.refresh(rule)
    return _rule_dict(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: int,
    _analyst=Depends(require_role(Role.ANALYST)),
    db: Session = Depends(get_db),
) -> Response:
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
