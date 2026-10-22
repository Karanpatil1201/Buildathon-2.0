import React, { useState, useEffect } from 'react';
import { Layers, Plus, History, AlertCircle, CheckCircle } from 'lucide-react';
import { Product, Batch, BatchDecision, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';

interface ProductsBatchesPageProps {
  currentUser: User | null;
  onRefreshMetrics: () => void;
}

export const ProductsBatchesPage: React.FC<ProductsBatchesPageProps> = ({ currentUser, onRefreshMetrics }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [newProduct, setNewProduct] = useState({ code: '', name: '', category: 'Metal Castings', description: '' });
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
      setNewProduct({ code: '', name: '', category: 'Metal Castings', description: '' });
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

  const isQualityManagerOrAdmin = currentUser?.role === 'quality_manager' || currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#A8C7FA]" />
            Products & Batches Registry
          </h1>
          <p className="text-xs text-[#9AA0A6] mt-1">
            Maintain product catalog and manage batch-level quality quarantine and release authorizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProductModal(true)}
            className="flex items-center gap-1.5 bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs font-semibold px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-[#A8C7FA]" />
            <span>Add Product</span>
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Batch</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-[#F28B82]/10 border border-[#F28B82]/40 rounded-xl text-[#F28B82] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#F28B82] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#F28B82] hover:opacity-80">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-[#81C995]/10 border border-[#81C995]/40 rounded-xl text-[#81C995] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#81C995] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#81C995] hover:opacity-80">✕</button>
        </div>
      )}

      {/* Batches Table */}
      <div className="sky-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Active Production Batches</h2>
            <p className="text-xs text-[#9AA0A6]">Formal batch status is independent of individual item results</p>
          </div>
          <div className="text-xs font-mono text-[#9AA0A6]">
            {batches.length} registered batches
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#3C4043] text-[#9AA0A6] uppercase font-mono text-[11px]">
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
            <tbody className="divide-y divide-[#3C4043]/50">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-[#282A2C] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-white">
                    {b.batch_number}
                  </td>
                  <td className="py-3 px-3 text-[#E3E3E3]">
                    <div className="font-semibold">{b.product_name}</div>
                    <div className="text-[10px] font-mono text-[#9AA0A6]">{b.product_code}</div>
                  </td>
                  <td className="py-3 px-3 font-mono text-[#E3E3E3]">
                    {b.quantity} units
                  </td>
                  <td className="py-3 px-3 font-mono text-[#E3E3E3]">
                    {b.total_inspections} items
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className={b.defect_count > 0 ? 'text-[#F28B82] font-bold' : 'text-[#9AA0A6]'}>
                      {b.defect_count}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={b.status} size="sm" />
                  </td>
                  <td className="py-3 px-3 text-[#9AA0A6] max-w-xs truncate">
                    {b.decision_notes || 'Pending quality audit'}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedBatch(b);
                          setDecisionForm({ new_status: b.status, reason: '' });
                          setShowDecisionModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#A8C7FA] text-xs font-semibold cursor-pointer transition-colors"
                        title={isQualityManagerOrAdmin ? "Change batch status" : "Quality Manager role required"}
                      >
                        Disposition
                      </button>
                      <button
                        onClick={() => handleOpenHistory(b)}
                        className="p-1.5 rounded-lg text-[#9AA0A6] hover:text-white hover:bg-[#303134] cursor-pointer transition-colors"
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
      <div className="sky-card p-5">
        <h2 className="text-sm font-bold text-white mb-1">Product Family Catalog</h2>
        <p className="text-xs text-[#9AA0A6] mb-4">Inspected component models and metallurgy classes</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {products.map((p) => (
            <div key={p.id} className="p-3.5 bg-[#202124] border border-[#3C4043] rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-[#A8C7FA]">{p.code}</span>
                <span className="text-[10px] text-[#9AA0A6] font-mono">{p.category}</span>
              </div>
              <h3 className="text-xs font-bold text-white">{p.name}</h3>
              <p className="text-[11px] text-[#9AA0A6] mt-1 line-clamp-2">{p.description || 'No description provided.'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Register Product */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sky-card industrial-modal-shadow w-full max-w-md p-6 bg-[#202124] border border-[#3C4043] rounded-2xl">
            <h3 className="text-base font-bold text-white mb-1">Add New Product Family</h3>
            <p className="text-xs text-[#9AA0A6] mb-4">Define a component identifier for quality tracking</p>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Product Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CAST-ROTOR-04"
                  value={newProduct.code}
                  onChange={e => setNewProduct({ ...newProduct, code: e.target.value })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA] font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ductile Iron Turbine Housing"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Category / Metallurgy</label>
                <input
                  type="text"
                  required
                  value={newProduct.category}
                  onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Description / Spec</label>
                <textarea
                  rows={2}
                  value={newProduct.description}
                  onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sky-card industrial-modal-shadow w-full max-w-md p-6 bg-[#202124] border border-[#3C4043] rounded-2xl">
            <h3 className="text-base font-bold text-white mb-1">Register New Production Batch</h3>
            <p className="text-xs text-[#9AA0A6] mb-4">Initialize tracking for a newly cast lot</p>
            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Select Product</label>
                <select
                  value={newBatch.product_id}
                  onChange={e => setNewBatch({ ...newBatch, product_id: parseInt(e.target.value) })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id} className="bg-[#202124] text-white">{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. B-2026-112"
                  value={newBatch.batch_number}
                  onChange={e => setNewBatch({ ...newBatch, batch_number: e.target.value })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA] font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Batch Size (Units)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newBatch.quantity}
                  onChange={e => setNewBatch({ ...newBatch, quantity: parseInt(e.target.value) || 0 })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA] font-mono"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] text-xs font-bold transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sky-card industrial-modal-shadow w-full max-w-lg p-6 bg-[#202124] border border-[#3C4043] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white">Batch Quality Disposition</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40 font-bold">
                {selectedBatch.batch_number}
              </span>
            </div>
            <p className="text-xs text-[#9AA0A6] mb-4">
              Authorized release or hold quarantine decision. Requires Quality Manager or Administrator role.
            </p>

            {!isQualityManagerOrAdmin && (
              <div className="p-3 bg-[#FDD663]/10 border border-[#FDD663]/40 rounded-xl text-[#FDD663] text-xs mb-4">
                <strong>Authorization Notice</strong>: Your current role is <code>{currentUser?.role}</code>. Batch disposition requires Quality Manager or Administrator privileges. Switch to Elena Vance in the top navbar to execute this authorization.
              </div>
            )}

            <form onSubmit={handleRecordDecision} className="space-y-4">
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">New Batch Status</label>
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
                      className={`min-h-[44px] p-2.5 rounded-xl border text-xs font-semibold text-left transition-colors cursor-pointer ${
                        decisionForm.new_status === st.id
                          ? 'bg-[#004A77] border-[#A8C7FA] text-[#C2E7FF]'
                          : 'bg-[#1E1F20] border-[#3C4043] text-[#9AA0A6] hover:border-[#5F6368] hover:text-[#E3E3E3]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">
                  Formal Justification & Audit Notes (Mandatory)
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="State engineering reasons, ASTM standard compliance, defect mitigation results, or quarantine rationale..."
                  value={decisionForm.reason}
                  onChange={e => setDecisionForm({ ...decisionForm, reason: e.target.value })}
                  className="w-full bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => setShowDecisionModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isQualityManagerOrAdmin}
                  className={`min-h-[44px] px-5 py-2 rounded-xl text-xs font-bold transition-colors ${
                    isQualityManagerOrAdmin
                      ? 'bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] cursor-pointer'
                      : 'bg-[#303134] text-[#9AA0A6] cursor-not-allowed opacity-60'
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sky-card industrial-modal-shadow w-full max-w-lg p-6 bg-[#202124] border border-[#3C4043] rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-white">Batch Disposition Audit Trail</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40 font-bold">
                {selectedBatch.batch_number}
              </span>
            </div>
            <p className="text-xs text-[#9AA0A6] mb-4">Complete chronological log of hold/release decisions</p>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {decisionHistory.length === 0 ? (
                <div className="text-center py-6 text-[#9AA0A6] text-xs">
                  No historical decisions recorded for this batch.
                </div>
              ) : (
                decisionHistory.map((d) => (
                  <div key={d.id} className="p-3 bg-[#1E1F20] border border-[#3C4043] rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={d.new_status} size="sm" />
                        <span className="text-[#9AA0A6] text-[10px]">from {d.previous_status}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#9AA0A6]">
                        {new Date(d.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[#E3E3E3] pt-1">{d.reason}</p>
                    <div className="text-[10px] text-[#A8C7FA] font-mono">
                      Decided by: {d.decided_by_name || 'Authorized Quality Manager'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-[#3C4043] mt-4">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs font-semibold transition-colors cursor-pointer"
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
