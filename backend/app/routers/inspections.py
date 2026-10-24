import hashlib
import json
import jwt
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Inspection, ImageEvidence, InferenceAttempt, Product, Batch, User, AuditLog, Reinspection, ConfirmedDefect, CorrectiveAction
from app.schemas import InspectionCreate, InspectionOut, InspectionDetailOut, InferenceAttemptOut, ImageEvidenceOut, HumanReviewOut, ComparisonReviewCreate
from app.auth import get_current_user
from app.config import settings
from app.ml.classifier import ml_engine
from app.ml.domain_gate import domain_gate

router = APIRouter(prefix="/inspections", tags=["Inspections"])

ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

def _format_inspection_out(insp: Inspection) -> InspectionOut:
    latest_inf = insp.inference_attempts[0] if insp.inference_attempts else None
    latest_img = insp.images[0] if insp.images else None

    return InspectionOut(
        id=insp.id,
        product_id=insp.product_id,
        batch_id=insp.batch_id,
        item_identifier=insp.item_identifier,
        inspector_id=insp.inspector_id,
        notes=insp.notes,
        status=insp.status,
        is_reinspection=insp.is_reinspection,
        original_inspection_id=insp.original_inspection_id,
        created_at=insp.created_at,
        updated_at=insp.updated_at,
        product_code=insp.product.code if insp.product else None,
        product_name=insp.product.name if insp.product else None,
        batch_number=insp.batch.batch_number if insp.batch else None,
        inspector_name=insp.inspector.full_name if insp.inspector else None,
        latest_prediction=latest_inf.raw_prediction if latest_inf else None,
        latest_defect_type=getattr(latest_inf, "defect_type", None) if latest_inf else None,
        latest_defect_name=getattr(latest_inf, "defect_display_name", None) if latest_inf else None,
        latest_confidence=latest_inf.confidence_score if latest_inf else None,
        latest_image_url=f"/api/v1/inspections/images/{latest_img.file_path}" if latest_img else None,
        latest_heatmap_url=f"/api/v1/inspections/images/{latest_img.heatmap_path}" if latest_img and latest_img.heatmap_path else None
    )

from app.rbac import (
    PERM_INSPECTION_REVIEW,
    PERM_INSPECTION_CREATE, PERM_INSPECTION_READ, PERM_INSPECTION_READ_ALL,
    PERM_INSPECTION_RETRY, require_permissions, has_permission
)

@router.get("", response_model=List[InspectionOut])
def list_inspections(
    batch_id: Optional[int] = None,
    product_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_READ))
):
    query = db.query(Inspection)

    # Object-level access check: operators may only view their own inspections
    if not has_permission(current_user.role, PERM_INSPECTION_READ_ALL):
        query = query.filter(Inspection.inspector_id == current_user.id)

    if batch_id:
        query = query.filter(Inspection.batch_id == batch_id)
    if product_id:
        query = query.filter(Inspection.product_id == product_id)
    if status_filter:
        query = query.filter(Inspection.status == status_filter)
    if search:
        query = query.filter(Inspection.item_identifier.ilike(f"%{search}%"))
    
    inspections = query.order_by(Inspection.created_at.desc()).limit(limit).all()
    return [_format_inspection_out(i) for i in inspections]

@router.get("/eval-samples")
def list_eval_samples():
    """Returns the list of authentic held-out steel surface samples for 1-click test inspections."""
    manifest_path = settings.EVAL_SAMPLES_DIR / "samples_manifest.json"
    if manifest_path.exists():
        with open(manifest_path, "r") as f:
            return json.load(f)
    return []

@router.get("/eval-samples/{filename}")
def get_eval_sample_image(filename: str):
    file_path = settings.EVAL_SAMPLES_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Sample image not found")
    return FileResponse(str(file_path))

@router.post("", response_model=InspectionDetailOut, status_code=status.HTTP_201_CREATED)
async def create_inspection_with_evidence(
    product_id: int = Form(...),
    batch_id: int = Form(...),
    item_identifier: str = Form(...),
    notes: Optional[str] = Form(None),
    is_reinspection: bool = Form(False),
    original_inspection_id: Optional[int] = Form(None),
    image_scope: str = Form("ITEM"),
    linked_action_id: Optional[int] = Form(None),
    sample_preset: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_CREATE))
):
    # Validation
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Selected product does not exist")

    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Selected batch does not exist")

    if not item_identifier.strip():
        raise HTTPException(status_code=400, detail="Item identifier cannot be empty")

    # Handle image file: either uploaded file or preset sample
    saved_filename = None
    original_filename = None
    mime_type = "image/jpeg"
    file_bytes = b""

    if sample_preset:
        preset_path = settings.EVAL_SAMPLES_DIR / sample_preset
        if not preset_path.exists():
            raise HTTPException(status_code=400, detail="Selected preset sample not found")
        file_bytes = preset_path.read_bytes()
        original_filename = sample_preset
        ext = preset_path.suffix or ".jpeg"
        saved_filename = f"{uuid.uuid4().hex}{ext}"
        dest_path = settings.STORAGE_DIR / saved_filename
        dest_path.write_bytes(file_bytes)
    elif file:
        if file.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {file.content_type}. Allowed: {ALLOWED_MIME_TYPES}"
            )
        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Image size exceeds maximum limit of 15MB")
        original_filename = file.filename or "upload.jpeg"
        mime_type = file.content_type
        ext = Path(original_filename).suffix or ".jpeg"
        saved_filename = f"{uuid.uuid4().hex}{ext}"
        dest_path = settings.STORAGE_DIR / saved_filename
        dest_path.write_bytes(file_bytes)
    else:
        raise HTTPException(status_code=400, detail="An image file or preset sample is required for inspection")

    sha256 = hashlib.sha256(file_bytes).hexdigest()

    # Validated Domain & Out-of-Distribution (OOD) Gate: Reject non-steel / unsupported images
    is_supported, rej_code, rej_reason, domain_diag = domain_gate.validate_image(dest_path, ml_engine)
    if not is_supported:
        if dest_path.exists() and not sample_preset:
            try:
                dest_path.unlink()
            except Exception:
                pass
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "UNSUPPORTED_IMAGE_DOMAIN",
                "message": "Unsupported image. Please upload a suitable industrial steel surface / metal sheet image.",
                "rejection_code": rej_code,
                "reason": rej_reason,
                "diagnostics": domain_diag
            }
        )

    # Create Inspection record
    inspection = Inspection(
        product_id=product_id,
        batch_id=batch_id,
        item_identifier=item_identifier.strip().upper(),
        inspector_id=current_user.id,
        notes=notes,
        status="INFERENCE_COMPLETED",
        is_reinspection=is_reinspection,
        original_inspection_id=original_inspection_id
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    # Create ImageEvidence record
    image_evidence = ImageEvidence(
        inspection_id=inspection.id,
        file_path=saved_filename,
        original_filename=original_filename,
        file_size_bytes=len(file_bytes),
        mime_type=mime_type,
        sha256_hash=sha256
    )
    db.add(image_evidence)
    db.commit()
    db.refresh(image_evidence)

    # Run genuine ML inference pipeline
    ml_result = ml_engine.predict(settings.STORAGE_DIR / saved_filename)
    
    # Store heatmap path on image evidence if generated
    if ml_result.get("heatmap_path"):
        image_evidence.heatmap_path = ml_result["heatmap_path"]
        db.commit()

    # Append-only Inference Attempt record
    attempt = InferenceAttempt(
        inspection_id=inspection.id,
        image_id=image_evidence.id,
        model_name=ml_result["model_name"],
        model_version=ml_result["model_version"],
        inference_duration_ms=ml_result["inference_duration_ms"],
        raw_prediction=ml_result["prediction"],
        defect_type=ml_result.get("defect_type"),
        defect_display_name=ml_result.get("defect_display_name"),
        class_probabilities=json.dumps(ml_result.get("class_probabilities", {})),
        confidence_score=ml_result["confidence_score"],
        defect_probability=ml_result["defect_probability"],
        status=ml_result["status"],
        error_message=ml_result.get("error_message")
    )
    db.add(attempt)

    if is_reinspection and original_inspection_id:
        orig_insp = db.query(Inspection).filter(Inspection.id == original_inspection_id).first()
        suggestion = "INCONCLUSIVE"
        if orig_insp and orig_insp.inference_attempts:
            orig_att = orig_insp.inference_attempts[-1]
            orig_defect = orig_att.defect_type or (orig_insp.defect.defect_category if orig_insp.defect else None)
            new_pred = ml_result.get("prediction", "UNKNOWN")
            new_defect = ml_result.get("defect_type")

            if new_pred in ("OK", "NORMAL") or new_defect == "NORMAL":
                suggestion = "LIKELY_IMPROVED"
            elif new_defect and orig_defect and str(new_defect).lower() == str(orig_defect).lower():
                suggestion = "DEFECT_STILL_PRESENT"
            elif new_pred not in ("OK", "NORMAL"):
                suggestion = "NEW_OR_DIFFERENT_ANOMALY"
            else:
                suggestion = "INCONCLUSIVE"

        reinspection_record = Reinspection(
            original_inspection_id=original_inspection_id,
            follow_up_inspection_id=inspection.id,
            reason=notes or f"Follow-up for {item_identifier}",
            image_scope=image_scope,
            comparison_suggestion=suggestion,
            linked_action_id=linked_action_id,
            status="PENDING"
        )
        db.add(reinspection_record)

    # Update inspection status based on inference
    inspection.status = "UNDER_REVIEW" if ml_result["status"] == "SUCCESS" else "PENDING_INFERENCE"
    
    # Log audit event
    audit = AuditLog(
        entity_type="INSPECTION",
        entity_id=inspection.id,
        actor_id=current_user.id,
        action="CREATE_INSPECTION",
        previous_state=None,
        new_state=inspection.status,
        notes=f"Created inspection {inspection.item_identifier} with ML inference {ml_result['prediction']}"
    )
    db.add(audit)
    db.commit()
    db.refresh(inspection)

    return get_inspection_detail(inspection.id, db)

def _format_inspection_detail(insp: Inspection, original_inspection: Optional[InspectionOut] = None, follow_up_inspections: Optional[List[InspectionOut]] = None) -> InspectionDetailOut:
    base_out = _format_inspection_out(insp)
    
    images_out = [
        ImageEvidenceOut(
            id=img.id,
            inspection_id=img.inspection_id,
            file_path=img.file_path,
            original_filename=img.original_filename,
            file_size_bytes=img.file_size_bytes,
            mime_type=img.mime_type,
            sha256_hash=img.sha256_hash,
            heatmap_path=img.heatmap_path,
            created_at=img.created_at
        ) for img in insp.images
    ]

    attempts_out = [
        InferenceAttemptOut(
            id=att.id,
            inspection_id=att.inspection_id,
            image_id=att.image_id,
            model_name=att.model_name,
            model_version=att.model_version,
            inference_duration_ms=att.inference_duration_ms,
            raw_prediction=att.raw_prediction,
            defect_type=att.defect_type,
            defect_display_name=att.defect_display_name,
            class_probabilities=att.class_probabilities,
            confidence_score=att.confidence_score,
            defect_probability=att.defect_probability,
            status=att.status,
            error_message=att.error_message,
            created_at=att.created_at
        ) for att in insp.inference_attempts
    ]

    reviews_out = [
        HumanReviewOut(
            id=r.id,
            inspection_id=r.inspection_id,
            reviewer_id=r.reviewer_id,
            decision=r.decision,
            reason=r.reason,
            notes=r.notes,
            created_at=r.created_at,
            reviewer_name=r.reviewer.full_name if r.reviewer else None
        ) for r in insp.reviews
    ]

    from app.routers.defects import _format_defect_out
    defect_out = _format_defect_out(insp.defect) if insp.defect else None

    return InspectionDetailOut(
        **base_out.model_dump(),
        images=images_out,
        inference_attempts=attempts_out,
        reviews=reviews_out,
        defect=defect_out,
        original_inspection=original_inspection,
        follow_up_inspections=follow_up_inspections or []
    )

def get_inspection_detail(inspection_id: int, db: Session, current_user: Optional[User] = None) -> InspectionDetailOut:
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection record not found")
    
    # Object-level check: Operators may only view their own inspections
    if current_user:
        if not has_permission(current_user.role, PERM_INSPECTION_READ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required permission: inspection:read. Your role: {current_user.role}"
            )
        if not has_permission(current_user.role, PERM_INSPECTION_READ_ALL):
            if insp.inspector_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Operators may only access inspection records they created."
                )

    orig_out = None
    if insp.original_inspection_id:
        orig = db.query(Inspection).filter(Inspection.id == insp.original_inspection_id).first()
        if orig:
            orig_out = _format_inspection_out(orig)

    follow_ups = db.query(Inspection).filter(Inspection.original_inspection_id == insp.id).order_by(Inspection.created_at.desc()).all()
    follow_ups_out = [_format_inspection_out(f) for f in follow_ups]

    return _format_inspection_detail(insp, original_inspection=orig_out, follow_up_inspections=follow_ups_out)

@router.get("/{inspection_id}", response_model=InspectionDetailOut)
def read_inspection_detail(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_READ))
):
    return get_inspection_detail(inspection_id, db, current_user)

@router.post("/{inspection_id}/retry-inference", response_model=InferenceAttemptOut)
def retry_inference(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_RETRY))
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")
    if not insp.images:
        raise HTTPException(status_code=400, detail="No image evidence attached to this inspection")

    img = insp.images[0]
    img_path = settings.STORAGE_DIR / img.file_path
    ml_result = ml_engine.predict(img_path)

    if ml_result.get("heatmap_path"):
        img.heatmap_path = ml_result["heatmap_path"]
        db.commit()

    attempt = InferenceAttempt(
        inspection_id=insp.id,
        image_id=img.id,
        model_name=ml_result["model_name"],
        model_version=ml_result["model_version"],
        inference_duration_ms=ml_result["inference_duration_ms"],
        raw_prediction=ml_result["prediction"],
        defect_type=ml_result.get("defect_type"),
        defect_display_name=ml_result.get("defect_display_name"),
        class_probabilities=json.dumps(ml_result.get("class_probabilities", {})),
        confidence_score=ml_result["confidence_score"],
        defect_probability=ml_result["defect_probability"],
        status=ml_result["status"],
        error_message=ml_result.get("error_message")
    )
    db.add(attempt)
    insp.status = "UNDER_REVIEW" if ml_result["status"] == "SUCCESS" else "PENDING_INFERENCE"

    audit = AuditLog(
        entity_type="INSPECTION",
        entity_id=insp.id,
        actor_id=current_user.id,
        action="RETRY_INFERENCE",
        previous_state="RETRYING",
        new_state=insp.status,
        notes=f"Retried ML inference: {ml_result['prediction']} ({ml_result['status']})"
    )
    db.add(audit)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/{inspection_id}/reinspection-comparison")
def get_reinspection_comparison(
    inspection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_READ))
):
    """Retrieve Before vs After Reinspection comparison bundle with AI suggestion & human audit state."""
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Determine original vs follow-up
    if insp.is_reinspection and insp.original_inspection_id:
        orig_insp = db.query(Inspection).filter(Inspection.id == insp.original_inspection_id).first()
        post_insp = insp
    else:
        follow_up = db.query(Inspection).filter(Inspection.original_inspection_id == insp.id).order_by(Inspection.created_at.desc()).first()
        orig_insp = insp
        post_insp = follow_up

    # Object-level access isolation for operators
    if not has_permission(current_user.role, PERM_INSPECTION_READ_ALL):
        is_owner = (orig_insp and orig_insp.inspector_id == current_user.id) or (post_insp and post_insp.inspector_id == current_user.id)
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Operators may only view reinspection comparisons for their own authored inspections."
            )

    orig_detail = get_inspection_detail(orig_insp.id, db, current_user) if orig_insp else None
    post_detail = get_inspection_detail(post_insp.id, db, current_user) if post_insp else None

    # Get linked defect and CAPA
    linked_defect = None
    linked_capa = None
    if orig_insp and orig_insp.defect:
        from app.routers.defects import _format_defect_out
        linked_defect = _format_defect_out(orig_insp.defect)
        if orig_insp.defect.corrective_actions:
            from app.routers.actions import _format_action_out
            latest_action = sorted(orig_insp.defect.corrective_actions, key=lambda a: a.created_at, reverse=True)[0]
            linked_capa = _format_action_out(latest_action)

    # Reinspection entity
    reinsp_record = None
    if orig_insp and post_insp:
        r_rec = db.query(Reinspection).filter(
            Reinspection.original_inspection_id == orig_insp.id,
            Reinspection.follow_up_inspection_id == post_insp.id
        ).first()
        if r_rec:
            reinsp_record = {
                "id": r_rec.id,
                "original_inspection_id": r_rec.original_inspection_id,
                "follow_up_inspection_id": r_rec.follow_up_inspection_id,
                "reason": r_rec.reason,
                "image_scope": getattr(r_rec, "image_scope", "ITEM"),
                "comparison_suggestion": getattr(r_rec, "comparison_suggestion", None),
                "comparison_decision": getattr(r_rec, "comparison_decision", None),
                "reviewer_id": getattr(r_rec, "reviewer_id", None),
                "reviewer_notes": getattr(r_rec, "reviewer_notes", None),
                "reviewed_at": r_rec.reviewed_at.isoformat() if getattr(r_rec, "reviewed_at", None) else None,
                "linked_action_id": getattr(r_rec, "linked_action_id", None),
                "status": r_rec.status,
                "created_at": r_rec.created_at.isoformat() if r_rec.created_at else None
            }

    ref_filename = "eval_sample_ok_01.jpeg"
    ref_path = settings.EVAL_SAMPLES_DIR / ref_filename
    ref_available = ref_path.exists()

    reference_info = {
        "filename": ref_filename if ref_available else None,
        "label": "Golden Standard / Known Defect-Free Reference",
        "description": "Authentic defect-free industrial casting reference surface",
        "url": f"/api/v1/inspections/eval-samples/{ref_filename}" if ref_available else None
    }

    # Derive automated assessment outcome
    assessment_outcome = "INCONCLUSIVE"
    recommendation = "Inspection requires human visual review."

    if reinsp_record and reinsp_record.get("comparison_suggestion"):
        assessment_outcome = reinsp_record["comparison_suggestion"]
        if assessment_outcome == "LIKELY_IMPROVED":
            recommendation = "AI analysis indicates surface defects have cleared. Review Grad-CAM focus and confirm correction."
        elif assessment_outcome == "DEFECT_STILL_PRESENT":
            recommendation = "Target defect signature remains present in post-repair scan. Escalation or rework advised."
        elif assessment_outcome == "NEW_OR_DIFFERENT_ANOMALY":
            recommendation = "A different surface anomaly pattern was detected on the post-repair surface. Engineering inspection recommended."
    elif orig_insp and post_insp:
        orig_pred = orig_detail.latest_prediction if orig_detail else None
        post_pred = post_detail.latest_prediction if post_detail else None
        orig_defect_type = orig_detail.latest_defect_type if orig_detail else None
        post_defect_type = post_detail.latest_defect_type if post_detail else None

        if post_pred in ("OK", "NORMAL") or post_defect_type == "NORMAL":
            assessment_outcome = "LIKELY_IMPROVED"
            recommendation = "AI analysis indicates surface defects have cleared. Review Grad-CAM focus and confirm correction."
        elif post_pred not in ("OK", "NORMAL"):
            if post_defect_type and orig_defect_type and str(post_defect_type).lower() == str(orig_defect_type).lower():
                assessment_outcome = "DEFECT_STILL_PRESENT"
                recommendation = f"Identical defect '{orig_defect_type}' signature remains visible on post-repair surface."
            else:
                assessment_outcome = "NEW_OR_DIFFERENT_ANOMALY"
                recommendation = f"A different surface anomaly ({post_defect_type or 'UNSPECIFIED'}) was flagged on the post-repair surface."

    human_decision = reinsp_record.get("comparison_decision") if reinsp_record else None
    if not human_decision:
        human_decision = "PENDING_REVIEW"

    return {
        "original_inspection": orig_detail,
        "reinspection": post_detail,
        "post_repair_inspection": post_detail,
        "reference_image": reference_info,
        "reinspection_record": reinsp_record,
        "linked_defect": linked_defect,
        "linked_capa": linked_capa,
        "assessment_outcome": assessment_outcome,
        "comparison_suggestion": assessment_outcome,
        "comparison_decision": human_decision,
        "recommendation": recommendation,
        "requires_human_approval": True
    }

@router.post("/{inspection_id}/comparison-review")
def submit_comparison_review(
    inspection_id: int,
    review_in: ComparisonReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permissions(PERM_INSPECTION_REVIEW))
):
    insp = db.query(Inspection).filter(Inspection.id == inspection_id).first()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Determine original and follow-up
    if insp.is_reinspection and insp.original_inspection_id:
        orig_insp = db.query(Inspection).filter(Inspection.id == insp.original_inspection_id).first()
        post_insp = insp
    else:
        follow_up = db.query(Inspection).filter(Inspection.original_inspection_id == insp.id).order_by(Inspection.created_at.desc()).first()
        orig_insp = insp
        post_insp = follow_up

    # Separation of duties: submitter cannot approve comparison
    involved_inspector_ids = {i.inspector_id for i in [insp, orig_insp, post_insp] if i and i.inspector_id}
    if current_user.id in involved_inspector_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Separation of duties violation: An inspector cannot review or approve their own submitted inspection."
        )

    valid_decisions = ["CONFIRM_CORRECTION", "DEFECT_STILL_PRESENT", "REQUEST_ANOTHER_INSPECTION", "INCONCLUSIVE"]
    if review_in.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid comparison decision. Allowed: {valid_decisions}")

    if not review_in.notes or not review_in.notes.strip():
        raise HTTPException(status_code=400, detail="Reviewer notes/explanation are required.")

    if not orig_insp or not post_insp:
        raise HTTPException(status_code=400, detail="Cannot review comparison: linked pair of original and follow-up inspections not found.")

    # Find or create Reinspection record
    r_rec = db.query(Reinspection).filter(
        Reinspection.original_inspection_id == orig_insp.id,
        Reinspection.follow_up_inspection_id == post_insp.id
    ).first()
    if not r_rec:
        r_rec = Reinspection(
            original_inspection_id=orig_insp.id,
            follow_up_inspection_id=post_insp.id,
            reason=post_insp.notes or f"Follow-up for {post_insp.item_identifier}",
            status="PENDING"
        )
        db.add(r_rec)

    r_rec.comparison_decision = review_in.decision
    r_rec.reviewer_id = current_user.id
    r_rec.reviewer_notes = review_in.notes
    r_rec.reviewed_at = datetime.utcnow()
    r_rec.status = "COMPLETED"

    # Handle defect status and CAPA resolution
    orig_defect = db.query(ConfirmedDefect).filter(ConfirmedDefect.inspection_id == orig_insp.id).first()
    
    if review_in.decision == "CONFIRM_CORRECTION":
        post_insp.status = "PASSED"
        orig_insp.status = "REINSPECTED"
        if orig_defect:
            orig_defect.review_status = "RESOLVED"
            orig_defect.resolved_at = datetime.utcnow()

        # Handle CAPA closure if requested
        if review_in.close_capa:
            from app.rbac import has_permission, PERM_CAPA_VERIFY
            if not has_permission(current_user.role, PERM_CAPA_VERIFY):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Closing and verifying CAPA requires Quality Manager authority."
                )
            if orig_defect and orig_defect.corrective_actions:
                for act in orig_defect.corrective_actions:
                    act.status = "VERIFIED"
                    act.completed_at = datetime.utcnow()
                    act.notes = (act.notes or "") + f" | Verified & closed by QM {current_user.username} via Reinspection #{post_insp.id}."
                    db.add(AuditLog(
                        entity_type="ACTION",
                        entity_id=act.id,
                        actor_id=current_user.id,
                        action="CAPA_VERIFIED_VIA_REINSPECTION",
                        previous_state="IN_PROGRESS",
                        new_state="VERIFIED",
                        notes=f"CAPA verified closed via passing Before/After Comparison #{post_insp.id}."
                    ))

    elif review_in.decision == "DEFECT_STILL_PRESENT":
        post_insp.status = "CONFIRMED_DEFECT"
        if orig_defect:
            orig_defect.review_status = "REOPENED"
    elif review_in.decision == "REQUEST_ANOTHER_INSPECTION":
        post_insp.status = "UNDER_REVIEW"
        if orig_defect:
            orig_defect.review_status = "REINSPECTION_PENDING"
    else:  # INCONCLUSIVE
        post_insp.status = "UNDER_REVIEW"

    # Add audit log
    audit = AuditLog(
        entity_type="REINSPECTION",
        entity_id=r_rec.id,
        actor_id=current_user.id,
        action="REINSPECTION_COMPARISON_REVIEW",
        previous_state=getattr(r_rec, "comparison_suggestion", "PENDING_REVIEW") or "PENDING_REVIEW",
        new_state=review_in.decision,
        notes=f"Human Review: {review_in.decision}. Notes: {review_in.notes}"
    )
    db.add(audit)
    db.commit()

    return get_reinspection_comparison(post_insp.id, db, current_user)

@router.get("/images/{filename}")
def serve_image(
    filename: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    """Serve inspection image or Grad-CAM heatmap with record-level authorization."""
    # Public evaluation samples check
    eval_sample_path = settings.EVAL_SAMPLES_DIR / filename
    if eval_sample_path.exists() and eval_sample_path.is_file():
        return FileResponse(str(eval_sample_path))

    # Authenticate proprietary inspection image request before revealing existence
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to access proprietary inspection images.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    file_path = settings.STORAGE_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found")

    try:
        payload = jwt.decode(raw_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account inactive or not found")

    # Record-level authorization check:
    if not has_permission(user.role, PERM_INSPECTION_READ_ALL):
        img_ev = db.query(ImageEvidence).filter(
            (ImageEvidence.file_path == filename) | (ImageEvidence.heatmap_path == filename)
        ).first()
        if img_ev and img_ev.inspection:
            if img_ev.inspection.inspector_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Operators may only access images from their own authored inspections."
                )

    return FileResponse(str(file_path))
