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
  Clock,
  RefreshCw
} from 'lucide-react';
import { Inspection, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';
import { canReviewInspection } from '../utils/rbac';

interface InspectionReviewPageProps {
  currentUser: User | null;
  selectedInspectionId?: number | null;
  onNavigateToActions: (defectId: number) => void;
  onRefreshMetrics: () => void;
  onStartReinspection?: (originalInspectionId: number, productId: number, batchId: number, itemIdentifier: string, defectType?: string) => void;
  onViewInspection?: (id: number) => void;
}

export const InspectionReviewPage: React.FC<InspectionReviewPageProps> = ({
  currentUser,
  selectedInspectionId,
  onNavigateToActions,
  onRefreshMetrics,
  onStartReinspection,
  onViewInspection
}) => {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [filter, setFilter] = useState<string>('UNDER_REVIEW');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review form state
  const [decision, setDecision] = useState<'CONFIRMED_DEFECT' | 'NO_DEFECT_CONFIRMED' | 'NEEDS_MORE_EVIDENCE'>('CONFIRMED_DEFECT');
  const [defectCategory, setDefectCategory] = useState<string>('CRAZING');

  // Defect Category Auto-Suggestion: Suggest visible defect type when supported by dataset
  useEffect(() => {
    if (selectedInspection) {
      const raw = `${selectedInspection.notes || ''} ${selectedInspection.item_identifier || ''} ${selectedInspection.images?.[0]?.original_filename || ''}`.toUpperCase();
      if (raw.includes('CRAZING')) setDefectCategory('CRAZING');
      else if (raw.includes('INCLUSION')) setDefectCategory('INCLUSION');
      else if (raw.includes('PATCH')) setDefectCategory('PATCHES');
      else if (raw.includes('PIT')) setDefectCategory('PITTED_SURFACE');
      else if (raw.includes('SCALE') || raw.includes('ROLLED')) setDefectCategory('ROLLED_IN_SCALE');
      else if (raw.includes('SCRATCH')) setDefectCategory('SCRATCHES');
    }
  }, [selectedInspection]);
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

  const reviewAuth = canReviewInspection(currentUser, selectedInspection?.inspector_id);
  const isInspectorOwnSubmission = !reviewAuth.allowed;

  const latestInference = selectedInspection?.inference_attempts?.[0];
  const latestImage = selectedInspection?.images?.[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wide">
            DISPOSITION WORKBENCH // HUMAN-IN-THE-LOOP
          </span>
          <span className="text-xs text-[#77766E] font-sans">Immutable Evidence Audit</span>
        </div>
        <h1 className="type-page-title flex items-center gap-2.5">
          <ClipboardCheck className="w-6 h-6 text-[#71845B] shrink-0" />
          Inspector Review & Defect Disposition
        </h1>
        <p className="text-xs sm:text-sm text-[#77766E] mt-1 font-sans leading-relaxed">
          Verify optical evidence, confirm findings or challenge AI suggestions. Machine predictions remain auditable and immutable.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/35 rounded-xl text-[#C97958] text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C97958] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#C97958] min-h-[40px] min-w-[40px] flex items-center justify-center font-bold cursor-pointer">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-[rgba(113,132,91,0.12)] border border-[#71845B]/35 rounded-xl text-[#5E704B] text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#71845B] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#71845B] min-h-[40px] min-w-[40px] flex items-center justify-center font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Layout: List on Left (4 cols), Workbench on Right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Inspection Queue */}
        <div className="lg:col-span-4 space-y-3">
          <div className="industrial-card p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="type-label-meta">Queue Filter</span>
              <span className="font-mono text-xs tabular-nums text-[#77766E]">{inspections.length} items</span>
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
                  className={`flex-1 min-h-[38px] py-1.5 px-1 text-xs font-sans transition-colors cursor-pointer rounded-xl ${
                    filter === f.id
                      ? 'bg-[#71845B] text-[#FFFFFF] font-semibold shadow-xs'
                      : 'bg-[#F0EAE1] text-[#77766E] font-medium hover:text-[#292A26] hover:bg-[#EBE4D8]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {inspections.length === 0 ? (
              <div className="industrial-card p-6 text-center text-[#77766E] text-xs font-sans shadow-sm">
                No inspections found for this filter.
              </div>
            ) : (
              inspections.map((insp) => {
                const isSelected = selectedInspection?.id === insp.id;
                return (
                  <div
                    key={insp.id}
                    onClick={() => handleSelectInspection(insp.id)}
                    className={`cursor-pointer industrial-card p-3.5 transition-all shadow-sm ${
                      isSelected
                        ? 'border-[#71845B] bg-[rgba(113,132,91,0.08)]'
                        : 'hover:bg-[#F0EAE1]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-semibold text-[#292A26]">
                        {insp.item_identifier}
                      </span>
                      <StatusBadge status={insp.status} size="sm" />
                    </div>
                    <div className="text-xs text-[#77766E] font-sans truncate">
                      {insp.product_name} • <span className="font-mono text-[#71845B] font-semibold">{insp.batch_number}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-[#D8C9AE]/50 text-xs font-sans">
                      <span className="text-[#77766E] flex items-center gap-1.5 flex-wrap">
                        <span className={`font-semibold ${insp.latest_prediction === 'DEFECTIVE' ? 'text-[#C97958]' : 'text-[#71845B]'}`}>
                          {insp.latest_prediction || 'Pending'}
                        </span>
                        {insp.latest_defect_type && insp.latest_defect_type !== 'NORMAL' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[rgba(201,121,88,0.12)] text-[#C97958] border border-[#C97958]/25">
                            {insp.latest_defect_type.replace('_', ' ')}
                          </span>
                        )}
                      </span>
                      <span className="text-[#96958B] font-mono tabular-nums text-xs">
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
        <div className="lg:col-span-8 space-y-4">
          {selectedInspection ? (
            <>
              {/* Linked Original Inspection Banner (if this is a Reinspection) */}
              {selectedInspection.is_reinspection && selectedInspection.original_inspection && (
                <div className="p-4 bg-[rgba(196,154,82,0.12)] border-2 border-[#C49A52] rounded-xl flex items-center justify-between text-xs font-sans shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-[#C49A52] text-white">
                        REINSPECTION SCAN
                      </span>
                      <span className="font-bold text-[#292A26]">
                        Directly Linked Follow-Up for Original Inspection #{selectedInspection.original_inspection.id}
                      </span>
                    </div>
                    <p className="text-[#77766E] text-xs">
                      Original Component: <strong className="font-mono text-[#292A26]">{selectedInspection.original_inspection.item_identifier}</strong> | Initial Failure: <strong className="font-mono text-[#C97958]">{selectedInspection.original_inspection.latest_prediction} ({selectedInspection.original_inspection.latest_defect_type?.replace('_', ' ') || 'Defective'})</strong>
                    </p>
                  </div>
                  {onViewInspection && (
                    <button
                      type="button"
                      onClick={() => onViewInspection(selectedInspection.original_inspection!.id)}
                      className="px-3 py-1.5 rounded-lg border border-[#D8C9AE] bg-[#FFFCF6] text-[#71845B] hover:text-[#292A26] text-xs font-semibold font-sans transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>View Original #{selectedInspection.original_inspection.id}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Follow-up Reinspections on File Banner (if this was original) */}
              {selectedInspection.follow_up_inspections && selectedInspection.follow_up_inspections.length > 0 && (
                <div className="p-4 bg-[rgba(113,132,91,0.1)] border-2 border-[#71845B]/40 rounded-xl space-y-2 text-xs font-sans shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-[#71845B] text-white">
                        FOLLOW-UP REINSPECTION RECORDED
                      </span>
                      <span className="font-bold text-[#292A26]">
                        {selectedInspection.follow_up_inspections.length} Reinspection Scan(s) on File
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {selectedInspection.follow_up_inspections.map((f) => (
                      <div key={f.id} className="p-2.5 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-xs text-[#292A26]">Follow-up #{f.id}</span>
                          <span className="text-[10px] text-[#77766E] block font-mono">{f.item_identifier}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                            f.latest_prediction === 'OK' || f.status === 'PASSED'
                              ? 'bg-[rgba(113,132,91,0.15)] text-[#5E704B] border-[#71845B]/30'
                              : 'bg-[rgba(201,121,88,0.15)] text-[#C97958] border-[#C97958]/35'
                          }`}>
                            {f.latest_prediction || f.status}
                          </span>
                          {onViewInspection && (
                            <button
                              type="button"
                              onClick={() => onViewInspection(f.id)}
                              className="text-xs font-semibold text-[#71845B] hover:underline"
                            >
                              View →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Evidence & AI Telemetry Comparison Card */}
              <div className="industrial-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-[#292A26] font-mono">
                        {selectedInspection.item_identifier}
                      </h2>
                      <StatusBadge status={selectedInspection.status} />
                    </div>
                    <p className="text-xs text-[#77766E] mt-0.5 font-sans">
                      {selectedInspection.product_name} ({selectedInspection.product_code}) • Batch: <span className="font-mono text-[#71845B] font-semibold">{selectedInspection.batch_number}</span>
                    </p>
                  </div>
                  <div className="text-right text-xs font-sans flex items-center gap-3">
                    {onStartReinspection && (selectedInspection.status === 'CONFIRMED_DEFECT' || latestInference?.raw_prediction === 'DEFECTIVE') && (
                      <button
                        type="button"
                        onClick={() => onStartReinspection(
                          selectedInspection.id,
                          selectedInspection.product_id,
                          selectedInspection.batch_id,
                          selectedInspection.item_identifier,
                          latestInference?.defect_type
                        )}
                        className="px-3 py-1.5 rounded-lg border border-[#C49A52] bg-[rgba(196,154,82,0.12)] hover:bg-[rgba(196,154,82,0.22)] text-[#A07834] text-xs font-semibold font-sans flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs"
                        title="Schedule a follow-up reinspection linked directly to this failed inspection"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Launch Reinspection</span>
                      </button>
                    )}
                    <div>
                      <span className="text-[#77766E] block">Submitted by</span>
                      <span className="text-[#292A26] font-semibold">{selectedInspection.inspector_name || 'Inspector'}</span>
                    </div>
                  </div>
                </div>

                {/* Side-by-side Evidence Images */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#D8C9AE]/60">
                    <span className="type-label-meta text-[#292A26]">
                      Visual Evidence Inspection Studio (ATS Inspect Standard)
                    </span>
                    <span className="text-[11px] font-mono text-[#77766E]">
                      Optical 4K Line-Scan // Sensor 01
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original Image */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="type-label-meta text-[#77766E] block">
                          Ingested Component Optical Evidence
                        </span>
                        <span className="text-[10px] font-mono text-[#77766E] bg-[#F0EAE1] px-1.5 py-0.5 rounded border border-[#D8C9AE]">
                          RAW CAPTURE
                        </span>
                      </div>
                      <div className="bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl overflow-hidden aspect-square flex items-center justify-center relative shadow-inner">
                        {latestImage ? (
                          <img
                            src={`/api/v1/inspections/images/${latestImage.file_path}`}
                            alt="Original component evidence"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xs text-[#77766E] font-sans">No image attached</span>
                        )}
                        {/* Optical Crosshair Marker */}
                        <div className="absolute top-2 left-2 text-[9px] font-mono text-[#77766E]/70 pointer-events-none">
                          POS: X:300 Y:300
                        </div>
                      </div>
                    </div>

                    {/* Grad-CAM Heatmap */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="type-label-meta text-[#71845B] block font-semibold">
                          Grad-CAM Neural Attention Heatmap
                        </span>
                        <span className="text-[10px] font-mono text-[#5E704B] bg-[rgba(113,132,91,0.12)] px-1.5 py-0.5 rounded border border-[#71845B]/30 font-semibold">
                          CONV GRADIENT
                        </span>
                      </div>
                      <div className="bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl overflow-hidden aspect-square flex items-center justify-center relative shadow-inner">
                        {latestImage?.heatmap_path ? (
                          <img
                            src={`/api/v1/inspections/images/${latestImage.heatmap_path}`}
                            alt="Grad-CAM Heatmap"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="text-center p-4 text-xs text-[#77766E] font-sans">
                            Heatmap not generated for this image.
                          </div>
                        )}
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-[#FFFCF6]/90 border border-[#D8C9AE] rounded text-[9px] font-mono font-semibold text-[#71845B] pointer-events-none">
                          ATTENTION GRADIENT
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Explainability Guidance Banner */}
                  <div className="p-3 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl text-xs text-[#77766E] font-sans leading-relaxed">
                    <strong className="text-[#292A26] font-semibold">Inspection Verification Standard:</strong> Grad-CAM heatmap reveals high-gradient activation zones contributing to model classification. Human inspector disposition serves as the authoritative, legally binding quality clearance.
                  </div>
                </div>

                {/* Model Prediction Details Strip */}
                {latestInference && (
                  <div className="p-3.5 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg">
                      <span className="text-[10px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">AI Model Verdict</span>
                      <span className={`font-sans font-bold text-xs uppercase tracking-wider ${
                        latestInference.raw_prediction === 'DEFECTIVE' ? 'text-[#C97958]' : 'text-[#71845B]'
                      }`}>
                        {latestInference.raw_prediction}
                      </span>
                    </div>
                    <div className="p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg">
                      <span className="text-[10px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">Detected Defect Type</span>
                      <span className={`font-mono font-bold text-xs uppercase block truncate ${
                        latestInference.raw_prediction === 'DEFECTIVE' ? 'text-[#C97958]' : 'text-[#71845B]'
                      }`}>
                        {latestInference.defect_type ? latestInference.defect_type.replace('_', ' ') : (latestInference.raw_prediction === 'DEFECTIVE' ? 'DEFECT' : 'NORMAL')}
                      </span>
                    </div>
                    <div className="p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg">
                      <span className="text-[10px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">Confidence Score</span>
                      <span className="font-mono font-bold text-[#292A26] tabular-nums text-sm">
                        {(latestInference.confidence_score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg">
                      <span className="text-[10px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">Defect Probability</span>
                      <span className="font-mono font-bold text-[#292A26] tabular-nums text-sm">
                        {(latestInference.defect_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg">
                      <span className="text-[10px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">Inference Speed</span>
                      <span className="font-mono text-[#77766E] tabular-nums text-xs">
                        {latestInference.inference_duration_ms.toFixed(1)} ms CPU
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Separation of Duties Warning */}
              {isInspectorOwnSubmission && (
                <div className="p-4 bg-[rgba(196,154,82,0.12)] border border-[#C49A52]/30 rounded-xl text-[#A07834] text-xs space-y-1 font-sans">
                  <div className="flex items-center gap-2 font-bold text-[#A07834]">
                    <ShieldAlert className="w-4 h-4 text-[#C49A52]" />
                    <span>Separation of Duties Policy Active</span>
                  </div>
                  <p className="text-[#292A26] leading-relaxed">
                    You submitted this inspection as <strong>Marcus Lee (Inspector)</strong>. By ISO 9001 governance, you cannot approve your own submission.
                    Please switch to <strong>Elena Vance (Quality Manager)</strong> in the top navbar to record an authorized review.
                  </p>
                </div>
              )}

              {/* Review Submission Card */}
              <div className="industrial-card p-5 shadow-sm">
                <h3 className="type-card-title text-[#292A26] mb-1 font-semibold">Record Human Quality Disposition</h3>
                <p className="text-xs text-[#77766E] mb-3 font-sans">
                  The reviewer decision is recorded separately and does not overwrite original model telemetry.
                </p>

                <form onSubmit={handleSubmitReview} className="space-y-4">
                  {/* Three Main Decision Choices */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#77766E] font-sans block mb-1.5">
                      Review Decision
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDecision('CONFIRMED_DEFECT')}
                        className={`min-h-[44px] p-3 rounded-xl border text-xs font-sans font-semibold text-left transition-colors cursor-pointer ${
                          decision === 'CONFIRMED_DEFECT'
                            ? 'bg-[rgba(201,121,88,0.12)] border-[#C97958] text-[#C97958]'
                            : 'bg-[#FFFCF6] border-[#D8C9AE] text-[#77766E] hover:border-[#B5A58B]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[#C97958] font-bold">
                          <XCircle className="w-4 h-4" />
                          <span>Confirm Defect</span>
                        </div>
                        <p className="text-xs text-[#77766E] font-normal leading-normal">Defect is verified. Creates defect record.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision('NO_DEFECT_CONFIRMED')}
                        className={`min-h-[44px] p-3 rounded-xl border text-xs font-sans font-semibold text-left transition-colors cursor-pointer ${
                          decision === 'NO_DEFECT_CONFIRMED'
                            ? 'bg-[rgba(113,132,91,0.12)] border-[#71845B] text-[#5E704B]'
                            : 'bg-[#FFFCF6] border-[#D8C9AE] text-[#77766E] hover:border-[#B5A58B]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[#71845B] font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm Passed (No Defect)</span>
                        </div>
                        <p className="text-xs text-[#77766E] font-normal leading-normal">Component approved. Challenges AI if flagged.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDecision('NEEDS_MORE_EVIDENCE')}
                        className={`min-h-[44px] p-3 rounded-xl border text-xs font-sans font-semibold text-left transition-colors cursor-pointer ${
                          decision === 'NEEDS_MORE_EVIDENCE'
                            ? 'bg-[rgba(120,149,165,0.12)] border-[#7895A5] text-[#456272]'
                            : 'bg-[#FFFCF6] border-[#D8C9AE] text-[#77766E] hover:border-[#B5A58B]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-[#7895A5] font-bold">
                          <Clock className="w-4 h-4" />
                          <span>Needs Evidence</span>
                        </div>
                        <p className="text-xs text-[#77766E] font-normal leading-normal">Ambiguous. Requests additional imaging.</p>
                      </button>
                    </div>
                  </div>

                  {/* Defect Category & Severity if Defect Confirmed */}
                  {decision === 'CONFIRMED_DEFECT' && (
                    <div className="p-3.5 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-[#77766E] font-sans block mb-1.5">
                            Defect Category (Supported Classification)
                          </label>
                          <select
                            value={defectCategory}
                            onChange={e => setDefectCategory(e.target.value)}
                            className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] focus:outline-none focus:border-[#71845B] font-sans font-medium"
                          >
                            <option value="CRAZING">CRAZING (Surface Microcracks)</option>
                            <option value="INCLUSION">INCLUSION (Non-Metallic Impurities)</option>
                            <option value="PATCHES">PATCHES (Surface Flaws / Scale Peeling)</option>
                            <option value="PITTED_SURFACE">PITTED SURFACE (Cavities / Pits)</option>
                            <option value="ROLLED_IN_SCALE">ROLLED-IN SCALE (Embedded Oxidation)</option>
                            <option value="SCRATCHES">SCRATCHES (Linear Abrasions)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider text-[#77766E] font-sans block mb-1.5">
                            Severity Level
                          </label>
                          <select
                            value={severity}
                            onChange={e => setSeverity(e.target.value)}
                            className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] focus:outline-none focus:border-[#71845B] font-sans font-semibold"
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#77766E] font-sans block mb-1.5">
                        Reason / Rationale (e.g. AI challenged or confirmed)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Defect verified near gate or False alarm"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] font-sans focus:outline-none focus:border-[#71845B]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#77766E] font-sans block mb-1.5">
                        Technical Review Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Verified with caliper and ultrasonic check"
                        value={reviewNotes}
                        onChange={e => setReviewNotes(e.target.value)}
                        className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] font-sans focus:outline-none focus:border-[#71845B]"
                      />
                    </div>
                  </div>

                  {!reviewAuth.allowed && (
                    <div className="p-3.5 bg-[rgba(201,121,88,0.10)] border border-[#C97958] rounded-xl text-xs flex items-start gap-2.5 mb-3">
                      <ShieldAlert className="w-4 h-4 text-[#C97958] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-[#C97958] block uppercase tracking-wider text-[11px] font-mono">
                          Separation of Duties & Policy Notice
                        </span>
                        <p className="text-[#292A26] mt-0.5 leading-relaxed font-sans">
                          {reviewAuth.reason}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-[#D8C9AE]">
                    <div className="text-xs text-[#77766E] font-sans">
                      Reviewer: <strong className="text-[#292A26]">{currentUser?.full_name}</strong> ({currentUser?.role})
                    </div>
                    <button
                      type="submit"
                      disabled={submitting || !reviewAuth.allowed}
                      title={!reviewAuth.allowed ? reviewAuth.reason : 'Commit Review'}
                      className={`min-h-[40px] px-5 py-2 rounded-xl text-xs font-semibold font-sans transition-colors ${
                        !reviewAuth.allowed
                          ? 'bg-[#E2DACB] text-[#77766E] cursor-not-allowed'
                          : 'btn-primary-sage'
                      }`}
                    >
                      {!reviewAuth.allowed ? 'Blocked by Policy' : 'Commit Quality Disposition'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Linked Defect Card & CAPA Trigger if defect exists */}
              {selectedInspection.defect && (
                <div className="industrial-card p-5 border-[#C97958]/40 bg-[rgba(201,121,88,0.06)] shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-[#C97958]" />
                      <h4 className="text-sm font-semibold text-[#292A26] font-mono">
                        Linked Confirmed Defect: {selectedInspection.defect.defect_code}
                      </h4>
                    </div>
                    <StatusBadge status={selectedInspection.defect.review_status} />
                  </div>
                  <p className="text-xs text-[#77766E] mb-3 font-sans">{selectedInspection.defect.description}</p>
                  <button
                    onClick={() => onNavigateToActions(selectedInspection.defect!.id)}
                    className="btn-secondary-ivory font-sans text-xs font-semibold"
                  >
                    <span>Manage Corrective Action (CAPA)</span>
                    <ArrowRight className="w-4 h-4 text-[#71845B]" />
                  </button>
                </div>
              )}

              {/* Historical Review Audit Trail */}
              {selectedInspection.reviews && selectedInspection.reviews.length > 0 && (
                <div className="industrial-card p-5 shadow-sm">
                  <h4 className="text-xs font-semibold text-[#292A26] mb-3 flex items-center gap-1.5 font-sans uppercase tracking-wider">
                    <History className="w-4 h-4 text-[#71845B]" />
                    Inspection Review History
                  </h4>
                  <div className="space-y-2">
                    {selectedInspection.reviews.map((rev) => (
                      <div key={rev.id} className="p-3.5 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl text-xs space-y-1 font-sans">
                        <div className="flex items-center justify-between">
                          <StatusBadge status={rev.decision} size="sm" />
                          <span className="text-[11px] font-mono tabular-nums text-[#77766E]">
                            {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[#292A26] font-medium">{rev.reason}</p>
                        {rev.notes && <p className="text-[#77766E] text-xs">{rev.notes}</p>}
                        <div className="text-[11px] text-[#71845B] font-mono font-semibold">
                          Reviewer: {rev.reviewer_name || 'Elena Vance'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="industrial-card p-12 text-center text-[#77766E] text-xs shadow-sm">
              Select an inspection from the left queue to review evidence.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
