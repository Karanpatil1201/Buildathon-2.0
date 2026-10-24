import hashlib
import json
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Inspection, ImageEvidence, InferenceAttempt, Product, Batch, User, AuditLog
from app.schemas import InspectionCreate, InspectionOut, InspectionDetailOut, InferenceAttemptOut, ImageEvidenceOut, HumanReviewOut
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

@router.get("/images/{filename}")
def serve_image(filename: str):
    file_path = settings.STORAGE_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")
    return FileResponse(str(file_path))
