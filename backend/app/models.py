import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
)
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="inspector", nullable=False)  # inspector, quality_manager, supervisor, admin
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    inspections = relationship("Inspection", foreign_keys="Inspection.inspector_id", back_populates="inspector")
    reviews = relationship("HumanReview", back_populates="reviewer")
    batch_decisions = relationship("BatchDecision", back_populates="decided_by")
    assigned_actions = relationship("CorrectiveAction", back_populates="assigned_to")

    @property
    def permissions(self):
        from app.rbac import get_role_permissions
        return get_role_permissions(self.role)

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=False)
    category = Column(String(80), nullable=False, default="Hot-Rolled Steel Products")
    description = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    batches = relationship("Batch", back_populates="product", cascade="all, delete-orphan")
    inspections = relationship("Inspection", back_populates="product")

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_number = Column(String(60), unique=True, index=True, nullable=False)
    quantity = Column(Integer, default=100, nullable=False)
    production_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    status = Column(String(40), default="IN_PROGRESS", nullable=False)  # IN_PROGRESS, ON_HOLD, RELEASED, REJECTED
    decision_notes = Column(Text, nullable=True)
    decided_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="batches")
    inspections = relationship("Inspection", back_populates="batch", cascade="all, delete-orphan")
    decisions = relationship("BatchDecision", back_populates="batch", order_by="desc(BatchDecision.created_at)")
    defects = relationship("ConfirmedDefect", back_populates="batch")

class BatchDecision(Base):
    __tablename__ = "batch_decisions"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    decided_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    previous_status = Column(String(40), nullable=False)
    new_status = Column(String(40), nullable=False)
    reason = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    batch = relationship("Batch", back_populates="decisions")
    decided_by = relationship("User", back_populates="batch_decisions")

class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    item_identifier = Column(String(80), nullable=False, index=True)
    inspector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default="PENDING_INFERENCE", nullable=False)  
    # PENDING_INFERENCE, INFERENCE_COMPLETED, UNDER_REVIEW, CONFIRMED_DEFECT, PASSED, REINSPECTED
    is_reinspection = Column(Boolean, default=False, nullable=False)
    original_inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    product = relationship("Product", back_populates="inspections")
    batch = relationship("Batch", back_populates="inspections")
    inspector = relationship("User", foreign_keys=[inspector_id], back_populates="inspections")
    images = relationship("ImageEvidence", back_populates="inspection", cascade="all, delete-orphan")
    inference_attempts = relationship("InferenceAttempt", back_populates="inspection", cascade="all, delete-orphan", order_by="desc(InferenceAttempt.created_at)")
    reviews = relationship("HumanReview", back_populates="inspection", cascade="all, delete-orphan", order_by="desc(HumanReview.created_at)")
    defect = relationship("ConfirmedDefect", back_populates="inspection", uselist=False)

class ImageEvidence(Base):
    __tablename__ = "image_evidences"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    file_path = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(80), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    heatmap_path = Column(String(255), nullable=True)
    image_scope = Column(String(50), default="ITEM", nullable=True)  # ITEM, SURFACE, BATCH_SAMPLE
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    inspection = relationship("Inspection", back_populates="images")
    inference_attempts = relationship("InferenceAttempt", back_populates="image")

class InferenceAttempt(Base):
    __tablename__ = "inference_attempts"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    image_id = Column(Integer, ForeignKey("image_evidences.id"), nullable=False)
    model_name = Column(String(80), nullable=False)
    model_version = Column(String(40), nullable=False)
    inference_duration_ms = Column(Float, nullable=False)
    raw_prediction = Column(String(40), nullable=False)  # DEFECTIVE or OK
    defect_type = Column(String(50), nullable=True)
    defect_display_name = Column(String(100), nullable=True)
    class_probabilities = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=False)     # 0.0 to 1.0 (calibrated sigmoid probability)
    defect_probability = Column(Float, nullable=False)   # 0.0 to 1.0
    status = Column(String(30), default="SUCCESS", nullable=False)  # SUCCESS, FAILED
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    inspection = relationship("Inspection", back_populates="inference_attempts")
    image = relationship("ImageEvidence", back_populates="inference_attempts")

class HumanReview(Base):
    __tablename__ = "human_reviews"

    id = Column(Integer, primary_key=True, index=True)
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    decision = Column(String(50), nullable=False)  # CONFIRMED_DEFECT, NO_DEFECT_CONFIRMED, NEEDS_MORE_EVIDENCE
    reason = Column(String(120), nullable=True)     # False Alarm, Defect Confirmed, Unclear Evidence, etc.
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    inspection = relationship("Inspection", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")

class ConfirmedDefect(Base):
    __tablename__ = "confirmed_defects"

    id = Column(Integer, primary_key=True, index=True)
    defect_code = Column(String(40), unique=True, index=True, nullable=False)  # DEF-001, etc.
    inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    defect_category = Column(String(80), nullable=False)  # BLOWHOLE, PINHOLE, SHRINKAGE, CRACK, MOULD_DROP, SURFACE_ROUGHNESS
    severity = Column(String(30), nullable=False, default="MAJOR")  # CRITICAL, MAJOR, MINOR
    description = Column(Text, nullable=False)
    review_status = Column(String(40), default="OPEN", nullable=False)  
    # OPEN, ACTION_ASSIGNED, IN_REMEDIATION, REINSPECTION_PENDING, RESOLVED, REOPENED
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    inspection = relationship("Inspection", back_populates="defect")
    batch = relationship("Batch", back_populates="defects")
    corrective_actions = relationship("CorrectiveAction", back_populates="defect", cascade="all, delete-orphan")

class CorrectiveAction(Base):
    __tablename__ = "corrective_actions"

    id = Column(Integer, primary_key=True, index=True)
    action_code = Column(String(40), unique=True, index=True, nullable=False)  # CAPA-001
    defect_id = Column(Integer, ForeignKey("confirmed_defects.id"), nullable=False)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=False)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_date = Column(DateTime, nullable=False)
    status = Column(String(40), default="PENDING", nullable=False)  # PENDING, IN_PROGRESS, COMPLETED, VERIFIED
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    defect = relationship("ConfirmedDefect", back_populates="corrective_actions")
    assigned_to = relationship("User", back_populates="assigned_actions")

class Reinspection(Base):
    __tablename__ = "reinspections"

    id = Column(Integer, primary_key=True, index=True)
    original_inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=False)
    follow_up_inspection_id = Column(Integer, ForeignKey("inspections.id"), nullable=True)
    reason = Column(Text, nullable=False)
    image_scope = Column(String(50), default="ITEM", nullable=False)  # ITEM, SURFACE, BATCH_SAMPLE
    comparison_suggestion = Column(String(50), default="PENDING_REVIEW", nullable=False)
    # LIKELY_IMPROVED, DEFECT_STILL_PRESENT, NEW_OR_DIFFERENT_ANOMALY, INCONCLUSIVE, PENDING_REVIEW
    comparison_decision = Column(String(50), nullable=True)
    # CONFIRM_CORRECTION, DEFECT_STILL_PRESENT, REQUEST_ANOTHER_INSPECTION, INCONCLUSIVE
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    linked_action_id = Column(Integer, ForeignKey("corrective_actions.id"), nullable=True)
    status = Column(String(30), default="PENDING", nullable=False)  # PENDING, COMPLETED
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    original_inspection = relationship("Inspection", foreign_keys=[original_inspection_id])
    follow_up_inspection = relationship("Inspection", foreign_keys=[follow_up_inspection_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    linked_action = relationship("CorrectiveAction", foreign_keys=[linked_action_id])

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String(60), nullable=False)  # BATCH, INSPECTION, REVIEW, DEFECT, ACTION, REINSPECTION
    entity_id = Column(Integer, nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(60), nullable=False)       # STATUS_CHANGE, OVERRIDE, HOLD, RELEASE, REOPEN, CLOSE, REINSPECTION_COMPARISON
    previous_state = Column(String(100), nullable=True)
    new_state = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
