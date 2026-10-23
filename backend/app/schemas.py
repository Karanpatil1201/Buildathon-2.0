from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# ----------------- Auth & Users -----------------
class UserLogin(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: str = "inspector"  # inspector, quality_manager, supervisor, admin

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    permissions: List[str] = Field(default_factory=list)
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    role: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None

class AuditLogOut(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    actor_id: Optional[int] = None
    action: str
    previous_state: Optional[str] = None
    new_state: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

# ----------------- Products -----------------
class ProductCreate(BaseModel):
    code: str
    name: str
    category: str = "Metal Castings"
    description: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    is_archived: Optional[bool] = None

class ProductOut(BaseModel):
    id: int
    code: str
    name: str
    category: str
    description: Optional[str]
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ----------------- Batches -----------------
class BatchCreate(BaseModel):
    product_id: int
    batch_number: str
    quantity: int = 100
    production_date: Optional[datetime] = None

class BatchUpdate(BaseModel):
    quantity: Optional[int] = None
    production_date: Optional[datetime] = None

class BatchDecisionCreate(BaseModel):
    new_status: str  # ON_HOLD, RELEASED, REJECTED, IN_PROGRESS
    reason: str

class BatchDecisionOut(BaseModel):
    id: int
    batch_id: int
    decided_by_user_id: int
    previous_status: str
    new_status: str
    reason: str
    created_at: datetime
    decided_by_name: Optional[str] = None

    class Config:
        from_attributes = True

class BatchOut(BaseModel):
    id: int
    product_id: int
    batch_number: str
    quantity: int
    production_date: datetime
    status: str
    decision_notes: Optional[str]
    decided_by_user_id: Optional[int]
    decided_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    total_inspections: int = 0
    defect_count: int = 0

    class Config:
        from_attributes = True

# ----------------- Image Evidence & ML -----------------
class ImageEvidenceOut(BaseModel):
    id: int
    inspection_id: int
    file_path: str
    original_filename: str
    file_size_bytes: int
    mime_type: str
    sha256_hash: str
    heatmap_path: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class InferenceAttemptOut(BaseModel):
    id: int
    inspection_id: int
    image_id: int
    model_name: str
    model_version: str
    inference_duration_ms: float
    raw_prediction: str
    confidence_score: float
    defect_probability: float
    status: str
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# ----------------- Human Reviews -----------------
class HumanReviewCreate(BaseModel):
    decision: str  # CONFIRMED_DEFECT, NO_DEFECT_CONFIRMED, NEEDS_MORE_EVIDENCE
    reason: Optional[str] = None
    notes: Optional[str] = None
    # For confirmed defect creation in one step
    defect_category: Optional[str] = None  # BLOWHOLE, PINHOLE, SHRINKAGE, CRACK, MOULD_DROP, SURFACE_ROUGHNESS
    severity: Optional[str] = "MAJOR"      # CRITICAL, MAJOR, MINOR

class HumanReviewOut(BaseModel):
    id: int
    inspection_id: int
    reviewer_id: int
    decision: str
    reason: Optional[str]
    notes: Optional[str]
    created_at: datetime
    reviewer_name: Optional[str] = None

    class Config:
        from_attributes = True

# ----------------- Corrective Actions -----------------
class CorrectiveActionCreate(BaseModel):
    defect_id: int
    title: str
    description: str
    assigned_to_user_id: int
    target_date: datetime

class CorrectiveActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to_user_id: Optional[int] = None
    target_date: Optional[datetime] = None
    status: Optional[str] = None  # PENDING, IN_PROGRESS, COMPLETED, VERIFIED
    notes: Optional[str] = None

class CorrectiveActionOut(BaseModel):
    id: int
    action_code: str
    defect_id: int
    title: str
    description: str
    assigned_to_user_id: int
    target_date: datetime
    status: str
    notes: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    assigned_to_name: Optional[str] = None
    defect_code: Optional[str] = None
    is_overdue: bool = False

    class Config:
        from_attributes = True

# ----------------- Confirmed Defects -----------------
class ConfirmedDefectCreate(BaseModel):
    inspection_id: int
    batch_id: int
    defect_category: str
    severity: str = "MAJOR"
    description: str

class ConfirmedDefectUpdate(BaseModel):
    review_status: Optional[str] = None  # OPEN, ACTION_ASSIGNED, IN_REMEDIATION, REINSPECTION_PENDING, RESOLVED, REOPENED
    defect_category: Optional[str] = None
    severity: Optional[str] = None
    description: Optional[str] = None

class ConfirmedDefectOut(BaseModel):
    id: int
    defect_code: str
    inspection_id: int
    batch_id: int
    defect_category: str
    severity: str
    description: str
    review_status: str
    created_at: datetime
    resolved_at: Optional[datetime]
    batch_number: Optional[str] = None
    product_name: Optional[str] = None
    corrective_actions: List[CorrectiveActionOut] = []

    class Config:
        from_attributes = True

# ----------------- Inspections -----------------
class InspectionCreate(BaseModel):
    product_id: int
    batch_id: int
    item_identifier: str
    notes: Optional[str] = None
    original_inspection_id: Optional[int] = None

class InspectionOut(BaseModel):
    id: int
    product_id: int
    batch_id: int
    item_identifier: str
    inspector_id: int
    notes: Optional[str]
    status: str
    is_reinspection: bool
    original_inspection_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    batch_number: Optional[str] = None
    inspector_name: Optional[str] = None
    latest_prediction: Optional[str] = None
    latest_confidence: Optional[float] = None
    latest_image_url: Optional[str] = None
    latest_heatmap_url: Optional[str] = None

    class Config:
        from_attributes = True

class InspectionDetailOut(InspectionOut):
    images: List[ImageEvidenceOut] = []
    inference_attempts: List[InferenceAttemptOut] = []
    reviews: List[HumanReviewOut] = []
    defect: Optional[ConfirmedDefectOut] = None

# ----------------- Dashboard & Metrics -----------------
class TrendPoint(BaseModel):
    date: str
    inspected_count: int
    defect_count: int
    defect_rate: float

class DashboardMetricsOut(BaseModel):
    total_inspected_items: int
    pending_reviews: int
    confirmed_defects: int
    open_corrective_actions: int
    overdue_actions: int
    overall_defect_rate: float
    batches_on_hold: int
    recent_inspections: List[InspectionOut]
    trend_history: List[TrendPoint]

# ----------------- Quality Copilot -----------------
class CopilotQuery(BaseModel):
    query: str
    batch_number: Optional[str] = None

class CopilotCitation(BaseModel):
    record_type: str  # BATCH, INSPECTION, DEFECT, ACTION
    record_id: str
    label: str

class CopilotResponse(BaseModel):
    query: str
    answer: str
    citations: List[CopilotCitation]
    grounded_stats: Dict[str, Any]
    provider: str
    authorized: bool = True

# ----------------- Innovation: Review Prioritization -----------------
class PrioritizationFactor(BaseModel):
    factor_name: str
    score_contribution: float
    description: str

class PrioritizedInspectionOut(BaseModel):
    inspection: InspectionOut
    priority_score: float  # 0 to 100
    priority_tier: str     # CRITICAL, HIGH, MEDIUM, LOW
    factors: List[PrioritizationFactor]

class PrioritizationEvaluationOut(BaseModel):
    method: str
    time_to_first_critical_defect_min: float
    high_risk_coverage_rate: float
    review_efficiency_gain_pct: float
    description: str
