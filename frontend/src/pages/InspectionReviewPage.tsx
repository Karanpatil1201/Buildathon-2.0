import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  ShieldAlert,
  ArrowRight,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Inspection, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';

interface InspectionReviewPageProps {
  currentUser: User | null;
  selectedInspectionId?: number | null;
  onNavigateToActions: (defectId: number) => void;
  onRefreshMetrics: () => void;
}

export const InspectionReviewPage: React.FC<InspectionReviewPageProps> = ({
  currentUser,
  selectedInspectionId,
  onNavigateToActions,
  onRefreshMetrics
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [filter, setFilter] = useState<string>('UNDER_REVIEW');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review form state
  const [decision, setDecision] = useState<'CONFIRMED_DEFECT' | 'NO_DEFECT_CONFIRMED' | 'NEEDS_MORE_EVIDENCE'>('CONFIRMED_DEFECT');
  const [defectCategory, setDefectCategory] = useState<string>('BLOWHOLE');
  const [severity, setSeverity] = useState<string>('MAJOR');
  const [reason, setReason] = useState<string>('');
  const [reviewNotes, setReviewNotes] = useState<string>('');

  const loadInspections = async () => {
    try {
      const list = await api.getInspections(undefined, filter === 'ALL' ? undefined : filter);
      setInspections(list);

      // Select target inspection
      if (selectedInspectionId) {
        const detail = await api.getInspection(selectedInspectionId);
        setSelectedInspection(detail);
      } else if (list.length > 0) {
        const detail = await api.getInspection(list[0].id);
        setSelectedInspection(detail);
      } else {
        setSelectedInspection(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load inspection records');
    }
  };

  useEffect(() => {
    loadInspections();
  }, [filter, selectedInspectionId]);

  const handleSelectInspection = async (id: number) => {
    try {
      const detail = await api.getInspection(id);
      setSelectedInspection(detail);
      setError(null);
      setSuccessMsg(null);
    } catch {
      setError('Could not load inspection detail');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection) return;

    try {
      setSubmitting(true);
      setError(null);

      const updated = await api.submitReview(selectedInspection.id, {
        decision,
        reason,
        notes: reviewNotes,
        defect_category: decision === 'CONFIRMED_DEFECT' ? defectCategory : undefined,
        severity: decision === 'CONFIRMED_DEFECT' ? severity : undefined
      });

      setSelectedInspection(updated);
      setSuccessMsg(`Review recorded successfully: ${decision.replace(/_/g, ' ')}!`);
      loadInspections();
      onRefreshMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const isInspectorOwnSubmission =
    currentUser?.role === 'inspector' &&
    selectedInspection?.inspector_id === currentUser?.id;

  const latestInference = selectedInspection?.inference_attempts?.[0];
  const latestImage = selectedInspection?.images?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-[#004A77]/40 text-[#C2E7FF] border border-[#A8C7FA]/40">
            DISPOSITION WORKBENCH // HUMAN-IN-THE-LOOP
          </span>
          <span className="text-xs text-[#8E918F] font-mono">Immutable Evidence Audit</span>
        </div>
        <h1 className="text-xl font-bold text-[#E3E3E3] tracking-tight flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[#A8C7FA]" />
          Inspector Review & Defect Disposition
        </h1>
        <p className="text-xs text-[#C4C7C5] mt-1">
          Verify optical evidence, confirm findings or challenge AI suggestions. Machine predictions remain auditable and immutable.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-[rgba(242,139,130,0.12)] border border-[#F28B82]/35 rounded-xl text-[#F6AEA9] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F28B82] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#F28B82] min-h-[44px] min-w-[44px] flex items-center justify-center font-bold">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-[rgba(129,201,149,0.12)] border border-[#81C995]/35 rounded-xl text-[#81C995] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#81C995] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#81C995] min-h-[44px] min-w-[44px] flex items-center justify-center font-bold">✕</button>
        </div>
      )}

      {/* Main Layout: List on Left (4 cols), Workbench on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Inspection Queue */}
        <div className="lg:col-span-4 space-y-3">
          <div className="industrial-card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#E3E3E3] uppercase tracking-wider font-mono">Queue Filter</span>
              <span className="text-[10px] font-mono text-[#8E918F]">{inspections.length} items</span>
            </div>
            <div className="flex gap-1.5">
              {[
                { id: 'UNDER_REVIEW', label: 'Pending' },
                { id: 'CONFIRMED_DEFECT', label: 'Defects' },
                { id: 'PASSED', label: 'Passed' },
                { id: 'ALL', label: 'All' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex-1 min-h-[44px] py-2 px-1 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                    filter === f.id
                      ? 'bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40 font-semibold'
                      : 'bg-[#303134] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#35373A]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {inspections.length === 0 ? (
              <div className="industrial-card p-6 text-center text-[#8E918F] text-xs">
                No inspections found for this filter.
              </div>
            ) : (
              inspections.map((insp) => {
                const isSelected = selectedInspection?.id === insp.id;
                return (
                  <div
                    key={insp.id}
                    onClick={() => handleSelectInspection(insp.id)}
                    className={`cursor-pointer industrial-card p-3.5 transition-all ${
                      isSelected ? 'industrial-card-active' : 'hover:bg-[#202124]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-bold text-[#E3E3E3]">
                        {insp.item_identifier}
                      </span>
                      <StatusBadge status={insp.status} size="sm" />
                    </div>
                    <div className="text-[11px] text-[#C4C7C5] truncate">
                      {insp.product_name} • <span className="font-mono text-[#A8C7FA]">{insp.batch_number}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#3C4043]/60 text-[10px]">
                      <span className="text-[#8E918F]">
                        AI: <strong className={insp.latest_prediction === 'DEFECTIVE' ? 'text-[#F28B82]' : 'text-[#81C995]'}>
                          {insp.latest_prediction || 'Pending'}
                        </strong>
                      </span>
                      <span className="text-[#8E918F] font-mono">
                        {new Date(insp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Inspection Workbench */}
        <div className="lg:col-span-8 space-y-6">
          {selectedInspection ? (
            <>
              {/* Evidence & AI Telemetry Comparison Card */}
              <div className="industrial-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[#E3E3E3] font-mono">
                        {selectedInspection.item_identifier}
                      </h2>
                      <StatusBadge status={selectedInspection.status} />
                    </div>
                    <p className="text-xs text-[#C4C7C5] mt-0.5">
                      {selectedInspection.product_name} ({selectedInspection.product_code}) • Batch: <span className="font-mono text-[#A8C7FA] font-medium">{selectedInspection.batch_number}</span>
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-[#8E918F] block">Submitted by</span>
                    <span className="text-[#E3E3E3] font-semibold">{selectedInspection.inspector_name || 'Inspector'}</span>
                  </div>
                </div>

                {/* Side-by-side Evidence Images */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Original Image */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono text-[#8E918F] uppercase tracking-wider block">
                      Original Ingested Evidence
                    </span>
                    <div className="bg-[#131314] border border-[#3C4043] rounded-xl overflow-hidden aspect-square flex items-center justify-center">
                      {latestImage ? (
                        <img
                          src={`/api/v1/inspections/images/${latestImage.file_path}`}
                          alt="Original component evidence"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-[#8E918F]">No image attached</span>
                      )}
                    </div>
                  </div>

                  {/* Grad-CAM Heatmap */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#A8C7FA] uppercase tracking-wider block font-medium">
                        Grad-CAM Spatial Heatmap
                      </span>
                      <span className="text-[10px] text-[#8E918F] font-mono">Defect Localization</span>
                    </div>
                    <div className="bg-[#131314] border border-[#3C4043] rounded-xl overflow-hidden aspect-square flex items-center justify-center">
                      {latestImage?.heatmap_path ? (
                        <img
                          src={`/api/v1/inspections/images/${latestImage.heatmap_path}`}
                          alt="Grad-CAM Heatmap"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-center p-4 text-xs text-[#8E918F]">
                          Heatmap not generated for this image.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Model Prediction Details Strip */}
                {latestInference && (
                  <div className="p-3.5 bg-[#202124] border border-[#3C4043] rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#8E918F] block">AI Suggestion</span>
                      <span className={`font-mono font-bold ${
                        latestInference.raw_prediction === 'DEFECTIVE' ? 'text-[#F28B82]' : 'text-[#81C995]'
                      }`}>
                        {latestInference.raw_prediction}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E918F] block">Confidence Score</span>
                      <span className="font-mono font-bold text-[#FFFFFF]">
                        {(latestInference.confidence_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E918F] block">Defect Probability</span>
                      <span className="font-mono font-bold text-[#FFFFFF]">
                        {(latestInference.defect_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E918F] block">Inference Speed</span>
                      <span className="font-mono text-[#C4C7C5]">
                        {latestInference.inference_duration_ms.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Separation of Duties Warning */}
              {isInspectorOwnSubmission && (
                <div className="p-4 bg-[rgba(253,214,99,0.12)] border border-[#FDD663]/30 rounded-xl text-[#FDD663] text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-[#FDD663]">
                    <ShieldAlert className="w-4 h-4 text-[#FDD663]" />
                    <span>Separation of Duties Policy Active</span>
                  </div>
                  <p className="text-[#E3E3E3]">
                    You submitted this inspection as <strong>Marcus Lee (Inspector)</strong>. By ISO 9001 governance, you cannot approve your own submission.
                    Please switch to <strong>Elena Vance (Quality Manager)</strong> in the top navbar to record an authorized review.
                  </p>
                </div>
              )}

              {/* Review Submission Card */}
              <div className="industrial-card p-5">
                <h3 className="text-sm font-semibold text-[#E3E3E3] mb-2">Record Human Quality Disposition</h3>
                <p className="text-xs text-[#8E918F] mb-4">
                  The reviewer decision is recorded separately and does not overwrite original model telemetry.
                </p>

                <form onSubmit={handleSubmitReview} className="space-y-4">
                  {/* Three Main Decision Choices */}
                  <div>
                    <label className="text-xs text-[#C4C7C5] font-medium block mb-1.5">
                      Review Decision
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDecision('CONFIRMED_DEFECT')}
                        className={`min-h-[44px] p-3.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                          decision === 'CONFIRMED_DEFECT'
                            ? 'bg-[rgba(242,139,130,0.15)] border-[#F28B82] text-[#F28B82]'
                            : 'bg-[#202124] border-[#3C4043] text-[#C4C7C5] hover:border-[#5F6368]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[#F28B82] font-bold">
                          <XCircle className="w-4 h-4" />
                          <span>Confirm Defect</span>
                        </div>
                        <p className="text-[11px] text-[#8E918F]">Defect is verified. Creates defect record.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision('NO_DEFECT_CONFIRMED')}
                        className={`min-h-[44px] p-3.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                          decision === 'NO_DEFECT_CONFIRMED'
                            ? 'bg-[rgba(129,201,149,0.15)] border-[#81C995] text-[#81C995]'
                            : 'bg-[#202124] border-[#3C4043] text-[#C4C7C5] hover:border-[#5F6368]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[#81C995] font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm Passed (No Defect)</span>
                        </div>
                        <p className="text-[11px] text-[#8E918F]">Component approved. Challenges AI if flagged.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision('NEEDS_MORE_EVIDENCE')}
                        className={`min-h-[44px] p-3.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                          decision === 'NEEDS_MORE_EVIDENCE'
                            ? 'bg-[rgba(168,199,250,0.15)] border-[#A8C7FA] text-[#A8C7FA]'
                            : 'bg-[#202124] border-[#3C4043] text-[#C4C7C5] hover:border-[#5F6368]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[#A8C7FA] font-bold">
                          <Clock className="w-4 h-4" />
                          <span>Needs Evidence</span>
                        </div>
                        <p className="text-[11px] text-[#8E918F]">Ambiguous. Requests additional imaging.</p>
                      </button>
                    </div>
                  </div>

                  {/* Defect Category & Severity if Defect Confirmed */}
                  {decision === 'CONFIRMED_DEFECT' && (
                    <div className="p-3.5 bg-[#202124] border border-[#3C4043] rounded-xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-[#C4C7C5] font-medium block mb-1">
                            Defect Category (Supported Classification)
                          </label>
                          <select
                            value={defectCategory}
                            onChange={e => setDefectCategory(e.target.value)}
                            className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-[#E3E3E3] focus:outline-none focus:border-[#A8C7FA] font-mono"
                          >
                            <option value="BLOWHOLE">BLOWHOLE (Gas Porosity Cavity)</option>
                            <option value="PINHOLE">PINHOLE (Subsurface Tiny Pores)</option>
                            <option value="SHRINKAGE">SHRINKAGE (Volumetric Contraction)</option>
                            <option value="CRACK">CRACK (Hot Tear / Stress Fracture)</option>
                            <option value="MOULD_DROP">MOULD DROP (Sand Inclusion / Missing Boss)</option>
                            <option value="SURFACE_ROUGHNESS">SURFACE ROUGHNESS (Excess Flash / Burr)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-[#C4C7C5] font-medium block mb-1">
                            Severity Level
                          </label>
                          <select
                            value={severity}
                            onChange={e => setSeverity(e.target.value)}
                            className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-[#E3E3E3] focus:outline-none focus:border-[#A8C7FA] font-mono font-bold"
                          >
                            <option value="CRITICAL">CRITICAL (Component Scrap / Structural Failure)</option>
                            <option value="MAJOR">MAJOR (Rework Required / Dimension Out)</option>
                            <option value="MINOR">MINOR (Aesthetic / Machining Allowance)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[#C4C7C5] font-medium block mb-1">
                        Reason / Rationale (e.g. AI challenged or confirmed)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Defect verified near gate or False alarm"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full min-h-[44px] bg-[#202124] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-[#E3E3E3] focus:outline-none focus:border-[#A8C7FA]"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-[#C4C7C5] font-medium block mb-1">
                        Technical Review Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Verified with caliper and ultrasonic check"
                        value={reviewNotes}
                        onChange={e => setReviewNotes(e.target.value)}
                        className="w-full min-h-[44px] bg-[#202124] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-[#E3E3E3] focus:outline-none focus:border-[#A8C7FA]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#3C4043]">
                    <div className="text-[11px] text-[#8E918F] font-mono">
                      Reviewer: <strong className="text-[#E3E3E3]">{currentUser?.full_name}</strong> ({currentUser?.role})
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || isInspectorOwnSubmission}
                      className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        isInspectorOwnSubmission
                          ? 'bg-[#303134] text-[#8E918F] cursor-not-allowed'
                          : 'bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] cursor-pointer shadow-sm active:bg-[#8AB4F8]'
                      }`}
                    >
                      Commit Quality Disposition
                    </button>
                  </div>
                </form>
              </div>

              {/* Linked Defect Card & CAPA Trigger if defect exists */}
              {selectedInspection.defect && (
                <div className="industrial-card p-5 border-[#F28B82]/40 bg-[rgba(242,139,130,0.06)]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-[#F28B82]" />
                      <h4 className="text-sm font-bold text-[#E3E3E3] font-mono">
                        Linked Confirmed Defect: {selectedInspection.defect.defect_code}
                      </h4>
                    </div>
                    <StatusBadge status={selectedInspection.defect.review_status} />
                  </div>
                  <p className="text-xs text-[#C4C7C5] mb-3">{selectedInspection.defect.description}</p>
                  <button
                    onClick={() => onNavigateToActions(selectedInspection.defect!.id)}
                    className="min-h-[44px] flex items-center gap-1.5 bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer transition-colors"
                  >
                    <span>Manage Corrective Action (CAPA)</span>
                    <ArrowRight className="w-4 h-4 text-[#A8C7FA]" />
                  </button>
                </div>
              )}

              {/* Historical Review Audit Trail */}
              {selectedInspection.reviews && selectedInspection.reviews.length > 0 && (
                <div className="industrial-card p-5">
                  <h4 className="text-xs font-bold text-[#E3E3E3] mb-3 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#A8C7FA]" />
                    Inspection Review History
                  </h4>
                  <div className="space-y-2">
                    {selectedInspection.reviews.map((rev) => (
                      <div key={rev.id} className="p-3.5 bg-[#202124] border border-[#3C4043] rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={rev.decision} size="sm" />
                          <span className="text-[10px] font-mono text-[#8E918F]">
                            {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[#E3E3E3]">{rev.reason}</p>
                        {rev.notes && <p className="text-[#8E918F] text-[11px]">{rev.notes}</p>}
                        <div className="text-[10px] text-[#A8C7FA] font-mono">
                          Reviewer: {rev.reviewer_name || 'Elena Vance'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="industrial-card p-12 text-center text-[#8E918F] text-xs">
              Select an inspection from the left queue to review evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
