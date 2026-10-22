import React, { useState, useEffect } from 'react';
import { Camera, Upload, Cpu, RefreshCw, ArrowRight, Image as ImageIcon, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { Product, Batch, EvalSample, Inspection } from '../types';
import { api } from '../api/client';

interface NewInspectionPageProps {
  onInspectionCreated: (inspectionId: number) => void;
}

export const NewInspectionPage: React.FC<NewInspectionPageProps> = ({ onInspectionCreated }) => {
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

        // Auto-generate realistic item ID
        const randId = Math.floor(1000 + Math.random() * 9000);
        setItemIdentifier(`ITEM-${randId}`);
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

      if (selectedPreset) {
        formData.append('sample_preset', selectedPreset);
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const created = await api.createInspection(formData);
      setResultInspection(created);
    } catch (err: any) {
      setError(err.message || 'Inspection inference failed');
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
    <div className="space-y-6">
      {/* Header & Domain Disclosure */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-[#004A77]/40 text-[#C2E7FF] border border-[#A8C7FA]/40">
            INSPECTION INTAKE // SENSOR ACTIVE
          </span>
          <span className="text-xs text-[#8E918F] font-mono">Real-Time PyTorch Inference</span>
        </div>
        <h1 className="text-xl font-bold text-[#E3E3E3] tracking-tight flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#A8C7FA]" />
          Optical Surface Inspection & Defect Analysis
        </h1>
        <p className="text-xs text-[#C4C7C5] mt-1">
          Ingest component imagery to run live PyTorch MobileNetV3 defect classification and generate Grad-CAM heatmaps.
        </p>
      </div>

      {/* Model Domain Notice */}
      <div className="p-3.5 bg-[rgba(253,214,99,0.12)] border border-[#FDD663]/30 rounded-xl text-xs text-[#FDD663] flex items-center gap-2.5">
        <span className="font-mono font-medium text-[#3F2E00] uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#FDD663]">
          DOMAIN NOTICE
        </span>
        <span className="text-[#E3E3E3]">
          Current model checkpoint is baseline trained on industrial castings (v1.0). Ceramic-tile transfer fine-tuning dataset integration is in active development.
        </span>
      </div>

      {error && (
        <div className="p-3.5 bg-[rgba(242,139,130,0.12)] border border-[#F28B82]/35 rounded-xl text-[#F6AEA9] text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-[#F28B82] min-h-[44px] min-w-[44px] flex items-center justify-center font-bold">✕</button>
        </div>
      )}

      {/* Main Grid: Form / Presets on Left, Results on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Inspection Form & Sample Picker (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="industrial-card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[#E3E3E3] mb-2">1. Inspection Parameters</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#C4C7C5] font-medium block mb-1">Product Family</label>
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(parseInt(e.target.value))}
                  className="w-full bg-[#202124] border border-[#3C4043] rounded-xl px-3 py-2.5 text-xs text-[#E3E3E3] min-h-[44px] focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-[#C4C7C5] font-medium block mb-1">Target Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={e => setSelectedBatchId(parseInt(e.target.value))}
                  className="w-full bg-[#202124] border border-[#3C4043] rounded-xl px-3 py-2.5 text-xs text-[#E3E3E3] min-h-[44px] focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA] font-mono"
                >
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.batch_number} ({b.status})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#C4C7C5] font-medium block mb-1">Item Serial / Part ID</label>
                <input
                  type="text"
                  required
                  value={itemIdentifier}
                  onChange={e => setItemIdentifier(e.target.value)}
                  className="w-full bg-[#202124] border border-[#3C4043] rounded-xl px-3 py-2.5 text-xs text-[#E3E3E3] min-h-[44px] focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA] font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-[#C4C7C5] font-medium block mb-1">Inspection Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Visual test after shakeout..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-[#202124] border border-[#3C4043] rounded-xl px-3 py-2.5 text-xs text-[#E3E3E3] min-h-[44px] focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>
            </div>

            {/* Upload Zone */}
            <div className="pt-2">
              <label className="text-xs text-[#C4C7C5] font-medium block mb-1.5">
                Component Image Ingestion
              </label>

              <div className="border-2 border-dashed border-[#3C4043] hover:border-[#A8C7FA] rounded-xl p-5 text-center bg-[#202124] transition-colors">
                <input
                  type="file"
                  id="image-upload"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center min-h-[44px] justify-center">
                  <Upload className="w-6 h-6 text-[#A8C7FA] mb-1.5" />
                  <span className="text-xs font-semibold text-[#E3E3E3]">Click to browse or drop casting image</span>
                  <span className="text-[10px] text-[#8E918F] mt-0.5">JPEG, PNG, WebP up to 15MB</span>
                </label>
                {selectedFile && (
                  <div className="mt-2 text-xs text-[#A8C7FA] font-mono">
                    Selected file: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                {selectedPreset && (
                  <div className="mt-2 text-xs text-[#A8C7FA] font-mono">
                    Selected preset: {selectedPreset}
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full min-h-[44px] py-2.5 px-4 rounded-xl font-semibold text-xs transition-colors flex items-center justify-center gap-2 ${
                submitting
                  ? 'bg-[#303134] text-[#8E918F] cursor-not-allowed'
                  : 'bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] cursor-pointer shadow-sm active:bg-[#8AB4F8]'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#041E49]" />
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
          <div className="industrial-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#E3E3E3] flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#A8C7FA]" />
                  Authentic Casting Test Samples
                </h3>
                <p className="text-xs text-[#8E918F]">12 held-out evaluation images from industrial casting dataset</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSamples(!showSamples)}
                className="min-h-[44px] px-3.5 py-1.5 rounded-xl border border-[#3C4043] bg-[#303134] hover:bg-[#35373A] text-xs text-[#E3E3E3] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>{showSamples ? 'Collapse' : 'Show Samples'}</span>
                {showSamples ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showSamples && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-4 pt-3 border-t border-[#3C4043]">
                {evalSamples.map((sample) => {
                  const isSelected = selectedPreset === sample.filename;
                  const isDef = sample.ground_truth === 'DEFECTIVE';

                  return (
                    <div
                      key={sample.filename}
                      onClick={() => handleSelectPreset(sample)}
                      className={`cursor-pointer rounded-xl border p-1.5 text-center transition-all ${
                        isSelected
                          ? 'border-[#A8C7FA] bg-[#004A77]/30 shadow-sm'
                          : 'border-[#3C4043] bg-[#202124] hover:border-[#5F6368]'
                      }`}
                    >
                      <img
                        src={`/api/v1/inspections/eval-samples/${sample.filename}`}
                        alt={sample.description}
                        className="w-full h-14 object-cover rounded-lg mb-1 bg-[#131314]"
                      />
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[9px] font-mono font-bold ${isDef ? 'text-[#F28B82]' : 'text-[#81C995]'}`}>
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
        <div className="lg:col-span-5 space-y-6">
          <div className="industrial-card p-5">
            <h2 className="text-sm font-semibold text-[#E3E3E3] mb-3">2. Neural Inference Telemetry</h2>

            {/* Image Preview Box */}
            <div className="space-y-3">
              <div className="bg-[#131314] border border-[#3C4043] rounded-xl overflow-hidden aspect-square flex items-center justify-center relative">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Inspection Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 text-[#8E918F] text-xs">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#A8C7FA]" />
                    No component image selected yet.
                  </div>
                )}
                {submitting && (
                  <div className="absolute inset-0 bg-[#131314]/85 backdrop-blur-sm flex flex-col items-center justify-center text-[#E3E3E3] text-xs gap-2">
                    <RefreshCw className="w-6 h-6 text-[#A8C7FA] animate-spin" />
                    <span className="font-semibold">Evaluating casting features...</span>
                  </div>
                )}
              </div>

              {/* Real ML Results Breakdown */}
              {resultInspection && latestInference && (
                <div className="p-4 bg-[#202124] border border-[#3C4043] rounded-xl space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-[#3C4043]">
                    <span className="text-xs text-[#C4C7C5]">Prediction Outcome</span>
                    <span className={`text-sm font-bold font-mono px-2.5 py-0.5 rounded-full border ${
                      latestInference.raw_prediction === 'DEFECTIVE'
                        ? 'bg-[rgba(242,139,130,0.15)] text-[#F28B82] border-[#F28B82]/35'
                        : 'bg-[rgba(129,201,149,0.15)] text-[#81C995] border-[#81C995]/30'
                    }`}>
                      {latestInference.raw_prediction}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
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
                      <span className="text-[10px] text-[#8E918F] block">Execution Latency</span>
                      <span className="font-mono text-[#C4C7C5]">
                        {latestInference.inference_duration_ms.toFixed(1)} ms
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8E918F] block">Model Engine</span>
                      <span className="font-mono text-[#C4C7C5] text-[10px]">
                        {latestInference.model_name}
                      </span>
                    </div>
                  </div>

                  {/* Grad-CAM Heatmap Preview if available */}
                  {latestImage?.heatmap_path && (
                    <div className="pt-2 border-t border-[#3C4043]">
                      <span className="text-[10px] font-mono text-[#A8C7FA] block mb-1">
                        GRAD-CAM DEFECT LOCALIZATION HEATMAP
                      </span>
                      <img
                        src={`/api/v1/inspections/images/${latestImage.heatmap_path}`}
                        alt="Grad-CAM Heatmap"
                        className="w-full h-36 object-contain rounded-xl border border-[#3C4043] bg-black"
                      />
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => onInspectionCreated(resultInspection.id)}
                      className="flex-1 min-h-[44px] py-2 px-3 rounded-xl bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <span>Proceed to Human Review</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleRetry}
                      className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] flex items-center justify-center cursor-pointer transition-colors"
                      title="Retry ML inference"
                    >
                      <RefreshCw className="w-4 h-4" />
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
