export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'quality_manager' | 'inspector' | 'supervisor' | 'production_operator' | 'quality_inspector' | 'system_admin' | string;
  permissions?: string[];
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  description?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BatchDecision {
  id: number;
  batch_id: number;
  decided_by_user_id: number;
  previous_status: string;
  new_status: string;
  reason: string;
  created_at: string;
  decided_by_name?: string;
}

export interface Batch {
  id: number;
  product_id: number;
  batch_number: string;
  quantity: number;
  production_date: string;
  status: 'IN_PROGRESS' | 'ON_HOLD' | 'RELEASED' | 'REJECTED';
  decision_notes?: string;
  decided_by_user_id?: number;
  decided_at?: string;
  created_at: string;
  updated_at: string;
  product_code?: string;
  product_name?: string;
  total_inspections: number;
  defect_count: number;
}

export interface ImageEvidence {
  id: number;
  inspection_id: number;
  file_path: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  sha256_hash: string;
  heatmap_path?: string;
  created_at: string;
}

export interface InferenceAttempt {
  id: number;
  inspection_id: number;
  image_id: number;
  model_name: string;
  model_version: string;
  inference_duration_ms: number;
  raw_prediction: 'DEFECTIVE' | 'OK' | 'UNKNOWN' | string;
  defect_type?: string;
  defect_display_name?: string;
  class_probabilities?: string | Record<string, number>;
  confidence_score: number;
  defect_probability: number;
  status: 'SUCCESS' | 'FAILED';
  error_message?: string;
  created_at: string;
}

export interface HumanReview {
  id: number;
  inspection_id: number;
  reviewer_id: number;
  decision: 'CONFIRMED_DEFECT' | 'NO_DEFECT_CONFIRMED' | 'NEEDS_MORE_EVIDENCE';
  reason?: string;
  notes?: string;
  created_at: string;
  reviewer_name?: string;
}

export interface CorrectiveAction {
  id: number;
  action_code: string;
  defect_id: number;
  title: string;
  description: string;
  assigned_to_user_id: number;
  target_date: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  notes?: string;
  created_at: string;
  completed_at?: string;
  assigned_to_name?: string;
  defect_code?: string;
  is_overdue: boolean;
}

export interface ConfirmedDefect {
  id: number;
  defect_code: string;
  inspection_id: number;
  batch_id: number;
  defect_category: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  description: string;
  review_status: 'OPEN' | 'ACTION_ASSIGNED' | 'IN_REMEDIATION' | 'REINSPECTION_PENDING' | 'RESOLVED' | 'REOPENED';
  created_at: string;
  resolved_at?: string;
  batch_number?: string;
  product_name?: string;
  corrective_actions: CorrectiveAction[];
}

export interface Inspection {
  id: number;
  product_id: number;
  batch_id: number;
  item_identifier: string;
  inspector_id: number;
  notes?: string;
  status: 'PENDING_INFERENCE' | 'INFERENCE_COMPLETED' | 'UNDER_REVIEW' | 'CONFIRMED_DEFECT' | 'PASSED' | 'REINSPECTED';
  is_reinspection: boolean;
  original_inspection_id?: number;
  created_at: string;
  updated_at: string;
  product_code?: string;
  product_name?: string;
  batch_number?: string;
  inspector_name?: string;
  latest_prediction?: 'DEFECTIVE' | 'OK' | 'UNKNOWN' | string;
  latest_defect_type?: string;
  latest_defect_name?: string;
  latest_confidence?: number;
  latest_image_url?: string;
  latest_heatmap_url?: string;
  images?: ImageEvidence[];
  inference_attempts?: InferenceAttempt[];
  reviews?: HumanReview[];
  defect?: ConfirmedDefect;
  original_inspection?: Inspection;
  follow_up_inspections?: Inspection[];
}

export interface TrendPoint {
  date: string;
  inspected_count: number;
  defect_count: number;
  defect_rate: number;
}

export interface DashboardMetrics {
  total_inspected_items: number;
  pending_reviews: number;
  confirmed_defects: number;
  open_corrective_actions: number;
  overdue_actions: number;
  overall_defect_rate: number;
  batches_on_hold: number;
  recent_inspections: Inspection[];
  trend_history: TrendPoint[];
}

export interface CopilotCitation {
  record_type: string;
  record_id: string;
  label: string;
}

export interface CopilotResponse {
  query: string;
  answer: string;
  citations: CopilotCitation[];
  grounded_stats: Record<string, any>;
  provider: string;
  authorized: boolean;
}

export interface PrioritizationFactor {
  factor_name: string;
  score_contribution: number;
  description: string;
}

export interface PrioritizedInspection {
  inspection: Inspection;
  priority_score: number;
  priority_tier: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  factors: PrioritizationFactor[];
}

export interface BenchmarkMetrics {
  total_items_in_backlog: number;
  critical_items_identified: number;
  fifo_baseline: {
    time_to_first_critical_defect_min: number;
    high_risk_coverage_rate: number;
  };
  evidence_driven_priority: {
    time_to_first_critical_defect_min: number;
    high_risk_coverage_rate: number;
    efficiency_gain_pct: number;
  };
  comparison_summary: string;
}

export interface EvalSample {
  filename: string;
  ground_truth: 'DEFECTIVE' | 'OK';
  source: string;
  description: string;
}


export type ImageScope = 'ITEM' | 'SURFACE' | 'BATCH_SAMPLE';

export type ComparisonOutcome = 
  | 'LIKELY_IMPROVED' 
  | 'DEFECT_STILL_PRESENT' 
  | 'NEW_OR_DIFFERENT_ANOMALY' 
  | 'INCONCLUSIVE';

export type ComparisonDecision = 
  | 'CONFIRM_CORRECTION' 
  | 'DEFECT_STILL_PRESENT' 
  | 'REQUEST_ANOTHER_INSPECTION' 
  | 'INCONCLUSIVE'
  | 'PENDING_REVIEW';

export interface ReinspectionRecord {
  id: number;
  original_inspection_id: number;
  follow_up_inspection_id: number;
  reason?: string;
  image_scope?: ImageScope;
  comparison_suggestion?: ComparisonOutcome;
  comparison_decision?: ComparisonDecision;
  reviewer_id?: number;
  reviewer_notes?: string;
  reviewed_at?: string;
  linked_action_id?: number;
  status: string;
  created_at?: string;
}

export interface ReferenceImageInfo {
  filename?: string;
  label?: string;
  description?: string;
  url?: string;
}

export interface ReinspectionComparisonData {
  original_inspection: Inspection;
  reinspection?: Inspection;
  post_repair_inspection?: Inspection;
  reference_image?: ReferenceImageInfo;
  reinspection_record?: ReinspectionRecord;
  linked_defect?: ConfirmedDefect;
  linked_capa?: CorrectiveAction;
  assessment_outcome: ComparisonOutcome;
  comparison_suggestion: ComparisonOutcome;
  comparison_decision: ComparisonDecision;
  recommendation: string;
  requires_human_approval: boolean;
}
