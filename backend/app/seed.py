import shutil
from datetime import datetime, timedelta
from pathlib import Path
from sqlalchemy.orm import Session

from app.models import (
    User, Product, Batch, Inspection, ImageEvidence,
    InferenceAttempt, HumanReview, ConfirmedDefect, CorrectiveAction, BatchDecision, AuditLog
)
from app.auth import get_password_hash
from app.config import settings

def seed_database(db: Session):
    # Check if already seeded
    if db.query(User).count() > 0:
        return

    print("[Seed] Initializing seed data...")

    # 1. Users
    users = [
        User(
            username="admin",
            email="admin@forgesight.ai",
            full_name="Quality Director (Admin)",
            hashed_password=get_password_hash("admin123"),
            role="admin",
            is_active=True
        ),
        User(
            username="qm_elena",
            email="elena.vance@forgesight.ai",
            full_name="Elena Vance (Quality Manager)",
            hashed_password=get_password_hash("qm123"),
            role="quality_manager",
            is_active=True
        ),
        User(
            username="inspector_marcus",
            email="marcus.lee@forgesight.ai",
            full_name="Marcus Lee (Lead Inspector)",
            hashed_password=get_password_hash("insp123"),
            role="inspector",
            is_active=True
        ),
        User(
            username="sup_davis",
            email="john.davis@forgesight.ai",
            full_name="John Davis (Production Supervisor)",
            hashed_password=get_password_hash("sup123"),
            role="supervisor",
            is_active=True
        )
    ]
    db.add_all(users)
    db.commit()
    for u in users:
        db.refresh(u)

    admin, qm, inspector, supervisor = users[0], users[1], users[2], users[3]

    # 2. Products
    p1 = Product(
        code="CAST-PUMP-01",
        name="Submersible Pump Impeller Casting",
        category="Ductile Iron Castings",
        description="High-flow centrifugal impeller for industrial submersible slurry pumps."
    )
    p2 = Product(
        code="CAST-BRK-02",
        name="Automotive Brake Rotor Disc",
        category="Grey Iron Castings",
        description="Ventilated disc brake casting for heavy commercial vehicles."
    )
    p3 = Product(
        code="CAST-VALV-03",
        name="High-Pressure Valve Body",
        category="Steel Castings",
        description="Pressure-containment valve body rated for 3000 PSI hydraulic systems."
    )
    db.add_all([p1, p2, p3])
    db.commit()
    for p in [p1, p2, p3]:
        db.refresh(p)

    # 3. Batches
    now = datetime.utcnow()
    b101 = Batch(
        product_id=p1.id,
        batch_number="B-2026-101",
        quantity=250,
        production_date=now - timedelta(days=6),
        status="RELEASED",
        decision_notes="All standard quality benchmarks passed. 100% inspection verified.",
        decided_by_user_id=qm.id,
        decided_at=now - timedelta(days=5)
    )
    b104 = Batch(
        product_id=p1.id,
        batch_number="B-2026-104",
        quantity=180,
        production_date=now - timedelta(days=2),
        status="ON_HOLD",
        decision_notes="Quarantined due to repeated blowhole defects on casting perimeter. Awaiting tooling re-calibration.",
        decided_by_user_id=qm.id,
        decided_at=now - timedelta(days=1)
    )
    b108 = Batch(
        product_id=p2.id,
        batch_number="B-2026-108",
        quantity=300,
        production_date=now - timedelta(days=1),
        status="IN_PROGRESS"
    )
    db.add_all([b101, b104, b108])
    db.commit()
    for b in [b101, b104, b108]:
        db.refresh(b)

    # Add historical batch decision
    d1 = BatchDecision(
        batch_id=b104.id,
        decided_by_user_id=qm.id,
        previous_status="IN_PROGRESS",
        new_status="ON_HOLD",
        reason="Defect threshold exceeded (2 confirmed blowhole defects). Placed on quality quarantine."
    )
    d2 = BatchDecision(
        batch_id=b101.id,
        decided_by_user_id=qm.id,
        previous_status="IN_PROGRESS",
        new_status="RELEASED",
        reason="Certified conforming to ASTM A536 standards."
    )
    db.add_all([d1, d2])

    # 4. Inspections & Real Evidence Files from eval_samples
    samples_dir = settings.EVAL_SAMPLES_DIR
    uploads_dir = settings.STORAGE_DIR

    # Seed Inspection 1: Confirmed Defective Item on Batch B-104
    sample_def = samples_dir / "eval_sample_defective_02.jpeg"
    file1_name = "seed_item_0881_def.jpeg"
    if sample_def.exists():
        shutil.copy(sample_def, uploads_dir / file1_name)
        # Copy heatmap if exists
        hm1_name = "cam_seed_item_0881_def.jpg"
        hm_src = samples_dir / "cam_eval_sample_defective_02.jpg"
        if hm_src.exists():
            shutil.copy(hm_src, uploads_dir / hm1_name)
    else:
        file1_name = "sample.jpeg"
        hm1_name = None

    insp1 = Inspection(
        product_id=p1.id,
        batch_id=b104.id,
        item_identifier="ITEM-0881",
        inspector_id=inspector.id,
        notes="Visual inspection of flange surface. Deep porosity observed near gate.",
        status="CONFIRMED_DEFECT",
        created_at=now - timedelta(days=2, hours=4)
    )
    db.add(insp1)
    db.commit()
    db.refresh(insp1)

    img1 = ImageEvidence(
        inspection_id=insp1.id,
        file_path=file1_name,
        original_filename="casting_flange_0881.jpeg",
        file_size_bytes=45230,
        mime_type="image/jpeg",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        heatmap_path=hm1_name if (uploads_dir / (hm1_name or "")).exists() else None
    )
    db.add(img1)
    db.commit()
    db.refresh(img1)

    inf1 = InferenceAttempt(
        inspection_id=insp1.id,
        image_id=img1.id,
        model_name="MobileNetV3-Casting-Inspector",
        model_version="v1.0.0-industrial",
        inference_duration_ms=48.2,
        raw_prediction="DEFECTIVE",
        confidence_score=0.9538,
        defect_probability=0.9538,
        status="SUCCESS",
        created_at=now - timedelta(days=2, hours=3, minutes=58)
    )
    db.add(inf1)

    rev1 = HumanReview(
        inspection_id=insp1.id,
        reviewer_id=qm.id,
        decision="CONFIRMED_DEFECT",
        reason="Blowhole defect confirmed",
        notes="Surface blowhole exceeds 2.5mm tolerance spec. Quarantined part for remediation.",
        created_at=now - timedelta(days=2, hours=2)
    )
    db.add(rev1)

    defect1 = ConfirmedDefect(
        defect_code="DEF-0001",
        inspection_id=insp1.id,
        batch_id=b104.id,
        defect_category="BLOWHOLE",
        severity="CRITICAL",
        description="Gas porosity blowhole on mounting flange. Exceeds ASTM A536 Class 2 limit.",
        review_status="ACTION_ASSIGNED",
        created_at=now - timedelta(days=2, hours=2)
    )
    db.add(defect1)
    db.commit()
    db.refresh(defect1)

    # Corrective action that is OVERDUE for demonstration
    act1 = CorrectiveAction(
        action_code="CAPA-0001",
        defect_id=defect1.id,
        title="Check sand core venting and mould moisture levels",
        description="Inspect degassing vents on line 3 mould pattern. Verify moisture content of green sand is below 3.2%.",
        assigned_to_user_id=supervisor.id,
        target_date=now - timedelta(days=1),  # Past due!
        status="PENDING",
        notes="Tooling technician dispatched. Sand moisture logs pending review.",
        created_at=now - timedelta(days=2, hours=1)
    )
    db.add(act1)

    # Seed Inspection 2: Normal Passed Inspection on Batch B-101
    sample_ok = samples_dir / "eval_sample_ok_01.jpeg"
    file2_name = "seed_item_0720_ok.jpeg"
    if sample_ok.exists():
        shutil.copy(sample_ok, uploads_dir / file2_name)
    else:
        file2_name = "sample.jpeg"

    insp2 = Inspection(
        product_id=p1.id,
        batch_id=b101.id,
        item_identifier="ITEM-0720",
        inspector_id=inspector.id,
        notes="Routine post-shakeout inspection. Surface clean.",
        status="PASSED",
        created_at=now - timedelta(days=5)
    )
    db.add(insp2)
    db.commit()
    db.refresh(insp2)

    img2 = ImageEvidence(
        inspection_id=insp2.id,
        file_path=file2_name,
        original_filename="impeller_casting_0720.jpeg",
        file_size_bytes=42100,
        mime_type="image/jpeg",
        sha256_hash="d41d8cd98f00b204e9800998ecf8427e1b7852b855e3b0c44298fc1c149afbf4"
    )
    db.add(img2)
    db.commit()
    db.refresh(img2)

    inf2 = InferenceAttempt(
        inspection_id=insp2.id,
        image_id=img2.id,
        model_name="MobileNetV3-Casting-Inspector",
        model_version="v1.0.0-industrial",
        inference_duration_ms=44.1,
        raw_prediction="OK",
        confidence_score=1.0,
        defect_probability=0.0,
        status="SUCCESS",
        created_at=now - timedelta(days=5)
    )
    db.add(inf2)

    rev2 = HumanReview(
        inspection_id=insp2.id,
        reviewer_id=qm.id,
        decision="NO_DEFECT_CONFIRMED",
        reason="Clean casting surface",
        notes="No porosity or inclusions detected. Part approved.",
        created_at=now - timedelta(days=5)
    )
    db.add(rev2)

    # Seed Inspection 3: Pending Review Item with AI defect flag on B-108
    sample_def3 = samples_dir / "eval_sample_defective_03.jpeg"
    file3_name = "seed_item_0915_pending.jpeg"
    if sample_def3.exists():
        shutil.copy(sample_def3, uploads_dir / file3_name)
    else:
        file3_name = "sample.jpeg"

    insp3 = Inspection(
        product_id=p2.id,
        batch_id=b108.id,
        item_identifier="ITEM-0915",
        inspector_id=inspector.id,
        notes="Brake disc friction ring visual test. Minor pit near perimeter.",
        status="UNDER_REVIEW",
        created_at=now - timedelta(hours=3)
    )
    db.add(insp3)
    db.commit()
    db.refresh(insp3)

    img3 = ImageEvidence(
        inspection_id=insp3.id,
        file_path=file3_name,
        original_filename="rotor_disc_0915.jpeg",
        file_size_bytes=46700,
        mime_type="image/jpeg",
        sha256_hash="ca495991b7852b855e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934"
    )
    db.add(img3)
    db.commit()
    db.refresh(img3)

    inf3 = InferenceAttempt(
        inspection_id=insp3.id,
        image_id=img3.id,
        model_name="MobileNetV3-Casting-Inspector",
        model_version="v1.0.0-industrial",
        inference_duration_ms=46.5,
        raw_prediction="DEFECTIVE",
        confidence_score=1.0,
        defect_probability=1.0,
        status="SUCCESS",
        created_at=now - timedelta(hours=2, minutes=58)
    )
    db.add(inf3)

    db.commit()
    print("[Seed] Seed data successfully populated with realistic records!")
