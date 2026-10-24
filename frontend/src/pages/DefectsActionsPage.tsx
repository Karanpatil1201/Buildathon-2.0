import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ConfirmedDefect, CorrectiveAction, User } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';
import { canCreateCapa, canVerifyCapa, canManageDefects } from '../utils/rbac';

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
      const [defs, acts, usrs] = await Promise.all([
        api.getDefects(statusFilter === 'ALL' ? undefined : statusFilter),
        api.getActions(undefined, undefined, overdueOnly),
        api.getUsers().catch(() => [] as User[])
      ]);
      setDefects(defs);
      setActions(acts);
      setUsers(usrs);

      if (usrs.length > 0 && newAction.assigned_to_user_id === 0) {
        setNewAction(prev => ({ ...prev, assigned_to_user_id: usrs[0].id }));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load defect and action data');
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, overdueOnly]);

  // Connect targetDefectId workflow trigger from Inspection Review
  useEffect(() => {
    if (targetDefectId && defects.length > 0) {
      const target = defects.find(d => d.id === targetDefectId);
      if (target) {
        handleOpenActionModal(target);
      }
    }
  }, [targetDefectId, defects]);

  const handleOpenActionModal = (defect: ConfirmedDefect) => {
    if (!canCreateCapa(currentUser)) {
      setError('Action unauthorized: Creating a corrective action requires Quality Manager authority.');
      return;
    }
    setSelectedDefectForAction(defect);
    // Set default target date: 3 days in future
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setNewAction({
      title: `Remediate ${defect.defect_category} on ${defect.defect_code}`,
      description: 'Implement containment, adjust tooling parameters, and schedule verification scan.',
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

  const criticalDefectsCount = defects.filter(d => d.severity === 'CRITICAL').length;
  const openActionsCount = actions.filter(a => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length;
  const overdueActionsCount = actions.filter(a => a.is_overdue).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wide">
              STATION 04 // DEFECT REGISTRY
            </span>
            <span className="text-xs text-[#77766E] font-sans">Remediation & Closed-Loop Verification</span>
          </div>
          <h1 className="type-page-title flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 text-[#C97958] shrink-0" />
            Confirmed Defects & Corrective Action (CAPA) Lifecycle
          </h1>
          <p className="text-xs sm:text-sm text-[#77766E] mt-1 font-sans leading-relaxed">
            Assign remedial tasks, monitor SLA deadlines, track resolution, and execute follow-up reinspection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOverdueOnly(!overdueOnly)}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-sans font-semibold border transition-colors cursor-pointer ${
              overdueOnly
                ? 'bg-[rgba(201,121,88,0.15)] text-[#C97958] border-[#C97958]'
                : 'bg-[#FFFCF6] text-[#77766E] border-[#D8C9AE] hover:text-[#292A26] hover:bg-[#F0EAE1]'
            }`}
          >
            {overdueOnly ? 'Showing Overdue Only' : 'Filter Overdue Actions'}
          </button>
        </div>
      </div>

      {/* Industrial Operational Telemetry Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="industrial-card p-4 shadow-sm bento-dotted-bg">
          <div className="type-label-meta text-[#77766E] mb-1">TOTAL CONFIRMED DEFECTS</div>
          <div className="type-kpi-value text-[#C97958]">{defects.length}</div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">Active defect log entries</p>
        </div>
        <div className="industrial-card p-4 shadow-sm bento-dotted-bg">
          <div className="type-label-meta text-[#77766E] mb-1">CRITICAL SEVERITY</div>
          <div className="type-kpi-value text-[#D45B5B]">{criticalDefectsCount}</div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">High-risk containment required</p>
        </div>
        <div className="industrial-card p-4 shadow-sm bento-dotted-bg">
          <div className="type-label-meta text-[#77766E] mb-1">OPEN CORRECTIVE ACTIONS</div>
          <div className="type-kpi-value text-[#7895A5]">{openActionsCount}</div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">Pending or in progress CAPAs</p>
        </div>
        <div className="industrial-card p-4 shadow-sm bento-dotted-bg">
          <div className="type-label-meta text-[#77766E] mb-1">OVERDUE SLA ACTIONS</div>
          <div className={`type-kpi-value ${overdueActionsCount > 0 ? 'text-[#C97958]' : 'text-[#71845B]'}`}>
            {overdueActionsCount}
          </div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">Past committed resolution date</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/40 rounded-xl text-[#C97958] text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#C97958] shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-[#C97958] min-h-[40px] min-w-[40px] flex items-center justify-center font-bold cursor-pointer">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-3.5 bg-[rgba(113,132,91,0.12)] border border-[#71845B]/40 rounded-xl text-[#5E704B] text-xs font-sans flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#71845B] shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[#71845B] min-h-[40px] min-w-[40px] flex items-center justify-center font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Confirmed Defects Table */}
      <div className="industrial-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans">Confirmed Defects Log</h2>
            <p className="text-xs text-[#77766E] font-sans">Human-verified defects with root causes and corrective actions</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'OPEN', 'ACTION_ASSIGNED', 'IN_REMEDIATION', 'RESOLVED'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-sans font-semibold rounded-xl border transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#71845B] text-[#FFFFFF] border-[#71845B] shadow-xs'
                    : 'bg-[#FFFCF6] text-[#77766E] border-[#D8C9AE] hover:text-[#292A26] hover:bg-[#F0EAE1]'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#D8C9AE] text-[#77766E] uppercase font-sans text-[11px] font-semibold tracking-wider bg-[#F0EAE1]/60">
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
            <tbody className="divide-y divide-[#D8C9AE]/50">
              {defects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#77766E] text-xs font-sans">
                    No confirmed defects matching current filters.
                  </td>
                </tr>
              ) : (
                defects.map((def) => (
                  <tr key={def.id} className="hover:bg-[#F0EAE1]/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-xs text-[#292A26]">
                      {def.defect_code}
                    </td>
                    <td className="py-3 px-3 font-sans font-semibold text-xs text-[#C97958]">
                      {def.defect_category}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={def.severity} size="sm" />
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-mono text-xs text-[#292A26] font-semibold">{def.batch_number}</div>
                      <div className="text-xs text-[#77766E] font-sans">{def.product_name}</div>
                    </td>
                    <td className="py-3 px-3 text-[#292A26] font-sans max-w-xs truncate">
                      {def.description}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={def.review_status} size="sm" />
                    </td>
                    <td className="py-3 px-3">
                      {def.corrective_actions.length > 0 ? (
                        <div className="space-y-1">
                          {def.corrective_actions.map(act => (
                            <div key={act.id} className="flex items-center gap-1.5 text-xs font-sans">
                              <span className="font-mono text-[#71845B] font-semibold text-xs">{act.action_code}</span>
                              <StatusBadge status={act.status} size="sm" />
                              {act.is_overdue && (
                                <span className="text-[10px] px-1 rounded bg-[rgba(201,121,88,0.15)] text-[#C97958] border border-[#C97958]/40 font-bold uppercase tracking-wider font-sans">
                                  OVERDUE
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#96958B] font-sans text-xs">None assigned</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onStartReinspection(
                            def.inspection_id,
                            1,
                            def.batch_id,
                            `DEF-${def.id}-RE`
                          )}
                          className="px-2.5 py-1.5 rounded-lg bg-[rgba(196,154,82,0.12)] hover:bg-[rgba(196,154,82,0.22)] border border-[#C49A52] text-[#A07834] text-xs font-sans font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="Execute follow-up reinspection scan linked to this defect"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reinspect</span>
                        </button>
                        {canCreateCapa(currentUser) && (
                          <button
                            onClick={() => handleOpenActionModal(def)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#FFFCF6] hover:bg-[#F0EAE1] border border-[#D8C9AE] text-[#71845B] text-xs font-sans font-semibold cursor-pointer transition-colors"
                            title="Assign corrective action"
                          >
                            + CAPA
                          </button>
                        )}
                        {canManageDefects(currentUser) ? (
                          <button
                            onClick={() => handleCloseOrReopenDefect(def.id, def.review_status)}
                            className="px-2.5 py-1.5 rounded-lg bg-[#F0EAE1] hover:bg-[#EBE4D8] border border-[#D8C9AE] text-[#292A26] text-xs font-sans font-medium cursor-pointer transition-colors"
                          >
                            {def.review_status === 'RESOLVED' ? 'Reopen' : 'Close'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#77766E] font-sans italic">Read-only</span>
                        )}
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
      <div className="industrial-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans">Corrective Actions (CAPA) Roster</h2>
            <p className="text-xs text-[#77766E] font-sans">Remedial engineering tasks assigned to production and tooling owners</p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#77766E]">{actions.length} action items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#D8C9AE] text-[#77766E] uppercase font-sans text-[11px] font-semibold tracking-wider bg-[#F0EAE1]/60">
                <th className="py-2.5 px-3">CAPA Code</th>
                <th className="py-2.5 px-3">Linked Defect</th>
                <th className="py-2.5 px-3">Remedial Title</th>
                <th className="py-2.5 px-3">Owner</th>
                <th className="py-2.5 px-3">Target Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Lifecycle Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8C9AE]/50">
              {actions.map((act) => (
                <tr key={act.id} className="hover:bg-[#F0EAE1]/70 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-xs text-[#292A26]">
                    {act.action_code}
                  </td>
                  <td className="py-3 px-3 font-mono text-[#C97958] font-semibold text-xs">
                    {act.defect_code}
                  </td>
                  <td className="py-3 px-3 text-[#292A26] font-sans">
                    <div className="font-semibold text-xs sm:text-sm">{act.title}</div>
                    <div className="text-xs text-[#77766E] mt-0.5">{act.description}</div>
                  </td>
                  <td className="py-3 px-3 text-[#292A26] font-sans text-xs">
                    {act.assigned_to_name || 'John Davis'}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs tabular-nums">
                    <span className={act.is_overdue ? 'text-[#C97958] font-semibold' : 'text-[#292A26]'}>
                      {new Date(act.target_date).toLocaleDateString()}
                    </span>
                    {act.is_overdue && (
                      <span className="block text-[10px] text-[#C97958] font-bold font-sans uppercase tracking-wider">OVERDUE</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <StatusBadge status={act.status} size="sm" />
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-sans">
                      {act.status === 'PENDING' && (
                        <button
                          onClick={() => handleUpdateActionStatus(act.id, 'IN_PROGRESS')}
                          className="px-2.5 py-1.5 rounded-lg bg-[rgba(120,149,165,0.15)] hover:bg-[rgba(120,149,165,0.25)] border border-[#7895A5]/40 text-[#456272] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {act.status === 'IN_PROGRESS' && (
                        <button
                          onClick={() => handleUpdateActionStatus(act.id, 'COMPLETED')}
                          className="px-2.5 py-1.5 rounded-lg bg-[rgba(113,132,91,0.15)] hover:bg-[rgba(113,132,91,0.25)] border border-[#71845B]/40 text-[#5E704B] text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Complete
                        </button>
                      )}
                      {act.status === 'COMPLETED' && (() => {
                        const verifyCheck = canVerifyCapa(currentUser, act.assigned_to_user_id);
                        return (
                          <button
                            onClick={() => handleUpdateActionStatus(act.id, 'VERIFIED')}
                            disabled={!verifyCheck.allowed}
                            title={!verifyCheck.allowed ? verifyCheck.reason : 'Verify and close corrective action'}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              verifyCheck.allowed
                                ? 'bg-[#71845B] hover:bg-[#5F704C] text-[#FFFFFF] cursor-pointer'
                                : 'bg-[#E2DACB] text-[#77766E] cursor-not-allowed opacity-60'
                            }`}
                          >
                            Verify
                          </button>
                        );
                      })()}
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
        <div className="fixed inset-0 bg-[#292A26]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card industrial-modal-shadow w-full max-w-md p-6 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl">
            <h3 className="text-base font-bold text-[#292A26] mb-1">
              Assign Corrective Action (CAPA)
            </h3>
            <p className="text-xs text-[#77766E] mb-4">
              Remediate root cause for defect <span className="font-mono text-[#C97958] font-bold">{selectedDefectForAction.defect_code}</span> ({selectedDefectForAction.defect_category})
            </p>

            <form onSubmit={handleCreateAction} className="space-y-3">
              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Remedial Title</label>
                <input
                  type="text"
                  required
                  value={newAction.title}
                  onChange={e => setNewAction({ ...newAction, title: e.target.value })}
                  className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                />
              </div>

              <div>
                <label className="text-xs text-[#292A26] font-semibold block mb-1">Description / Plan</label>
                <textarea
                  rows={3}
                  required
                  value={newAction.description}
                  onChange={e => setNewAction({ ...newAction, description: e.target.value })}
                  className="w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#292A26] font-semibold block mb-1">Assigned Owner</label>
                  <select
                    value={newAction.assigned_to_user_id}
                    onChange={e => setNewAction({ ...newAction, assigned_to_user_id: parseInt(e.target.value) })}
                    className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B]"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="bg-[#FFFCF6] text-[#292A26]">{u.full_name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#292A26] font-semibold block mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={newAction.target_date}
                    onChange={e => setNewAction({ ...newAction, target_date: e.target.value })}
                    className="w-full min-h-[40px] bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl px-3 py-2 text-xs text-[#292A26] focus:outline-none focus:border-[#71845B] font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#D8C9AE]">
                <button
                  type="button"
                  onClick={() => setShowCreateActionModal(false)}
                  className="btn-secondary-ivory text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-sage text-xs font-bold"
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
