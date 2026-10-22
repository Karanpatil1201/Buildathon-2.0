from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ConfirmedDefect, CorrectiveAction, Inspection, Reinspection, AuditLog, User
from app.schemas import ConfirmedDefectOut, ConfirmedDefectUpdate, CorrectiveActionOut
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/defects", tags=["Confirmed Defects"])

def _format_defect_out(d: ConfirmedDefect) -> ConfirmedDefectOut:
    actions_out = []
    now = datetime.utcnow()
    for a in d.corrective_actions:
        actions_out.append(CorrectiveActionOut(
            id=a.id,
            action_code=a.action_code,
            defect_id=a.defect_id,
            title=a.title,
            description=a.description,
            assigned_to_user_id=a.assigned_to_user_id,
            target_date=a.target_date,
            status=a.status,
            notes=a.notes,
            created_at=a.created_at,
            completed_at=a.completed_at,
            assigned_to_name=a.assigned_to.full_name if a.assigned_to else None,
            defect_code=d.defect_code,
            is_overdue=(a.target_date < now and a.status in ["PENDING", "IN_PROGRESS"])
        ))
    return ConfirmedDefectOut(
        id=d.id,
        defect_code=d.defect_code,
        inspection_id=d.inspection_id,
        batch_id=d.batch_id,
        defect_category=d.defect_category,
        severity=d.severity,
        description=d.description,
        review_status=d.review_status,
        created_at=d.created_at,
        resolved_at=d.resolved_at,
        batch_number=d.batch.batch_number if d.batch else None,
        product_name=d.batch.product.name if d.batch and d.batch.product else None,
        corrective_actions=actions_out
    )

@router.get("", response_model=List[ConfirmedDefectOut])
def list_defects(
    status_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ConfirmedDefect)
    if status_filter:
        query = query.filter(ConfirmedDefect.review_status == status_filter)
    if severity_filter:
        query = query.filter(ConfirmedDefect.severity == severity_filter)
    if batch_id:
        query = query.filter(ConfirmedDefect.batch_id == batch_id)
    defects = query.order_by(ConfirmedDefect.created_at.desc()).all()
    return [_format_defect_out(d) for d in defects]

@router.get("/{defect_id}", response_model=ConfirmedDefectOut)
def get_defect(defect_id: int, db: Session = Depends(get_db)):
    defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    return _format_defect_out(defect)

@router.patch("/{defect_id}", response_model=ConfirmedDefectOut)
def update_defect(
    defect_id: int,
    defect_in: ConfirmedDefectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")

    prev_status = defect.review_status
    if defect_in.review_status:
        valid_statuses = ["OPEN", "ACTION_ASSIGNED", "IN_REMEDIATION", "REINSPECTION_PENDING", "RESOLVED", "REOPENED"]
        if defect_in.review_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid review status. Allowed: {valid_statuses}")
        defect.review_status = defect_in.review_status
        if defect_in.review_status == "RESOLVED":
            defect.resolved_at = datetime.utcnow()
        elif defect_in.review_status == "REOPENED":
            defect.resolved_at = None

    if defect_in.defect_category:
        defect.defect_category = defect_in.defect_category
    if defect_in.severity:
        defect.severity = defect_in.severity
    if defect_in.description:
        defect.description = defect_in.description

    audit = AuditLog(
        entity_type="DEFECT",
        entity_id=defect.id,
        actor_id=current_user.id,
        action="UPDATE_DEFECT_STATUS",
        previous_state=prev_status,
        new_state=defect.review_status,
        notes=f"Updated defect {defect.defect_code}"
    )
    db.add(audit)
    db.commit()
    db.refresh(defect)
    return _format_defect_out(defect)
