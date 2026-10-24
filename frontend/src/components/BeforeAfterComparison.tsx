import React, { useState, useRef, useEffect } from 'react';
import {
  ReinspectionComparisonData,
  ComparisonOutcome,
  ComparisonDecision,
  User
} from '../types';
import { api, resolveImageUrl } from '../api/client';
import { hasPermission, PERM_INSPECTION_REVIEW, PERM_CAPA_VERIFY } from '../utils/rbac';

interface BeforeAfterComparisonProps {
  comparison: ReinspectionComparisonData;
  currentUser: User | null;
  onDecisionSubmitted?: (updated: ReinspectionComparisonData) => void;
  onClose?: () => void;
}

export const BeforeAfterComparison: React.FC<BeforeAfterComparisonProps> = ({
  comparison,
  currentUser,
  onDecisionSubmitted,
  onClose
}) => {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider'>('slider');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Toggles for heatmaps
  const [showBeforeHeatmap, setShowBeforeHeatmap] = useState(false);
  const [showAfterHeatmap, setShowAfterHeatmap] = useState(false);
  const [showReferenceStandard, setShowReferenceStandard] = useState(false);

  // Decision form state
  const [decision, setDecision] = useState<ComparisonDecision>('CONFIRM_CORRECTION');
  const [notes, setNotes] = useState('');
  const [closeCapa, setCloseCapa] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const orig = comparison.original_inspection;
  const post = comparison.reinspection || comparison.post_repair_inspection;
  const reinspRecord = comparison.reinspection_record;
  const isReviewed = reinspRecord?.comparison_decision && reinspRecord.comparison_decision !== 'PENDING_REVIEW';

  // Check separation of duties
  const isAuthor = currentUser && (orig?.inspector_id === currentUser.id || post?.inspector_id === currentUser.id);
  const canReview = hasPermission(currentUser, PERM_INSPECTION_REVIEW);
  const canVerifyCapa = hasPermission(currentUser, PERM_CAPA_VERIFY);

  // Helper for image resolution
  const getOrigImageUrl = () => {
    if (showBeforeHeatmap && orig?.latest_heatmap_url) {
      return resolveImageUrl(orig.latest_heatmap_url);
    }
    if (orig?.latest_image_url) {
      return resolveImageUrl(orig.latest_image_url);
    }
    if (orig?.images && orig.images.length > 0) {
      const img = orig.images[0];
      return resolveImageUrl(showBeforeHeatmap && img.heatmap_path ? `/api/v1/inspections/images/${img.heatmap_path}` : `/api/v1/inspections/images/${img.file_path}`);
    }
    return '';
  };

  const getPostImageUrl = () => {
    if (showAfterHeatmap && post?.latest_heatmap_url) {
      return resolveImageUrl(post.latest_heatmap_url);
    }
    if (post?.latest_image_url) {
      return resolveImageUrl(post.latest_image_url);
    }
    if (post?.images && post.images.length > 0) {
      const img = post.images[0];
      return resolveImageUrl(showAfterHeatmap && img.heatmap_path ? `/api/v1/inspections/images/${img.heatmap_path}` : `/api/v1/inspections/images/${img.file_path}`);
    }
    return '';
  };

  // Slider drag handling
  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pos = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(pos);
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleSliderMove(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) handleSliderMove(e.touches[0].clientX);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (!notes.trim()) {
      setSubmitError('Reviewer notes and technical justification are required.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const updated = await api.submitComparisonReview(post.id, {
        decision,
        notes: notes.trim(),
        close_capa: Boolean(closeCapa && canVerifyCapa)
      });
      setSubmitSuccess(`Audited decision "${decision}" recorded successfully.`);
      if (onDecisionSubmitted) {
        onDecisionSubmitted(updated);
      }
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit comparison review. Please verify permissions.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status pill helpers
  const getSuggestionBadge = (outcome: ComparisonOutcome) => {
    switch (outcome) {
      case 'LIKELY_IMPROVED':
        return {
          bg: 'bg-[#71845B]/15 text-[#4E5D3E] border-[#71845B]/30',
          dot: 'bg-[#71845B]',
          label: 'AI Suggestion: Defect Cleared (Likely Improved)'
        };
      case 'DEFECT_STILL_PRESENT':
        return {
          bg: 'bg-[#C97958]/15 text-[#8E442B] border-[#C97958]/30',
          dot: 'bg-[#C97958]',
          label: 'AI Suggestion: Defect Still Present'
        };
      case 'NEW_OR_DIFFERENT_ANOMALY':
        return {
          bg: 'bg-[#C49A52]/15 text-[#7A5A1B] border-[#C49A52]/30',
          dot: 'bg-[#C49A52]',
          label: 'AI Suggestion: New / Different Surface Anomaly'
        };
      default:
        return {
          bg: 'bg-[#7895A5]/15 text-[#435C6C] border-[#7895A5]/30',
          dot: 'bg-[#7895A5]',
          label: 'AI Suggestion: Inconclusive / Requires Human Review'
        };
    }
  };

  const badge = getSuggestionBadge(comparison.comparison_suggestion || comparison.assessment_outcome);

  return (
    <div className="bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl shadow-sm overflow-hidden text-[#2B2A27]">
      {/* Top Banner / Workstation Header */}
      <div className="p-4 sm:p-5 border-b border-[#D8C9AE] bg-gradient-to-r from-[#F5F1E8] to-[#EFE9DC] flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider rounded bg-[#71845B] text-white">
              Reinspection Studio
            </span>
            <span className="text-xs font-mono text-[#6A6964]">
              Item: {post?.item_identifier || orig?.item_identifier}
            </span>
            {reinspRecord?.image_scope && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8DFC8] text-[#55524A] font-medium">
                Scope: {reinspRecord.image_scope}
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#2B2A27]">
            Before vs. After Defect Comparison
          </h2>
          <p className="text-xs sm:text-sm text-[#6A6964] mt-0.5">
            Original Scan #{orig?.id} vs. Post-Repair Verification Scan #{post?.id} | Batch #{orig?.batch_number || 'N/A'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-[#D8C9AE] bg-[#FFFCF6] p-1 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('slider')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                viewMode === 'slider'
                  ? 'bg-[#71845B] text-white shadow-xs'
                  : 'text-[#6A6964] hover:text-[#2B2A27]'
              }`}
            >
              Interactive Slider
            </button>
            <button
              type="button"
              onClick={() => setViewMode('side-by-side')}
              className={`px-3 py-1 font-medium rounded-md transition-colors ${
                viewMode === 'side-by-side'
                  ? 'bg-[#71845B] text-white shadow-xs'
                  : 'text-[#6A6964] hover:text-[#2B2A27]'
              }`}
            >
              Side-by-Side
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6A6964] hover:text-[#2B2A27] hover:bg-[#EFE9DC] transition-colors"
              title="Close Comparison"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* AI Suggestion Alert Banner */}
      <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${badge.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full shrink-0 ${badge.dot}`} />
          <div>
            <div className="text-sm font-bold">{badge.label}</div>
            <div className="text-xs opacity-90 mt-0.5">{comparison.recommendation}</div>
          </div>
        </div>
        <div className="text-[11px] font-medium tracking-wide uppercase px-2.5 py-1 rounded bg-[#FFFCF6]/80 text-[#2B2A27] border border-current/20">
          ISO 9001: Human Review Required
        </div>
      </div>

      {/* Linked CAPA / Defect Summary Bar */}
      {(comparison.linked_defect || comparison.linked_capa) && (
        <div className="px-5 py-2.5 bg-[#FAF6EE] border-b border-[#D8C9AE] text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            {comparison.linked_defect && (
              <div>
                <span className="text-[#6A6964]">Target Defect: </span>
                <span className="font-semibold text-[#8E442B]">
                  {comparison.linked_defect.defect_category} ({comparison.linked_defect.severity})
                </span>
                <span className="ml-1 text-[11px] text-[#6A6964]">Status: {comparison.linked_defect.review_status}</span>
              </div>
            )}
            {comparison.linked_capa && (
              <div>
                <span className="text-[#6A6964]">Linked CAPA: </span>
                <span className="font-semibold text-[#2B2A27]">{comparison.linked_capa.title}</span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#7895A5]/20 text-[#314856]">
                  {comparison.linked_capa.status}
                </span>
              </div>
            )}
          </div>

          {comparison.reference_image?.url && (
            <button
              type="button"
              onClick={() => setShowReferenceStandard(!showReferenceStandard)}
              className="text-xs font-medium text-[#71845B] hover:text-[#4E5D3E] underline flex items-center gap-1"
            >
              {showReferenceStandard ? 'Hide Golden Standard' : 'View Golden Standard'}
            </button>
          )}
        </div>
      )}

      {/* Reference Standard Drawer (Defect-Free Golden Sample) */}
      {showReferenceStandard && comparison.reference_image?.url && (
        <div className="p-4 bg-[#EFE9DC]/60 border-b border-[#D8C9AE] flex flex-col sm:flex-row items-center gap-4 animate-fadeIn">
          <div className="w-28 h-28 rounded-lg overflow-hidden border border-[#D8C9AE] shrink-0 bg-black">
            <img
              src={resolveImageUrl(comparison.reference_image.url)}
              alt="Golden Standard Reference"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#71845B] text-white">
              Known Defect-Free Reference
            </span>
            <h4 className="text-sm font-semibold text-[#2B2A27] mt-1">
              {comparison.reference_image.label || 'Clean Industrial Casting Standard'}
            </h4>
            <p className="text-xs text-[#6A6964] mt-0.5 max-w-xl">
              {comparison.reference_image.description || 'Authentic defect-free casting surface used as comparative baseline for metallurgical texture and finish.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Visual Comparison Studio */}
      <div className="p-4 sm:p-6 bg-[#F5F1E8]">
        {viewMode === 'slider' ? (
          /* Interactive Split-Slider View */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#55524A]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C97958]" />
                <span>BEFORE (Original Scan #{orig?.id})</span>
                <button
                  type="button"
                  onClick={() => setShowBeforeHeatmap(!showBeforeHeatmap)}
                  className={`ml-2 px-2 py-0.5 rounded text-[11px] border ${
                    showBeforeHeatmap
                      ? 'bg-[#C97958] text-white border-[#C97958]'
                      : 'bg-[#FFFCF6] text-[#6A6964] border-[#D8C9AE]'
                  }`}
                >
                  {showBeforeHeatmap ? 'Grad-CAM Active' : 'Show Grad-CAM'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAfterHeatmap(!showAfterHeatmap)}
                  className={`mr-2 px-2 py-0.5 rounded text-[11px] border ${
                    showAfterHeatmap
                      ? 'bg-[#71845B] text-white border-[#71845B]'
                      : 'bg-[#FFFCF6] text-[#6A6964] border-[#D8C9AE]'
                  }`}
                >
                  {showAfterHeatmap ? 'Grad-CAM Active' : 'Show Grad-CAM'}
                </button>
                <span>AFTER (Reinspection #{post?.id})</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#71845B]" />
              </div>
            </div>

            {/* Draggable Slider Container */}
            <div
              ref={sliderContainerRef}
              className="relative w-full aspect-16/9 sm:aspect-21/9 max-h-[500px] rounded-xl overflow-hidden shadow-inner select-none cursor-ew-resize bg-[#2B2A27] border-2 border-[#D8C9AE]"
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              {/* After Image (Background layer) */}
              <img
                src={getPostImageUrl()}
                alt="Post-Repair Scan"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />

              {/* Before Image (Clipped overlay layer) */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ width: `${sliderPosition}%` }}
              >
                <img
                  src={getOrigImageUrl()}
                  alt="Original Defect Scan"
                  className="absolute inset-0 w-full h-full object-contain max-w-none"
                  style={{
                    width: sliderContainerRef.current ? `${sliderContainerRef.current.clientWidth}px` : '100%',
                    height: '100%'
                  }}
                />
              </div>

              {/* Draggable Splitter Divider */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg pointer-events-none z-10"
                style={{ left: `${sliderPosition}%` }}
              >
                {/* Center Handle Button */}
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-[#2B2A27] shadow-md border-2 border-[#71845B] flex items-center justify-between px-1.5 cursor-ew-resize">
                  <svg className="w-2.5 h-2.5 text-[#C97958]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <svg className="w-2.5 h-2.5 text-[#71845B]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Watermarks */}
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                Before: {orig?.latest_prediction || 'DEFECT'}
              </div>
              <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-xs">
                After: {post?.latest_prediction || 'OK'}
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-[#6A6964]">
              <span>Original defect evidence</span>
              <span>Drag slider left/right to compare surface restoration</span>
              <span>Post-corrective action evidence</span>
            </div>
          </div>
        ) : (
          /* Side-by-Side View */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BEFORE Card */}
            <div className="bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EFE9DC]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#C97958]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8E442B]">
                    BEFORE (Original Defect)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBeforeHeatmap(!showBeforeHeatmap)}
                  className={`px-2 py-1 rounded text-xs border ${
                    showBeforeHeatmap
                      ? 'bg-[#C97958] text-white border-[#C97958]'
                      : 'bg-[#FFFCF6] text-[#6A6964] border-[#D8C9AE]'
                  }`}
                >
                  {showBeforeHeatmap ? 'Heatmap: ON' : 'Show Grad-CAM'}
                </button>
              </div>

              <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-[#2B2A27] border border-[#D8C9AE] mb-3 flex items-center justify-center">
                <img
                  src={getOrigImageUrl()}
                  alt="Original Defect"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[#F5F1E8]">
                  <span className="text-[#6A6964] block">AI Classification:</span>
                  <span className="font-bold text-[#8E442B]">{orig?.latest_prediction || 'DEFECT'}</span>
                </div>
                <div className="p-2 rounded bg-[#F5F1E8]">
                  <span className="text-[#6A6964] block">Confidence:</span>
                  <span className="font-mono font-semibold text-[#2B2A27]">
                    {orig?.latest_confidence ? `${(orig.latest_confidence * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#F5F1E8] col-span-2">
                  <span className="text-[#6A6964] block">Defect Signature:</span>
                  <span className="font-semibold text-[#2B2A27]">
                    {orig?.latest_defect_name || orig?.latest_defect_type || 'Unspecified anomaly'}
                  </span>
                </div>
              </div>
            </div>

            {/* AFTER Card */}
            <div className="bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#EFE9DC]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#71845B]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#4E5D3E]">
                    AFTER (Post-Repair Scan)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAfterHeatmap(!showAfterHeatmap)}
                  className={`px-2 py-1 rounded text-xs border ${
                    showAfterHeatmap
                      ? 'bg-[#71845B] text-white border-[#71845B]'
                      : 'bg-[#FFFCF6] text-[#6A6964] border-[#D8C9AE]'
                  }`}
                >
                  {showAfterHeatmap ? 'Heatmap: ON' : 'Show Grad-CAM'}
                </button>
              </div>

              <div className="relative aspect-4/3 w-full rounded-lg overflow-hidden bg-[#2B2A27] border border-[#D8C9AE] mb-3 flex items-center justify-center">
                <img
                  src={getPostImageUrl()}
                  alt="Post-Repair Scan"
                  className="max-h-full max-w-full object-contain"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[#F5F1E8]">
                  <span className="text-[#6A6964] block">AI Classification:</span>
                  <span className={`font-bold ${post?.latest_prediction === 'OK' ? 'text-[#4E5D3E]' : 'text-[#8E442B]'}`}>
                    {post?.latest_prediction || 'PENDING'}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#F5F1E8]">
                  <span className="text-[#6A6964] block">Confidence:</span>
                  <span className="font-mono font-semibold text-[#2B2A27]">
                    {post?.latest_confidence ? `${(post.latest_confidence * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
                <div className="p-2 rounded bg-[#F5F1E8] col-span-2">
                  <span className="text-[#6A6964] block">Defect Signature:</span>
                  <span className="font-semibold text-[#2B2A27]">
                    {post?.latest_defect_name || post?.latest_defect_type || 'Defect cleared / Normal surface'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Human Review & Audited Decision Panel */}
      <div className="p-5 border-t border-[#D8C9AE] bg-[#FFFCF6]">
        {isReviewed ? (
          /* Already Reviewed: Display Official Audited Sign-off Stamp */
          <div className="p-4 rounded-xl border border-[#71845B]/30 bg-[#71845B]/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider bg-[#71845B] text-white">
                Official Review Sign-Off Recorded
              </span>
              <span className="text-xs text-[#6A6964]">
                Signed: {reinspRecord?.reviewed_at ? new Date(reinspRecord.reviewed_at).toLocaleString() : 'Recently'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
              <div>
                <span className="text-[#6A6964] block">Audited Decision:</span>
                <span className="font-bold text-sm text-[#2B2A27]">{reinspRecord?.comparison_decision}</span>
              </div>
              <div>
                <span className="text-[#6A6964] block">Audited By:</span>
                <span className="font-semibold text-[#2B2A27]">
                  Reviewer ID #{reinspRecord?.reviewer_id || 'Quality Manager'}
                </span>
              </div>
              <div className="sm:col-span-2 bg-[#FFFCF6] p-3 rounded border border-[#D8C9AE]/60">
                <span className="text-[#6A6964] block font-medium mb-1">Audit Notes & Technical Justification:</span>
                <p className="text-xs text-[#2B2A27] italic">"{reinspRecord?.reviewer_notes || 'No review notes provided.'}"</p>
              </div>
            </div>
          </div>
        ) : canReview ? (
          /* Pending Review: Human Review Form */
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#2B2A27]">Human Verification & Quality Sign-Off</h3>
                <p className="text-xs text-[#6A6964]">
                  Confirm or reject whether the surface defect has been successfully rectified.
                </p>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#FAF6EE] text-[#6A6964] border border-[#D8C9AE]">
                ISO 9001: §8.7
              </span>
            </div>

            {/* Separation of Duties Warning */}
            {isAuthor && (
              <div className="p-3 mb-4 rounded-lg bg-[#C49A52]/15 border border-[#C49A52]/40 text-xs text-[#7A5A1B] flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <strong>Separation of Duties Notice:</strong> You authored this inspection. In accordance with ISO 9001 compliance, an independent Quality Inspector or Manager must review and sign off on this comparison.
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitDecision} className="space-y-4">
              {/* Decision Radio/Button Group */}
              <div>
                <label className="block text-xs font-semibold text-[#55524A] mb-2 uppercase tracking-wide">
                  Reviewer Decision:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    {
                      id: 'CONFIRM_CORRECTION',
                      label: 'Confirm Correction',
                      desc: 'Defect resolved, pass item',
                      color: 'border-[#71845B] text-[#4E5D3E] bg-[#71845B]/10'
                    },
                    {
                      id: 'DEFECT_STILL_PRESENT',
                      label: 'Defect Still Present',
                      desc: 'Anomaly remains, reject repair',
                      color: 'border-[#C97958] text-[#8E442B] bg-[#C97958]/10'
                    },
                    {
                      id: 'REQUEST_ANOTHER_INSPECTION',
                      label: 'Request Re-work',
                      desc: 'Require second polishing/pass',
                      color: 'border-[#C49A52] text-[#7A5A1B] bg-[#C49A52]/10'
                    },
                    {
                      id: 'INCONCLUSIVE',
                      label: 'Inconclusive',
                      desc: 'Escalate to metallurgy lab',
                      color: 'border-[#7895A5] text-[#435C6C] bg-[#7895A5]/10'
                    }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isAuthor || submitting}
                      onClick={() => setDecision(opt.id as ComparisonDecision)}
                      className={`p-3 text-left rounded-lg border-2 transition-all ${
                        decision === opt.id
                          ? opt.color + ' ring-2 ring-current font-bold shadow-xs'
                          : 'border-[#D8C9AE] bg-[#FFFCF6] text-[#6A6964] hover:border-[#55524A]'
                      } ${isAuthor ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="text-xs font-bold leading-tight">{opt.label}</div>
                      <div className="text-[11px] opacity-80 mt-1">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mandatory Reviewer Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#55524A] mb-1 uppercase tracking-wide">
                  Technical Justification & Notes <span className="text-[#C97958]">*</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  disabled={isAuthor || submitting}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detail microscopic/visual surface observations, absence of crack propagation, finish roughness, etc..."
                  className="w-full text-xs p-3 rounded-lg border border-[#D8C9AE] bg-[#FFFCF6] text-[#2B2A27] focus:outline-hidden focus:border-[#71845B] focus:ring-1 focus:ring-[#71845B]"
                />
              </div>

              {/* Close & Verify CAPA Checkbox for Quality Managers */}
              {comparison.linked_capa && canVerifyCapa && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#71845B]/10 border border-[#71845B]/30">
                  <input
                    type="checkbox"
                    id="closeCapaCheckbox"
                    checked={closeCapa}
                    disabled={isAuthor || submitting || decision !== 'CONFIRM_CORRECTION'}
                    onChange={(e) => setCloseCapa(e.target.checked)}
                    className="w-4 h-4 rounded text-[#71845B] focus:ring-[#71845B] border-[#D8C9AE]"
                  />
                  <label htmlFor="closeCapaCheckbox" className="text-xs text-[#2B2A27] font-medium cursor-pointer">
                    Close and Verify linked Corrective Action (CAPA #{comparison.linked_capa.id}) upon sign-off
                  </label>
                </div>
              )}

              {submitError && (
                <div className="p-3 rounded-lg bg-[#C97958]/15 border border-[#C97958]/40 text-xs text-[#8E442B]">
                  {submitError}
                </div>
              )}

              {submitSuccess && (
                <div className="p-3 rounded-lg bg-[#71845B]/15 border border-[#71845B]/40 text-xs text-[#4E5D3E]">
                  {submitSuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isAuthor || submitting || !notes.trim()}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-colors flex items-center gap-2 ${
                    isAuthor || submitting || !notes.trim()
                      ? 'bg-[#D8C9AE] cursor-not-allowed text-[#6A6964]'
                      : 'bg-[#71845B] hover:bg-[#5C6D48]'
                  }`}
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Recording Audit Signature...
                    </>
                  ) : (
                    'Submit Audited Decision'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-xs text-[#6A6964] italic text-center py-2">
            Inspection review permissions required to record official quality sign-off.
          </div>
        )}
      </div>
    </div>
  );
};
