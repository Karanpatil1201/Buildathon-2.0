import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Inspection, HumanReview, ConfirmedDefect, AuditLog, User
from app.schemas import HumanReviewCreate, HumanReviewOut, InspectionDetailOut
from app.rbac import PERM_INSPECTION_REVIEW, require_permissions
from app.routers.inspections import get_inspection_detail

router = APIRouter(prefix="/reviews", tags=["Human Reviews"])

@router.post("/{inspection_id}", response_model=InspectionDetailOut)
def submit_human_review(
    inspection_id: int,
    review_in: HumanReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_REVIEW))
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Separation of duties check:
    # An inspector or operator cannot review or approve their own submitted inspection
    if insp.inspector_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Separation of duties policy violation: An inspector cannot review or approve their own inspection submission. A Quality Manager or Supervisor must review this record."
        )

    valid_decisions = ["CONFIRMED_DEFECT", "NO_DEFECT_CONFIRMED", "NEEDS_MORE_EVIDENCE"]
    if review_in.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Allowed: {valid_decisions}")

    # Create immutable Human Review record
    review = HumanReview(
        inspection_id=insp.id,
        reviewer_id=current_user.id,
        decision=review_in.decision,
        reason=review_in.reason,
        notes=review_in.notes
    )
    db.add(review)

    prev_status = insp.status

    if review_in.decision == "CONFIRMED_DEFECT":
        insp.status = "CONFIRMED_DEFECT"
        
        # Check if confirmed defect record already exists
        existing_defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.inspection_id == insp.id).first()
        if not existing_defect:
            defect_count = db.query(ConfirmedDefect).count() + 1
            defect_code = f"DEF-{defect_count:04d}"
            
            category = review_in.defect_category or "BLOWHOLE"
            severity = review_in.severity or "MAJOR"
            desc = review_in.notes or review_in.reason or f"Confirmed {category} defect on item {insp.item_identifier}"

            confirmed_defect = ConfirmedDefect(
                defect_code=defect_code,
                inspection_id=insp.id,
                batch_id=insp.batch_id,
                defect_category=category,
                severity=severity,
                description=desc,
                review_status="OPEN"
            )
            db.add(confirmed_defect)
    elif review_in.decision == "NO_DEFECT_CONFIRMED":
        insp.status = "PASSED"
        # If there was an open defect attached, resolve it
        existing_defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.inspection_id == insp.id).first()
        if existing_defect:
            existing_defect.review_status = "RESOLVED"
            existing_defect.resolved_at = datetime.utcnow()
    else:  # NEEDS_MORE_EVIDENCE
        insp.status = "UNDER_REVIEW"

    # Audit log
    audit = AuditLog(
        entity_type="INSPECTION",
        entity_id=insp.id,
        actor_id=current_user.id,
        action="HUMAN_REVIEW_DECISION",
        previous_state=prev_status,
        new_state=insp.status,
        notes=f"Decision: {review_in.decision}. Reason: {review_in.reason or 'N/A'}"
    )
    db.add(audit)
    db.commit()

    return get_inspection_detail(insp.id, db)
