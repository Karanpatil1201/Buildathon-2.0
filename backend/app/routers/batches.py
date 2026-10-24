from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Batch, BatchDecision, Product, Inspection, ConfirmedDefect, AuditLog, User
from app.schemas import BatchCreate, BatchUpdate, BatchDecisionCreate, BatchOut, BatchDecisionOut
from app.auth import get_current_user
from app.rbac import (
    PERM_BATCH_READ, PERM_BATCH_CREATE, PERM_BATCH_QUARANTINE,
    PERM_BATCH_RELEASE, require_permissions, has_permission
)

router = APIRouter(prefix="/batches", tags=["Batches"])

def _format_batch_out(b: Batch, db: Session) -> BatchOut:
    total_insp = db.query(func.count(Inspection.id)).filter(Inspection.batch_id == b.id).scalar() or 0
    defect_cnt = db.query(func.count(ConfirmedDefect.id)).filter(ConfirmedDefect.batch_id == b.id).scalar() or 0
    return BatchOut(
        id=b.id,
        product_id=b.product_id,
        batch_number=b.batch_number,
        quantity=b.quantity,
        production_date=b.production_date,
        status=b.status,
        decision_notes=b.decision_notes,
        decided_by_user_id=b.decided_by_user_id,
        decided_at=b.decided_at,
        created_at=b.created_at,
        updated_at=b.updated_at,
        product_code=b.product.code if b.product else None,
        product_name=b.product.name if b.product else None,
        total_inspections=total_insp,
        defect_count=defect_cnt
    )

@router.get("", response_model=List[BatchOut])
def list_batches(
    status_filter: Optional[str] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_BATCH_READ))
):
    query = db.query(Batch)
    if status_filter:
        query = query.filter(Batch.status == status_filter)
    if product_id:
        query = query.filter(Batch.product_id == product_id)
    batches = query.order_by(Batch.created_at.desc()).all()
    return [_format_batch_out(b, db) for b in batches]

@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def create_batch(
    batch_in: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_BATCH_CREATE))
):
    product = db.query(Product).filter(Product.id == batch_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    existing = db.query(Batch).filter(Batch.batch_number == batch_in.batch_number).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Batch number '{batch_in.batch_number}' already exists")

    batch = Batch(
        product_id=batch_in.product_id,
        batch_number=batch_in.batch_number.upper(),
        quantity=batch_in.quantity,
        production_date=batch_in.production_date or datetime.utcnow(),
        status="IN_PROGRESS"
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Log audit event
    audit = AuditLog(
        entity_type="BATCH",
        entity_id=batch.id,
        actor_id=current_user.id,
        action="CREATE_BATCH",
        previous_state=None,
        new_state="IN_PROGRESS",
        notes=f"Registered batch {batch.batch_number} for product {product.code}"
    )
    db.add(audit)
    db.commit()

    return _format_batch_out(batch, db)

@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_BATCH_READ))
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return _format_batch_out(batch, db)

@router.post("/{batch_id}/decisions", response_model=BatchOut)
def record_batch_decision(
    batch_id: int,
    decision_in: BatchDecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    valid_statuses = ["IN_PROGRESS", "ON_HOLD", "RELEASED", "REJECTED"]
    if decision_in.new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid batch status. Allowed: {valid_statuses}")

    if not decision_in.reason or not decision_in.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A documented justification reason is required for batch status decisions."
        )

    # RBAC check: Quarantine requires batch:quarantine, Release requires batch:release
    if decision_in.new_status in ["ON_HOLD", "REJECTED"]:
        if not has_permission(current_user.role, PERM_BATCH_QUARANTINE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required permission: batch:quarantine. Only authorized Quality Managers can quarantine a batch. Your role: {current_user.role}"
            )
    else:
        if not has_permission(current_user.role, PERM_BATCH_RELEASE):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required permission: batch:release. Only authorized Quality Managers can release a batch. Your role: {current_user.role}"
            )

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    prev_status = batch.status
    batch.status = decision_in.new_status
    batch.decision_notes = decision_in.reason
    batch.decided_by_user_id = current_user.id
    batch.decided_at = datetime.utcnow()

    # Record historical decision record
    decision_record = BatchDecision(
        batch_id=batch.id,
        decided_by_user_id=current_user.id,
        previous_status=prev_status,
        new_status=decision_in.new_status,
        reason=decision_in.reason
    )
    db.add(decision_record)

    # Audit log
    audit = AuditLog(
        entity_type="BATCH",
        entity_id=batch.id,
        actor_id=current_user.id,
        action="BATCH_STATUS_DECISION",
        previous_state=prev_status,
        new_state=decision_in.new_status,
        notes=decision_in.reason
    )
    db.add(audit)
    db.commit()
    db.refresh(batch)

    return _format_batch_out(batch, db)

@router.get("/{batch_id}/decisions", response_model=List[BatchDecisionOut])
def get_batch_decision_history(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_BATCH_READ))
):
    decisions = db.query(BatchDecision).filter(BatchDecision.batch_id == batch_id).order_by(BatchDecision.created_at.desc()).all()
    results = []
    for d in decisions:
        results.append(BatchDecisionOut(
            id=d.id,
            batch_id=d.batch_id,
            decided_by_user_id=d.decided_by_user_id,
            previous_status=d.previous_status,
            new_status=d.new_status,
            reason=d.reason,
            created_at=d.created_at,
            decided_by_name=d.decided_by.full_name if d.decided_by else None
        ))
    return results
