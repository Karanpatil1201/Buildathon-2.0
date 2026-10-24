import React, { useState, useEffect } from 'react';
import { Layers, Plus, History, AlertCircle, CheckCircle } from 'lucide-react';
import { Product, Batch, BatchDecision, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';
import { canManageBatches } from '../utils/rbac';

interface ProductsBatchesPageProps {
  currentUser: User | null;
  onRefreshMetrics: () => void;
}

export const ProductsBatchesPage: React.FC<ProductsBatchesPageProps> = ({ currentUser, onRefreshMetrics }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showProductModal, setShowProductModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [decisionHistory, setDecisionHistory] = useState<BatchDecision[]>([]);

  // Form states
  const [newProduct, setNewProduct] = useState({ code: '', name: '', category: 'Hot-Rolled Steel', description: '' });
  const [newBatch, setNewBatch] = useState({ product_id: 0, batch_number: '', quantity: 100 });
  const [decisionForm, setDecisionForm] = useState({ new_status: 'ON_HOLD', reason: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      const [prods, bts] = await Promise.all([api.getProducts(), api.getBatches()]);
      setProducts(prods);
      setBatches(bts);
      if (prods.length > 0 && newBatch.product_id === 0) {
        setNewBatch(prev => ({ ...prev, product_id: prods[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load registry data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await api.createProduct(newProduct);
      setSuccessMsg(`Product ${newProduct.code} registered successfully!`);
      setShowProductModal(false);
      setNewProduct({ code: '', name: '', category: 'Hot-Rolled Steel', description: '' });
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to register product');
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      await api.createBatch(newBatch);
      setSuccessMsg(`Batch ${newBatch.batch_number} created successfully!`);
      setShowBatchModal(false);
      setNewBatch({ product_id: products[0]?.id || 0, batch_number: '', quantity: 100 });
      loadData();
      onRefreshMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to create batch');
    }
  };

  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      setError(null);
      await api.recordBatchDecision(selectedBatch.id, decisionForm.new_status, decisionForm.reason);
      setSuccessMsg(`Batch ${selectedBatch.batch_number} updated to ${decisionForm.new_status}!`);
      setShowDecisionModal(false);
      setDecisionForm({ new_status: 'ON_HOLD', reason: '' });
      loadData();
      onRefreshMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to record batch decision');
    }
  };

  const handleOpenHistory = async (batch: Batch) => {
    setSelectedBatch(batch);
    try {
      const hist = await api.getBatchDecisions(batch.id);
      setDecisionHistory(hist);
      setShowHistoryModal(true);
    } catch (err: any) {
      setError('Could not retrieve decision history');
    }
  };

  const canAuthorize = canManageBatches(currentUser);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wide">
              BATCH GOVERNANCE // LOT TRACEABILITY
            </span>
            <span className="text-xs text-[#77766E] font-sans">Quarantine & Release Authorizations</span>
          </div>
          <h1 className="type-page-title flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-[#71845B] shrink-0" />
            Products & Production Batches Registry
          </h1>
          <p className="text-xs sm:text-sm text-[#77766E] mt-1 font-sans leading-relaxed">
            Maintain product catalog and manage batch-level quality quarantine and release authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProductModal(true)}
            className="btn-secondary-ivory font-sans text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 text-[#71845B]" />
            <span>Add Product</span>
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="btn-primary-sage font-sans text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Batch</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/40 rounded-xl text-[#C97958] text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C97958] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#C97958] hover:opacity-80 font-bold cursor-pointer">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-[rgba(113,132,91,0.12)] border border-[#71845B]/40 rounded-xl text-[#5E704B] text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#71845B] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#71845B] hover:opacity-80 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Batches Table */}
      <div className="industrial-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans">Active Production Batches</h2>
            <p className="text-xs text-[#77766E] font-sans">Formal batch status is independent of individual item results</p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#77766E]">
            {batches.length} registered batches
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#D8C9AE] text-[#77766E] uppercase font-sans text-[11px] font-semibold tracking-wider bg-[#F0EAE1]/60">
                <th className="py-2.5 px-3">Batch Number</th>
                <th className="py-2.5 px-3">Product</th>
                <th className="py-2.5 px-3">Quantity</th>
                <th className="py-2.5 px-3">Inspections</th>
                <th className="py-2.5 px-3">Defects</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Quality Disposition</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8C9AE]/50">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-[#F0EAE1]/70 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-xs text-[#292A26]">
                    {b.batch_number}
                  </td>
                  <td className="py-3 px-3 text-[#292A26] font-sans">
                    <div className="font-semibold text-xs sm:text-sm">{b.product_name}</div>
                    <div className="text-xs font-mono text-[#77766E]">{b.product_code}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-xs tabular-nums text-[#292A26]">
                    {b.quantity} units
                  </td>
                  <td className="py-3 px-3 font-mono text-xs tabular-nums text-[#292A26]">
                    {b.total_inspections} items
                  </td>
                  <td className="py-3 px-3 font-mono text-xs tabular-nums">
                    <span className={b.defect_count > 0 ? 'text-[#C97958] font-semibold' : 'text-[#77766E]'}>
                      {b.defect_count}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={b.status} size="sm" />
                  </td>
                  <td className="py-3 px-3 text-[#77766E] font-sans max-w-xs truncate text-xs">
                    {b.decision_notes || 'Pending quality audit'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2 font-sans">
                      <button
                        onClick={() => {
                          setSelectedBatch(b);
                          setDecisionForm({ new_status: b.status, reason: '' });
                          setShowDecisionModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#FFFCF6] hover:bg-[#F0EAE1] border border-[#D8C9AE] text-[#71845B] text-xs font-semibold cursor-pointer transition-colors"
                        title={canAuthorize ? "Execute batch quality disposition" : "Quality Manager authority required (batch:quarantine / batch:release)"}
                      >
                        Disposition
                      </button>
                      <button
                        onClick={() => handleOpenHistory(b)}
                        className="p-1.5 rounded-lg text-[#77766E] hover:text-[#292A26] hover:bg-[#F0EAE1] cursor-pointer transition-colors"
                        title="View decision history"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Products Catalog Card */}
      <div className="industrial-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#292A26] font-sans mb-1">Product Family Catalog</h2>
        <p className="text-xs text-[#77766E] font-sans mb-4">Inspected component models and metallurgy classes</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {products.map((p) => (
            <div key={p.id} className="p-3.5 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl font-sans">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-semibold text-[#71845B]">{p.code}</span>
                <span className="text-xs text-[#77766E]">{p.category}</span>
              </div>
              <h3 className="text-xs sm:text-sm font-semibold text-[#292A26]">{p.name}</h3>
              <p className="text-xs text-[#77766E] mt-1 line-clamp-2 leading-relaxed">{p.description || 'No description provided.'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Register Product */}
      {showProductModal && (
        <div className="fixed inset-0 bg-[#292A26]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card industrial-modal-shadow w-full max-w-md p-6 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl">
            <h3 className="text-base font-bold text-[#292A26] mb-1">Add New Product Family</h3>
            <p className="text-xs text-[#77766E] mb-4">Define a component identifier for quality tracking</p>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Product Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAST-ROTOR-04"
                  value={newProduct.code}
                  onChange={e => setNewProduct({ ...newProduct, code: e.target.value })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B] font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ductile Iron Turbine Housing"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                />
              </div>
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Category / Metallurgy</label>
                <input
                  type="text"
                  required
                  value={newProduct.category}
                  onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                />
              </div>
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Description / Spec</label>
                <textarea
                  rows={2}
                  value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[#D8C9AE]">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="btn-secondary-ivory text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-sage text-xs font-bold"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register Batch */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-[#292A26]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card industrial-modal-shadow w-full max-w-md p-6 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl">
            <h3 className="text-base font-bold text-[#292A26] mb-1">Register New Production Batch</h3>
            <p className="text-xs text-[#77766E] mb-4">Initialize tracking for a newly cast lot</p>
            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Select Product</label>
                <select
                  value={newBatch.product_id}
                  onChange={e => setNewBatch({ ...newBatch, product_id: parseInt(e.target.value) })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B-2026-112"
                  value={newBatch.batch_number}
                  onChange={e => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B] font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Batch Size (Units)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newBatch.quantity}
                  onChange={e => setNewBatch({ ...newBatch, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B] font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[#D8C9AE]">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="btn-secondary-ivory text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-sage text-xs font-bold"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Batch Disposition (Hold / Release Decision) */}
      {showDecisionModal && selectedBatch && (
        <div className="fixed inset-0 bg-[#292A26]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card industrial-modal-shadow w-full max-w-lg p-6 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-[#292A26]">Batch Quality Disposition</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/40 font-bold">
                {selectedBatch.batch_number}
              </span>
            </div>
            <p className="text-xs text-[#77766E] mb-4">
              Authorized release or hold quarantine decision. Requires Quality Manager authorization.
            </p>

            {!canAuthorize && (
              <div className="p-3 bg-[rgba(196,154,82,0.12)] border border-[#C49A52]/40 rounded-xl text-[#A07834] text-xs mb-4">
                <strong>Authorization Notice</strong>: Your current persona is <code>{currentUser?.role}</code>. Batch disposition requires Quality Manager authority (<code>batch:quarantine</code> / <code>batch:release</code>). System Administrator and Production roles cannot release or hold lots without quality governance delegation. Switch to Elena Vance in the top navbar to execute this authorization.
              </div>
            )}

            <form onSubmit={handleRecordDecision} className="space-y-4">
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">New Batch Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'ON_HOLD', label: 'Quarantine (ON HOLD)' },
                    { id: 'RELEASED', label: 'Authorized (RELEASED)' },
                    { id: 'REJECTED', label: 'Scrap (REJECTED)' },
                    { id: 'IN_PROGRESS', label: 'Production (IN PROGRESS)' }
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setDecisionForm({ ...decisionForm, new_status: st.id })}
                      className={`min-h-[40px] p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                        decisionForm.new_status === st.id
                          ? 'bg-[rgba(113,132,91,0.15)] border-[#71845B] text-[#292A26]'
                          : 'bg-[#FFFCF6] border-[#D8C9AE] text-[#77766E] hover:border-[#B5A58B]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">
                  Formal Justification & Audit Notes (Mandatory)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State engineering reasons, ASTM standard compliance, defect mitigation results, or quarantine rationale..."
                  value={decisionForm.reason}
                  onChange={e => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#D8C9AE]">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="btn-secondary-ivory text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canAuthorize}
                  className={`min-h-[40px] px-5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    canAuthorize
                      ? 'btn-primary-sage cursor-pointer'
                      : 'bg-[#E2DACB] text-[#77766E] cursor-not-allowed opacity-60'
                  }`}
                >
                  Commit Batch Disposition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Decision History */}
      {showHistoryModal && selectedBatch && (
        <div className="fixed inset-0 bg-[#292A26]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card industrial-modal-shadow w-full max-w-lg p-6 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-[#292A26]">Batch Disposition Audit Trail</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/40 font-bold">
                {selectedBatch.batch_number}
              </span>
            </div>
            <p className="text-xs text-[#77766E] mb-4">Complete chronological log of hold/release decisions</p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {decisionHistory.length === 0 ? (
                <div className="text-center py-6 text-[#77766E] text-xs">
                  No historical decisions recorded for this batch.
                </div>
              ) : (
                decisionHistory.map((d) => (
                  <div key={d.id} className="p-3 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={d.new_status} size="sm" />
                        <span className="text-[#77766E] text-[10px]">from {d.previous_status}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#77766E]">
                        {new Date(d.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#292A26] pt-1">{d.reason}</p>
                    <div className="text-[10px] text-[#71845B] font-mono font-semibold">
                      Decided by: {d.decided_by_name || 'Authorized Quality Manager'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#D8C9AE] mt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="btn-secondary-ivory font-mono text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
