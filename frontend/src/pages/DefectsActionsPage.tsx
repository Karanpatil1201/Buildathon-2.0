import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { ConfirmedDefect, CorrectiveAction, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';

interface DefectsActionsPageProps {
  currentUser: User | null;
  targetDefectId?: number | null;
  onStartReinspection: (originalInspectionId: number, productId: number, batchId: number, itemIdentifier: string) => void;
  onRefreshMetrics: () => void;
}

export const DefectsActionsPage: React.FC<DefectsActionsPageProps> = ({
  currentUser,
  targetDefectId,
  onStartReinspection,
  onRefreshMetrics
}) => {
  const [defects, setDefects] = useState<ConfirmedDefect[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  // Action Modal State
  const [showCreateActionModal, setShowCreateActionModal] = useState(false);
  const [selectedDefectForAction, setSelectedDefectForAction] = useState<ConfirmedDefect | null>(null);
  const [newAction, setNewAction] = useState({
    title: '',
    description: '',
    assigned_to_user_id: 0,
    target_date: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [defs, acts, usrs] = await Promise.all([
        api.getDefects(statusFilter === 'ALL' ? undefined : statusFilter),
        api.getActions(undefined, undefined, overdueOnly),
        api.getUsers()
      ]);
      setDefects(defs);
      setActions(acts);
      setUsers(usrs);

      if (usrs.length > 0 && newAction.assigned_to_user_id === 0) {
        setNewAction(prev => ({ ...prev, assigned_to_user_id: usrs[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load defect and action data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, overdueOnly]);

  const handleOpenActionModal = (defect: ConfirmedDefect) => {
    setSelectedDefectForAction(defect);
    // Set default target date: 3 days in future
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setNewAction({
      title: `Remediate ${defect.defect_category} on ${defect.defect_code}`,
      description: 'Implement containment and process parameters recalibration.',
      assigned_to_user_id: users.find(u => u.role === 'supervisor')?.id || users[0]?.id || 1,
      target_date: d.toISOString().split('T')[0]
    });
    setShowCreateActionModal(true);
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDefectForAction) return;

    try {
      setError(null);
      await api.createAction({
        defect_id: selectedDefectForAction.id,
        title: newAction.title,
        description: newAction.description,
        assigned_to_user_id: newAction.assigned_to_user_id,
        target_date: new Date(newAction.target_date).toISOString()
      });
      setSuccessMsg(`Corrective action created for defect ${selectedDefectForAction.defect_code}!`);
      setShowCreateActionModal(false);
      loadData();
      onRefreshMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to create corrective action');
    }
  };

  const handleUpdateActionStatus = async (actionId: number, newStatus: string) => {
    try {
      setError(null);
      await api.updateAction(actionId, { status: newStatus });
      setSuccessMsg(`Action status updated to ${newStatus}`);
      loadData();
      onRefreshMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to update action');
    }
  };

  const handleCloseOrReopenDefect = async (defectId: number, currentStatus: string) => {
    try {
      setError(null);
      const newStatus = currentStatus === 'RESOLVED' ? 'REOPENED' : 'RESOLVED';
      await api.updateDefect(defectId, { review_status: newStatus });
      setSuccessMsg(`Defect status updated to ${newStatus}`);
      loadData();
      onRefreshMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to update defect');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40">
              STATION 04
            </span>
            <span className="text-xs text-[#9AA0A6]">Remediation & Closed-Loop Verification</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F28B82]" />
            Confirmed Defects & Corrective Action (CAPA) Lifecycle
          </h1>
          <p className="text-xs text-[#9AA0A6] mt-1">
            Assign remedial tasks, monitor SLA deadlines, track resolution, and execute follow-up reinspection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              overdueOnly
                ? 'bg-[#F28B82]/20 text-[#F28B82] border-[#F28B82]'
                : 'bg-[#1E1F20] text-[#9AA0A6] border-[#3C4043] hover:text-white hover:bg-[#303134]'
            }`}
          >
            {overdueOnly ? 'Showing Overdue Only' : 'Filter Overdue Actions'}
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
          <button onClick={() => setError(null)} className="text-[#F28B82] min-h-[44px] min-w-[44px] flex items-center justify-center hover:opacity-80">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-[#81C995]/10 border border-[#81C995]/40 rounded-xl text-[#81C995] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#81C995] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#81C995] min-h-[44px] min-w-[44px] flex items-center justify-center hover:opacity-80">✕</button>
        </div>
      )}

      {/* Confirmed Defects Table */}
      <div className="sky-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Confirmed Defects Log</h2>
            <p className="text-xs text-[#9AA0A6]">Human-verified defects with root causes and corrective actions</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'OPEN', 'ACTION_ASSIGNED', 'IN_REMEDIATION', 'RESOLVED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#004A77] text-[#C2E7FF] border-[#A8C7FA]/50'
                    : 'bg-[#202124] text-[#9AA0A6] border-[#3C4043] hover:text-white hover:bg-[#303134]'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#3C4043] text-[#9AA0A6] uppercase font-mono text-[11px]">
                <th className="py-2.5 px-3">Defect Code</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Batch & Product</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Linked Actions</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3C4043]/50">
              {defects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#9AA0A6] text-xs">
                    No confirmed defects matching current filters.
                  </td>
                </tr>
              ) : (
                defects.map((def) => (
                  <tr key={def.id} className="hover:bg-[#282A2C] transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-white">
                      {def.defect_code}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-[#F28B82]">
                      {def.defect_category}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={def.severity} size="sm" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono text-[#E3E3E3]">{def.batch_number}</div>
                      <div className="text-[10px] text-[#9AA0A6]">{def.product_name}</div>
                    </td>
                    <td className="py-3 px-3 text-[#E3E3E3] max-w-xs truncate">
                      {def.description}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={def.review_status} size="sm" />
                    </td>
                    <td className="py-3 px-3">
                      {def.corrective_actions.length > 0 ? (
                        <div className="space-y-1">
                          {def.corrective_actions.map(act => (
                            <div key={act.id} className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span className="text-[#A8C7FA]">{act.action_code}</span>
                              <StatusBadge status={act.status} size="sm" />
                              {act.is_overdue && (
                                <span className="text-[9px] px-1 rounded bg-[#F28B82]/20 text-[#F28B82] border border-[#F28B82]/40 font-bold">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#9AA0A6]">None assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenActionModal(def)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#A8C7FA] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          + CAPA
                        </button>
                        <button
                          onClick={() => handleCloseOrReopenDefect(def.id, def.review_status)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#202124] hover:bg-[#303134] border border-[#3C4043] text-[#E3E3E3] text-xs cursor-pointer transition-colors"
                        >
                          {def.review_status === 'RESOLVED' ? 'Reopen' : 'Close'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Corrective Actions Table */}
      <div className="sky-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Corrective Actions (CAPA) Roster</h2>
            <p className="text-xs text-[#9AA0A6]">Remedial engineering tasks assigned to production and tooling owners</p>
          </div>
          <span className="text-xs font-mono text-[#9AA0A6]">{actions.length} action items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#3C4043] text-[#9AA0A6] uppercase font-mono text-[11px]">
                <th className="py-2.5 px-3">CAPA Code</th>
                <th className="py-2.5 px-3">Linked Defect</th>
                <th className="py-2.5 px-3">Remedial Title</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3">Target Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3C4043]/50">
              {actions.map((act) => (
                <tr key={act.id} className="hover:bg-[#282A2C] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-white">
                    {act.action_code}
                  </td>
                  <td className="py-3 px-3 font-mono text-[#F28B82]">
                    {act.defect_code}
                  </td>
                  <td className="py-3 px-3 text-[#E3E3E3]">
                    <div className="font-semibold">{act.title}</div>
                    <div className="text-[10px] text-[#9AA0A6]">{act.description}</div>
                  </td>
                  <td className="py-3 px-3 text-[#E3E3E3]">
                    {act.assigned_to_name || 'John Davis'}
                  </td>
                  <td className="py-3 px-3 font-mono">
                    <span className={act.is_overdue ? 'text-[#F28B82] font-bold' : 'text-[#E3E3E3]'}>
                      {new Date(act.target_date).toLocaleDateString()}
                    </span>
                    {act.is_overdue && (
                      <span className="block text-[9px] text-[#F28B82] font-bold">OVERDUE</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={act.status} size="sm" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {act.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateActionStatus(act.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#004A77] hover:bg-[#004A77]/80 border border-[#A8C7FA]/40 text-[#C2E7FF] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {act.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdateActionStatus(act.id, 'COMPLETED')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#81C995]/20 hover:bg-[#81C995]/30 border border-[#81C995]/40 text-[#81C995] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Complete
                        </button>
                      )}
                      {act.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleUpdateActionStatus(act.id, 'VERIFIED')}
                          className="px-2.5 py-1.5 rounded-lg bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] text-xs font-bold cursor-pointer transition-colors"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Corrective Action */}
      {showCreateActionModal && selectedDefectForAction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="sky-card industrial-modal-shadow w-full max-w-md p-6 bg-[#202124] border border-[#3C4043] rounded-2xl">
            <h3 className="text-base font-bold text-white mb-1">
              Assign Corrective Action (CAPA)
            </h3>
            <p className="text-xs text-[#9AA0A6] mb-4">
              Remediate root cause for defect <span className="font-mono text-[#F28B82] font-bold">{selectedDefectForAction.defect_code}</span> ({selectedDefectForAction.defect_category})
            </p>

            <form onSubmit={handleCreateAction} className="space-y-3">
              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Remedial Title</label>
                <input
                  type="text"
                  required
                  value={newAction.title}
                  onChange={e => setNewAction({ ...newAction, title: e.target.value })}
                  className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>

              <div>
                <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Description / Plan</label>
                <textarea
                  rows={3}
                  required
                  value={newAction.description}
                  onChange={e => setNewAction({ ...newAction, description: e.target.value })}
                  className="w-full bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Assigned Owner</label>
                  <select
                    value={newAction.assigned_to_user_id}
                    onChange={e => setNewAction({ ...newAction, assigned_to_user_id: parseInt(e.target.value) })}
                    className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA]"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="bg-[#202124] text-white">{u.full_name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#E3E3E3] font-semibold block mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newAction.target_date}
                    onChange={e => setNewAction({ ...newAction, target_date: e.target.value })}
                    className="w-full min-h-[44px] bg-[#1E1F20] border border-[#3C4043] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#A8C7FA] focus:ring-1 focus:ring-[#A8C7FA] font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#3C4043]">
                <button
                  type="button"
                  onClick={() => setShowCreateActionModal(false)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#303134] hover:bg-[#3C4043] border border-[#3C4043] text-[#E3E3E3] text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] text-xs font-bold cursor-pointer transition-colors"
                >
                  Commit Action
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
