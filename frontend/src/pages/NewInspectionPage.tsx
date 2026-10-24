import React, { useState, useEffect } from 'react';
import { Camera, Upload, Cpu, RefreshCw, ArrowRight, Image as ImageIcon, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { Product, Batch, EvalSample, Inspection } from '../types';
import { api } from '../api/client';

export interface ReinspectionContext {
  originalInspectionId: number;
  productId: number;
  batchId: number;
  itemIdentifier: string;
  defectType?: string;
  defectCategory?: string;
}

interface NewInspectionPageProps {
  onInspectionCreated: (inspectionId: number) => void;
  reinspectionContext?: ReinspectionContext | null;
  onClearReinspection?: () => void;
}

export const NewInspectionPage: React.FC<NewInspectionPageProps> = ({ onInspectionCreated, reinspectionContext, onClearReinspection }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [evalSamples, setEvalSamples] = useState<EvalSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSamples, setShowSamples] = useState(false);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [itemIdentifier, setItemIdentifier] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Processing state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultInspection, setResultInspection] = useState<Inspection | null>(null);
  const [domainRejection, setDomainRejection] = useState<any | null>(null);

  useEffect(() => {
    if (reinspectionContext) {
      if (reinspectionContext.productId) setSelectedProductId(reinspectionContext.productId);
      if (reinspectionContext.batchId) setSelectedBatchId(reinspectionContext.batchId);
      setItemIdentifier(`${reinspectionContext.itemIdentifier}-RE`);
      setNotes(`Follow-up Reinspection for Unit #${reinspectionContext.originalInspectionId} (Previous Finding: ${reinspectionContext.defectType || reinspectionContext.defectCategory || 'Defective'})`);
    }
  }, [reinspectionContext]);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [prods, bts, samples] = await Promise.all([
          api.getProducts(),
          api.getBatches(),
          api.getEvalSamples()
        ]);
        setProducts(prods);
        setBatches(bts);
        setEvalSamples(samples);

        if (prods.length > 0) setSelectedProductId(prods[0].id);
        if (bts.length > 0) setSelectedBatchId(bts[0].id);

        if (reinspectionContext) {
          setSelectedProductId(reinspectionContext.productId);
          setSelectedBatchId(reinspectionContext.batchId);
          setItemIdentifier(`${reinspectionContext.itemIdentifier}-RE`);
          setNotes(`Follow-up Reinspection for Unit #${reinspectionContext.originalInspectionId} (Previous Finding: ${reinspectionContext.defectType || reinspectionContext.defectCategory || 'Defective'})`);
        } else {
          const randId = Math.floor(1000 + Math.random() * 9000);
          setItemIdentifier(`ITEM-${randId}`);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize inspection form');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setSelectedPreset(null);
      setPreviewUrl(URL.createObjectURL(file));
      setResultInspection(null);
      setDomainRejection(null);
    }
  };

  const handleSelectPreset = (sample: EvalSample) => {
    setSelectedPreset(sample.filename);
    setSelectedFile(null);
    setPreviewUrl(`/api/v1/inspections/eval-samples/${sample.filename}`);
    setResultInspection(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !selectedPreset) {
      setError('Please select an image file or choose a preset evaluation sample.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('product_id', selectedProductId.toString());
      formData.append('batch_id', selectedBatchId.toString());
      formData.append('item_identifier', itemIdentifier);
      if (notes) formData.append('notes', notes);

      if (reinspectionContext) {
        formData.append('is_reinspection', 'true');
        formData.append('original_inspection_id', reinspectionContext.originalInspectionId.toString());
      }

      if (selectedPreset) {
        formData.append('sample_preset', selectedPreset);
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const created = await api.createInspection(formData);
      setResultInspection(created);
    } catch (err: any) {
      if (err.status === 422 || err.data?.code === 'UNSUPPORTED_IMAGE_DOMAIN') {
        setDomainRejection(err.data || { message: err.message });
      } else {
        setError(err.message || 'Inspection inference failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = async () => {
    if (!resultInspection) return;
    try {
      setSubmitting(true);
      await api.retryInference(resultInspection.id);
      const updated = await api.getInspection(resultInspection.id);
      setResultInspection(updated);
    } catch (err: any) {
      setError('Retry failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const latestInference = resultInspection?.inference_attempts?.[0];
  const latestImage = resultInspection?.images?.[0];

  return (
    <div className="space-y-5">
      {/* Header & Domain Disclosure */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wide">
            INSPECTION INTAKE // SENSOR ACTIVE
          </span>
          <span className="text-xs text-[#77766E] font-sans">Real-Time PyTorch Inference</span>
        </div>
        <h1 className="type-page-title flex items-center gap-2.5">
          <Camera className="w-6 h-6 text-[#71845B] shrink-0" />
          Optical Surface Inspection & Defect Analysis
        </h1>
        <p className="text-xs sm:text-sm text-[#77766E] mt-1 font-sans leading-relaxed">
          Ingest component imagery to run live PyTorch MobileNetV3 defect classification and generate Grad-CAM heatmaps.
        </p>
      </div>

      {/* Model Domain Notice */}
      <div className="p-3.5 bg-[rgba(196,154,82,0.12)] border border-[#C49A52]/30 rounded-xl text-xs text-[#A07834] flex items-center gap-2.5 font-sans">
        <span className="font-mono font-bold text-[#FFFFFF] uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#C49A52]">
          ACTIVE ENGINE
        </span>
        <span className="text-[#292A26] font-medium">
          Production model checkpoint is calibrated on hot-rolled steel strip & sheet surfaces (v1.0-PROD). Grad-CAM localization active for visual explainability.
        </span>
      </div>

      {error && (
        <div className="p-3.5 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/35 rounded-xl text-[#C97958] text-xs font-sans flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[#C97958] min-h-[40px] min-w-[40px] flex items-center justify-center font-bold cursor-pointer">✕</button>
        </div>
      )}

      {domainRejection && (
        <div className="p-4 bg-[rgba(201,121,88,0.12)] border-2 border-[#C97958] rounded-xl text-xs font-sans space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-[#FFFFFF] text-[10px] px-2 py-0.5 rounded bg-[#C97958] uppercase tracking-wide">
                INPUT REJECTED • OUT OF DOMAIN
              </span>
              <span className="font-semibold text-sm text-[#292A26]">
                Unsupported image. Please upload a suitable industrial steel surface / metal sheet image.
              </span>
            </div>
            <button 
              onClick={() => setDomainRejection(null)} 
              className="text-[#C97958] font-bold px-2 py-1 hover:bg-[#C97958]/10 rounded cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>
          
          <p className="text-[#555] text-xs leading-relaxed">
            {domainRejection.reason || domainRejection.message || "Input does not conform to the supported steel surface domain characteristics."}
          </p>

          {domainRejection.diagnostics && (
            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
              <div className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#C97958]/40 text-[#292A26]">
                <span className="text-[#777]">Decision: </span>
                <span className="font-bold text-[#C97958]">REJECTED (OOD)</span>
              </div>
              {domainRejection.diagnostics.mahalanobis_distance != null && (
                <div className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#C97958]/40 text-[#292A26]">
                  <span className="text-[#777]">Mahalanobis Distance: </span>
                  <span className="font-bold text-[#C97958]">{domainRejection.diagnostics.mahalanobis_distance}</span>
                  <span className="text-[#888]"> (Max: {domainRejection.diagnostics.mahalanobis_threshold || 25.0})</span>
                </div>
              )}
              {domainRejection.diagnostics.knn_distance != null && (
                <div className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#C97958]/40 text-[#292A26]">
                  <span className="text-[#777]">Deep k-NN Dist: </span>
                  <span className="font-bold text-[#C97958]">{domainRejection.diagnostics.knn_distance}</span>
                  <span className="text-[#888]"> (Max: {domainRejection.diagnostics.knn_threshold || 65.0})</span>
                </div>
              )}
              {domainRejection.diagnostics.optical?.mean_luminance != null && (
                <div className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#C97958]/40 text-[#292A26]">
                  <span className="text-[#777]">Luminance: </span>
                  <span className="font-bold">{domainRejection.diagnostics.optical.mean_luminance}</span>
                  <span className="text-[#888]"> [40, 230]</span>
                </div>
              )}
              {domainRejection.diagnostics.optical?.contrast_std != null && (
                <div className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#C97958]/40 text-[#292A26]">
                  <span className="text-[#777]">Contrast Std: </span>
                  <span className="font-bold">{domainRejection.diagnostics.optical.contrast_std}</span>
                  <span className="text-[#888]"> (Min: 12.0)</span>
                </div>
              )}
              {domainRejection.diagnostics.optical?.laplacian_variance != null && (
                <div className="px-2.5 py-1 rounded bg-[#FFFFFF] border border-[#C97958]/40 text-[#292A26]">
                  <span className="text-[#777]">Laplacian Var: </span>
                  <span className="font-bold">{domainRejection.diagnostics.optical.laplacian_variance}</span>
                  <span className="text-[#888]"> (Min: 15.0)</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Form / Presets on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Inspection Form & Sample Picker (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {reinspectionContext && (
            <div className="p-4 bg-[rgba(196,154,82,0.12)] border-2 border-[#C49A52] rounded-xl flex items-center justify-between text-xs font-sans shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[10px] uppercase px-2 py-0.5 rounded bg-[#C49A52] text-white">
                    FOLLOW-UP REINSPECTION MODE
                  </span>
                  <span className="font-bold text-[#292A26]">
                    Directly Linked to Failed Inspection #{reinspectionContext.originalInspectionId}
                  </span>
                </div>
                <p className="text-[#77766E] text-xs">
                  Target Component: <strong className="text-[#292A26] font-mono">{reinspectionContext.itemIdentifier}</strong> | Initial Failure: <strong className="text-[#C97958] font-mono">{reinspectionContext.defectType || reinspectionContext.defectCategory || 'Defective'}</strong>
                </p>
              </div>
              {onClearReinspection && (
                <button
                  type="button"
                  onClick={onClearReinspection}
                  className="px-3 py-1.5 rounded-lg border border-[#D8C9AE] bg-[#FFFCF6] text-[#77766E] hover:text-[#292A26] text-xs font-semibold font-sans transition-all cursor-pointer shadow-2xs"
                >
                  Cancel Reinspection
                </button>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="industrial-card p-5 space-y-4 shadow-sm">
            <h2 className="type-card-title text-[#292A26] mb-1 font-semibold">1. Inspection Parameters</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#77766E] uppercase tracking-wider font-sans block mb-1.5">Product Family</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(parseInt(e.target.value))}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] font-medium font-sans min-h-[40px] focus:outline-none focus:border-[#71845B]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#77766E] uppercase tracking-wider font-sans block mb-1.5">Target Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(parseInt(e.target.value))}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] min-h-[40px] focus:outline-none focus:border-[#71845B] font-mono font-medium"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.batch_number} ({b.status})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[#77766E] uppercase tracking-wider font-sans block mb-1.5">Item Serial / Part ID</label>
                <input
                  type="text"
                  required
                  value={itemIdentifier}
                  onChange={e => setItemIdentifier(e.target.value)}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] min-h-[40px] focus:outline-none focus:border-[#71845B] font-mono font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#77766E] uppercase tracking-wider font-sans block mb-1.5">Inspection Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Visual test after shakeout..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs sm:text-sm text-[#292A26] font-sans min-h-[40px] focus:outline-none focus:border-[#71845B]"
                />
              </div>
            </div>

            {/* Upload Zone */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-[#77766E] uppercase tracking-wider font-sans block mb-1.5">
                Component Image Ingestion
              </label>

              <div className="border-2 border-dashed border-[#D8C9AE] hover:border-[#71845B] rounded-xl p-5 text-center bg-[#F0EAE1] transition-colors">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center min-h-[44px] justify-center">
                  <Upload className="w-6 h-6 text-[#71845B] mb-1.5" />
                  <span className="text-sm font-semibold text-[#292A26] font-sans">Click to browse or drop component image</span>
                  <span className="text-xs text-[#77766E] mt-0.5 font-sans">JPEG, PNG, WebP up to 15MB</span>
                </label>
                {selectedFile && (
                  <div className="mt-2 text-xs text-[#71845B] font-mono font-semibold">
                    Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                {selectedPreset && (
                  <div className="mt-2 text-xs text-[#71845B] font-mono font-semibold">
                    Selected preset: {selectedPreset}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-semibold text-xs font-sans transition-colors flex items-center justify-center gap-2 ${
                submitting
                  ? 'bg-[#E2DACB] text-[#77766E] cursor-not-allowed'
                  : 'bg-[#71845B] hover:bg-[#5F704C] text-[#FFFFFF] cursor-pointer shadow-sm active:bg-[#4D5C3D]'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#FFFFFF]" />
                  <span>Executing MobileNetV3 Neural Inference...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Run PyTorch Defect Inference</span>
                </>
              )}
            </button>
          </form>

          {/* Preset Evaluation Samples Gallery - Collapsible */}
          <div className="industrial-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#292A26] font-sans flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#71845B]" />
                  Authentic Steel Surface Test Samples
                </h3>
                <p className="text-xs text-[#77766E] font-sans">12 held-out evaluation images from NEU steel surface defect dataset</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSamples(!showSamples)}
                className="btn-secondary-ivory font-sans text-xs font-medium"
              >
                <span>{showSamples ? 'Collapse' : 'Show Samples'}</span>
                {showSamples ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showSamples && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4 pt-3 border-t border-[#D8C9AE]">
                {evalSamples.map((sample) => {
                  const isSelected = selectedPreset === sample.filename;
                  const isDef = sample.ground_truth === 'DEFECTIVE';

                  return (
                    <div
                      key={sample.filename}
                      onClick={() => handleSelectPreset(sample)}
                      className={`cursor-pointer rounded-xl border p-1.5 text-center transition-all ${
                        isSelected
                          ? 'border-[#71845B] bg-[rgba(113,132,91,0.12)] shadow-xs'
                          : 'border-[#D8C9AE] bg-[#FFFCF6] hover:border-[#B5A58B]'
                      }`}
                    >
                      <img
                        src={`/api/v1/inspections/eval-samples/${sample.filename}`}
                        alt={sample.description}
                        className="w-full h-14 object-cover rounded-lg mb-1 bg-[#F0EAE1]"
                      />
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[10px] font-sans font-semibold uppercase tracking-wider ${isDef ? 'text-[#C97958]' : 'text-[#71845B]'}`}>
                          {sample.ground_truth}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview & Live ML Results (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="industrial-card p-5 shadow-sm">
            <h2 className="type-card-title text-[#292A26] mb-3 font-semibold">2. Neural Inference Telemetry</h2>

            {/* Image Preview Box */}
            <div className="space-y-3">
              <div className="bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl overflow-hidden aspect-square flex items-center justify-center relative">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Inspection Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 text-[#77766E] text-xs font-sans">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50 text-[#71845B]" />
                    No component image selected yet.
                  </div>
                )}
                {submitting && (
                  <div className="absolute inset-0 bg-[#FFFCF6]/85 backdrop-blur-xs flex flex-col items-center justify-center text-[#292A26] text-xs gap-2 font-sans">
                    <RefreshCw className="w-6 h-6 text-[#71845B] animate-spin" />
                    <span className="font-semibold">Evaluating component features...</span>
                  </div>
                )}
              </div>

              {/* Real ML Results Breakdown */}
              {resultInspection && latestInference && (
                <div className="p-4 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl space-y-3.5">
                  {/* Top Status & Subject Signoff */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#D8C9AE]">
                    <div>
                      <span className="text-[11px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">
                        AI Model Suggestion
                      </span>
                      <span className="text-xs font-sans text-[#77766E]">Auditable Neural Inspection</span>
                    </div>
                    <span className={`text-xs font-semibold font-sans uppercase tracking-wider px-3 py-1 rounded-full border ${
                      latestInference.raw_prediction === 'DEFECTIVE'
                        ? 'bg-[rgba(201,121,88,0.12)] text-[#C97958] border-[#C97958]/35'
                        : 'bg-[rgba(113,132,91,0.12)] text-[#5E704B] border-[#71845B]/30'
                    }`}>
                      {latestInference.raw_prediction}
                    </span>
                  </div>

                  {/* Primary Defect Classification Feature Box */}
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    latestInference.raw_prediction === 'DEFECTIVE'
                      ? 'bg-[rgba(201,121,88,0.08)] border-[#C97958]/35'
                      : 'bg-[rgba(113,132,91,0.08)] border-[#71845B]/30'
                  }`}>
                    <div>
                      <span className="text-[10px] text-[#77766E] uppercase font-mono font-bold tracking-wider block">
                        Detected Defect Type
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono font-extrabold text-base tracking-tight text-[#292A26]">
                          {latestInference.defect_type ? latestInference.defect_type.replace('_', ' ') : (latestInference.raw_prediction === 'DEFECTIVE' ? 'SURFACE DEFECT' : 'NORMAL (PRIME)')}
                        </span>
                        <span className={`text-[10px] font-sans px-2 py-0.5 rounded-full font-semibold border ${
                          latestInference.raw_prediction === 'DEFECTIVE'
                            ? 'bg-[#C97958] text-white border-transparent'
                            : 'bg-[#71845B] text-white border-transparent'
                        }`}>
                          {latestInference.raw_prediction}
                        </span>
                      </div>
                      <span className="text-xs text-[#77766E] font-sans mt-0.5 block">
                        {latestInference.defect_display_name || (latestInference.raw_prediction === 'DEFECTIVE' ? 'Detected Surface Flaw' : 'Defect-Free Prime Steel')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-[#77766E] uppercase font-mono block">Certainty</span>
                      <span className="text-lg font-mono font-extrabold text-[#292A26]">
                        {((latestInference.confidence_score || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Traceability Metadata Strip */}
                  <div className="p-2.5 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg flex items-center justify-between text-xs font-sans">
                    <div>
                      <span className="text-[10px] text-[#77766E] uppercase font-semibold block">Serial Trace</span>
                      <span className="font-mono font-bold text-[#292A26] text-xs">{resultInspection.item_identifier}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-[#77766E] uppercase font-semibold block">Target Batch</span>
                      <span className="font-mono font-bold text-[#71845B] text-xs">{resultInspection.batch_number}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
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
                    <div className="p-2 bg-[#FFFCF6] border border-[#D8C9AE] rounded-lg">
                      <span className="text-[10px] text-[#77766E] uppercase font-sans font-semibold tracking-wider block">Neural Backbone</span>
                      <span className="font-mono text-[#77766E] text-xs">
                        {latestInference.model_name}
                      </span>
                    </div>
                  </div>

                  {/* 7-Class Neural Taxonomy Distribution */}
                  {(() => {
                    let parsedProbs: Record<string, number> = {};
                    try {
                      if (typeof latestInference.class_probabilities === 'string') {
                        parsedProbs = JSON.parse(latestInference.class_probabilities);
                      } else if (latestInference.class_probabilities) {
                        parsedProbs = latestInference.class_probabilities as Record<string, number>;
                      }
                    } catch (e) {}

                    const entries = Object.entries(parsedProbs).sort((a, b) => b[1] - a[1]);
                    if (entries.length === 0) return null;

                    return (
                      <div className="p-3 bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl space-y-2 text-xs font-sans">
                        <div className="flex items-center justify-between pb-1 border-b border-[#D8C9AE]/60">
                          <span className="text-[11px] font-mono font-bold uppercase text-[#77766E] tracking-wider">
                            Model Defect Taxonomy Distribution
                          </span>
                          <span className="text-[10px] font-mono text-[#71845B] font-semibold">
                            7-Class Head
                          </span>
                        </div>
                        <div className="space-y-1.5 pt-0.5">
                          {entries.map(([cls, prob]) => {
                            const isWinner = cls === (latestInference.defect_type?.toLowerCase().replace('_', '-') ?? '') || (cls === 'rolled-in_scale' && latestInference.defect_type === 'ROLLED_IN_SCALE');
                            return (
                              <div key={cls} className="space-y-0.5">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className={`capitalize ${isWinner ? 'font-bold text-[#292A26]' : 'text-[#77766E]'}`}>
                                    {cls.replace('_', ' ').replace('-', ' ')}
                                  </span>
                                  <span className={`font-semibold ${isWinner ? 'text-[#C97958] font-bold' : 'text-[#77766E]'}`}>
                                    {(prob * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-[#E8DEC8] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      cls === 'normal'
                                        ? 'bg-[#71845B]'
                                        : isWinner ? 'bg-[#C97958]' : 'bg-[#D8C9AE]'
                                    }`}
                                    style={{ width: `${Math.max(prob * 100, prob > 0 ? 3 : 0)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Grad-CAM Heatmap Preview & Explicit Explainability Disclaimer */}
                  {latestImage?.heatmap_path && (
                    <div className="pt-2 border-t border-[#D8C9AE] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-sans text-[#71845B] font-semibold uppercase tracking-wider">
                          Grad-CAM Defect Localization Heatmap
                        </span>
                        <span className="text-[10px] font-mono text-[#77766E] bg-[#FFFCF6] px-1.5 py-0.5 rounded border border-[#D8C9AE]">
                          LAYER 4 CONV
                        </span>
                      </div>

                      <div className="relative rounded-xl overflow-hidden border border-[#D8C9AE] bg-[#F5F1E8]">
                        <img
                          src={`/api/v1/inspections/images/${latestImage.heatmap_path}`}
                          alt="Grad-CAM Heatmap"
                          className="w-full h-40 object-contain"
                        />
                        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-[#FFFCF6]/90 border border-[#D8C9AE] rounded text-[9px] font-mono font-semibold text-[#71845B]">
                          ATTENTION GRADIENT
                        </div>
                      </div>

                      {/* ATS Inspect Reference Note */}
                      <div className="p-2.5 rounded-lg bg-[#FFFCF6] border border-[#D8C9AE] text-[11px] text-[#77766E] font-sans leading-relaxed">
                        <strong className="text-[#292A26] font-semibold">Explainability Note:</strong> The Grad-CAM heatmap highlights convolutional activation regions where the neural network identified anomalous surface features. It represents <em>model attention focus</em>, not a verified physical defect perimeter.
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => onInspectionCreated(resultInspection.id)}
                      className="flex-1 btn-primary-sage font-sans text-xs font-semibold py-2.5"
                    >
                      <span>Transfer to Human Review Workbench</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRetry}
                      className="btn-secondary-ivory min-h-[40px] min-w-[40px] p-2 flex items-center justify-center cursor-pointer"
                      title="Retry ML inference"
                    >
                      <RefreshCw className="w-4 h-4 text-[#71845B]" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
