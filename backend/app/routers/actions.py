from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import CorrectiveAction, ConfirmedDefect, User, AuditLog
from app.schemas import CorrectiveActionCreate, CorrectiveActionUpdate, CorrectiveActionOut
from app.auth import get_current_user, require_roles

router = APIRouter(prefix="/actions", tags=["Corrective Actions"])

def _format_action_out(a: CorrectiveAction) -> CorrectiveActionOut:
    now = datetime.utcnow()
    is_od = (a.target_date < now and a.status in ["PENDING", "IN_PROGRESS"])
    return CorrectiveActionOut(
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
        defect_code=a.defect.defect_code if a.defect else None,
        is_overdue=is_od
    )

@router.get("", response_model=List[CorrectiveActionOut])
def list_actions(
    status_filter: Optional[str] = None,
    assigned_user_id: Optional[int] = None,
    overdue_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(CorrectiveAction)
    if status_filter:
        query = query.filter(CorrectiveAction.status == status_filter)
    if assigned_user_id:
        query = query.filter(CorrectiveAction.assigned_to_user_id == assigned_user_id)
    if overdue_only:
        now = datetime.utcnow()
        query = query.filter(
            CorrectiveAction.status.in_(["PENDING", "IN_PROGRESS"]),
            CorrectiveAction.target_date < now
        )
    actions = query.order_by(CorrectiveAction.target_date.asc()).all()
    return [_format_action_out(a) for a in actions]

@router.post("", response_model=CorrectiveActionOut, status_code=status.HTTP_201_CREATED)
def create_action(
    action_in: CorrectiveActionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.id == action_in.defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Confirmed defect not found")

    assignee = db.query(User).filter(User.id == action_in.assigned_to_user_id).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assigned user not found")

    action_count = db.query(CorrectiveAction).count() + 1
    action_code = f"CAPA-{action_count:04d}"

    action = CorrectiveAction(
        action_code=action_code,
        defect_id=defect.id,
        title=action_in.title,
        description=action_in.description,
        assigned_to_user_id=assignee.id,
        target_date=action_in.target_date,
        status="PENDING"
    )
    db.add(action)

    # Transition defect review status
    if defect.review_status == "OPEN":
        defect.review_status = "ACTION_ASSIGNED"

    audit = AuditLog(
        entity_type="ACTION",
        entity_id=0,
        actor_id=current_user.id,
        action="CREATE_CORRECTIVE_ACTION",
        previous_state=None,
        new_state="PENDING",
        notes=f"Created {action_code} for defect {defect.defect_code} assigned to {assignee.full_name}"
    )
    db.add(audit)
    db.commit()
    db.refresh(action)

    return _format_action_out(action)

@router.patch("/{action_id}", response_model=CorrectiveActionOut)
def update_action(
    action_id: int,
    action_in: CorrectiveActionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    action = db.query(CorrectiveAction).filter(CorrectiveAction.id == action_id).first()
    if not action:
        raise HTTPException(status_code=404, detail="Corrective action not found")

    prev_status = action.status
    if action_in.status:
        valid_statuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "VERIFIED"]
        if action_in.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid action status. Allowed: {valid_statuses}")
        action.status = action_in.status
        if action_in.status in ["COMPLETED", "VERIFIED"]:
            action.completed_at = datetime.utcnow()
            # Mark defect as REINSPECTION_PENDING or IN_REMEDIATION
            if action.defect:
                action.defect.review_status = "REINSPECTION_PENDING"

    if action_in.title:
        action.title = action_in.title
    if action_in.description:
        action.description = action_in.description
    if action_in.assigned_to_user_id:
        action.assigned_to_user_id = action_in.assigned_to_user_id
    if action_in.target_date:
        action.target_date = action_in.target_date
    if action_in.notes:
        action.notes = action_in.notes

    audit = AuditLog(
        entity_type="ACTION",
        entity_id=action.id,
        actor_id=current_user.id,
        action="UPDATE_ACTION_STATUS",
        previous_state=prev_status,
        new_state=action.status,
        notes=f"Updated action {action.action_code}"
    )
    db.add(audit)
    db.commit()
    db.refresh(action)
    return _format_action_out(action)
