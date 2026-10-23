import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Camera,
  Box,
  BarChart3,
  PieChart as PieChartIcon,
  ShieldAlert,
  AlertTriangle,
  ClipboardCheck,
  Activity,
  Layers
} from 'lucide-react';
import { DashboardMetrics, ConfirmedDefect, CorrectiveAction, Inspection } from '../types';
import { StatusBadge } from '../components/Badge';
import { api } from '../api/client';
import {
  DefectTrendBarChart,
  DefectCategoryDonutChart
} from '../components/BentoCharts';

interface OverviewPageProps {
  metrics: DashboardMetrics | null;
  onNavigate: (tab: string, filter?: any) => void;
  onViewInspection: (inspectionId: number) => void;
}

interface ActionQueueItem {
  id: string;
  type: 'REVIEW' | 'OVERDUE_CAPA' | 'CRITICAL_DEFECT';
  refCode: string;
  title: string;
  context: string;
  owner: string;
  severityOrStatus: string;
  dateOrDeadline: string;
  targetInspectionId?: number;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  metrics,
  onNavigate,
  onViewInspection
}) => {
  const [defects, setDefects] = useState<ConfirmedDefect[]>([]);
  const [actions, setActions] = useState<CorrectiveAction[]>([]);
  const [pendingInspections, setPendingInspections] = useState<Inspection[]>([]);
  const [inspectionFilter, setInspectionFilter] = useState<'ALL' | 'PENDING' | 'DEFECT' | 'PASSED'>('ALL');

  useEffect(() => {
    let mounted = true;
    const loadOperationalData = async () => {
      try {
        const [defectList, actionList, pendingList] = await Promise.all([
          api.getDefects(),
          api.getActions(),
          api.getInspections(undefined, 'UNDER_REVIEW')
        ]);
        if (mounted) {
          setDefects(defectList);
          setActions(actionList);
          setPendingInspections(pendingList);
        }
      } catch (err) {
        console.error('Failed to load operational data for quality control center:', err);
      }
    };
    loadOperationalData();
    return () => { mounted = false; };
  }, []);

  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-64 text-[#77766E] font-mono text-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="w-5 h-5 border-2 border-[#71845B] border-t-transparent rounded-full animate-spin" />
          <span>Loading Steel-IQ Quality Control Center...</span>
        </div>
      </div>
    );
  }

  // Build the unified Quality Action Queue from real records
  const actionQueue: ActionQueueItem[] = [];

  // 1. Overdue Corrective Actions (Highest SLA priority)
  actions
    .filter(a => a.is_overdue && (a.status === 'PENDING' || a.status === 'IN_PROGRESS'))
    .forEach(a => {
      actionQueue.push({
        id: `act-${a.id}`,
        type: 'OVERDUE_CAPA',
        refCode: a.action_code,
        title: a.title,
        context: `Linked Defect: ${a.defect_code || 'Unspecified'}`,
        owner: a.assigned_to_name || 'Line Supervisor',
        severityOrStatus: 'OVERDUE SLA',
        dateOrDeadline: new Date(a.target_date).toLocaleDateString()
      });
    });

  // 2. Critical Confirmed Defects awaiting containment / reinspection
  defects
    .filter(d => d.severity === 'CRITICAL' && d.review_status !== 'RESOLVED')
    .slice(0, 3)
    .forEach(d => {
      actionQueue.push({
        id: `def-${d.id}`,
        type: 'CRITICAL_DEFECT',
        refCode: d.defect_code,
        title: `${d.defect_category}: ${d.description}`,
        context: `Batch ${d.batch_number || 'N/A'} • ${d.product_name || 'Component'}`,
        owner: 'Quality Engineering',
        severityOrStatus: 'CRITICAL SEVERITY',
        dateOrDeadline: new Date(d.created_at).toLocaleDateString(),
        targetInspectionId: d.inspection_id
      });
    });

  // 3. Pending Human Reviews awaiting disposition
  pendingInspections
    .slice(0, 4)
    .forEach(i => {
      actionQueue.push({
        id: `insp-${i.id}`,
        type: 'REVIEW',
        refCode: i.item_identifier,
        title: `AI Classification: ${i.latest_prediction || 'Pending Inference'} (${((i.latest_confidence || 0) * 100).toFixed(1)}%)`,
        context: `${i.product_name || 'Component'} • Batch ${i.batch_number || 'N/A'}`,
        owner: i.inspector_name || 'Lead Inspector',
        severityOrStatus: 'DISPOSITION REQUIRED',
        dateOrDeadline: new Date(i.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        targetInspectionId: i.id
      });
    });

  // Filtered recent inspections
  const filteredRecentInspections = (metrics.recent_inspections || []).filter(insp => {
    if (inspectionFilter === 'PENDING') return insp.status === 'UNDER_REVIEW' || insp.status === 'INFERENCE_COMPLETED';
    if (inspectionFilter === 'DEFECT') return insp.latest_prediction === 'DEFECTIVE' || insp.status === 'CONFIRMED_DEFECT';
    if (inspectionFilter === 'PASSED') return insp.status === 'PASSED' || insp.latest_prediction === 'OK';
    return true;
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 6 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22 } }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* =========================================================================
          SECTION A: PLANT QUALITY CONTROL CENTER HEADER
         ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="p-5 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wider">
              STATION 01 // LINE OPERATIONS
            </span>
            <span className="flex items-center gap-1.5 text-xs text-[#71845B] font-sans font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#71845B] animate-pulse" />
              Live Quality Control Center
            </span>
            <span className="text-xs text-[#77766E] font-sans hidden sm:inline">•</span>
            <span className="text-xs text-[#77766E] font-mono tabular-nums">
              Shift A // Active
            </span>
          </div>

          <h1 className="type-page-title text-[#292A26]">
            Plant Quality Overview
          </h1>
          <p className="text-xs sm:text-sm text-[#77766E] font-sans leading-relaxed">
            Real-time optical defect telemetry, automated inference validation, containment quarantine, and closed-loop CAPA tracking.
          </p>

          {/* Operational Status Badges */}
          <div className="flex items-center gap-2 pt-2 flex-wrap text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0EAE1] border border-[#D8C9AE] font-sans text-xs text-[#292A26]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#71845B]" />
              <span>Vision Core: <strong>MobileNetV3 PyTorch</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F0EAE1] border border-[#D8C9AE] font-sans text-xs text-[#292A26]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#71845B]" />
              <span>Explainability: <strong>Grad-CAM Online</strong></span>
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-sans text-xs ${
              metrics.batches_on_hold > 0
                ? 'bg-[rgba(196,154,82,0.12)] border-[#C49A52]/40 text-[#A07834]'
                : 'bg-[#F0EAE1] border-[#D8C9AE] text-[#77766E]'
            }`}>
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Containment: <strong>{metrics.batches_on_hold} Lots on Hold</strong></span>
            </span>
          </div>
        </div>

        {/* Quick Operational Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => onNavigate('digital_twin')}
            className="btn-secondary-ivory font-sans text-xs font-semibold"
          >
            <Box className="w-4 h-4 text-[#71845B]" />
            <span>3D Line Twin</span>
          </button>
          <button
            onClick={() => onNavigate('new_inspection')}
            className="btn-primary-sage font-sans text-xs font-semibold shadow-xs"
          >
            <Camera className="w-4 h-4" />
            <span>+ Ingest Optical Scan</span>
          </button>
          <button
            onClick={() => onNavigate('review')}
            className="btn-secondary-ivory font-sans text-xs font-semibold"
          >
            <ClipboardCheck className="w-4 h-4 text-[#7895A5]" />
            <span>Review Backlog ({metrics.pending_reviews})</span>
          </button>
        </div>
      </motion.div>

      {/* =========================================================================
          SECTION B: OPERATIONAL QUALITY KPI ROW (5 CARDS WITH UNITS & CONTEXT)
         ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Inspected Items */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2 }}
          onClick={() => onNavigate('review')}
          className="industrial-card p-4 hover:border-[#71845B] cursor-pointer transition-all bento-dotted-bg shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="type-label-meta">TOTAL INSPECTED</span>
            <CheckCircle2 className="w-4 h-4 text-[#71845B]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="type-kpi-value">
              {metrics.total_inspected_items}
            </div>
            <span className="text-xs text-[#77766E] font-mono">units</span>
          </div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">Distinct components evaluated</p>
        </motion.div>

        {/* Metric 2: Confirmed Defects & Flaw Frequency */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2 }}
          onClick={() => onNavigate('defects')}
          className="industrial-card p-4 hover:border-[#C97958] cursor-pointer transition-all bento-dotted-bg shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="type-label-meta">CONFIRMED DEFECTS</span>
            <TrendingUp className="w-4 h-4 text-[#C97958]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="type-kpi-value text-[#C97958]">
              {metrics.confirmed_defects}
            </div>
            <span className="text-xs text-[#C97958] font-mono">flaws</span>
          </div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">
            {metrics.overall_defect_rate}% flaw rate ({(metrics.confirmed_defects / Math.max(1, metrics.total_inspected_items)).toFixed(2)} DPU)
          </p>
        </motion.div>

        {/* Metric 3: Pending Human Reviews */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2 }}
          onClick={() => onNavigate('review')}
          className="industrial-card p-4 hover:border-[#C49A52] cursor-pointer transition-all bento-dotted-bg shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="type-label-meta">PENDING REVIEWS</span>
            <Clock className="w-4 h-4 text-[#C49A52]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="type-kpi-value text-[#A07834]">
              {metrics.pending_reviews}
            </div>
            <span className="text-xs text-[#A07834] font-mono">items</span>
          </div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">Awaiting inspector disposition</p>
        </motion.div>

        {/* Metric 4: Overdue Corrective Actions */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2 }}
          onClick={() => onNavigate('defects', { overdueOnly: true })}
          className="industrial-card p-4 hover:border-[#C97958] cursor-pointer transition-all bento-dotted-bg shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="type-label-meta">OVERDUE CAPA</span>
            <AlertCircle className="w-4 h-4 text-[#C97958]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className={`type-kpi-value ${metrics.overdue_actions > 0 ? 'text-[#C97958]' : 'text-[#77766E]'}`}>
              {metrics.overdue_actions}
            </div>
            <span className="text-xs text-[#77766E] font-mono">overdue</span>
          </div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">
            {metrics.open_corrective_actions} open CAPAs active
          </p>
        </motion.div>

        {/* Metric 5: Quarantined Batches on Hold */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -2 }}
          onClick={() => onNavigate('batches')}
          className="industrial-card p-4 hover:border-[#A07834] cursor-pointer transition-all bento-dotted-bg shadow-sm col-span-2 md:col-span-1"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="type-label-meta">CONTAINMENT BUFFER</span>
            <Layers className="w-4 h-4 text-[#7895A5]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <div className="type-kpi-value text-[#292A26]">
              {metrics.batches_on_hold}
            </div>
            <span className="text-xs text-[#77766E] font-mono">lots</span>
          </div>
          <p className="text-xs text-[#77766E] mt-1 font-sans">Quarantined batches on hold</p>
        </motion.div>
      </div>

      {/* =========================================================================
          SECTION C: INSPECTION PERFORMANCE CHARTS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Bar Chart - Defects Over Time (7-Day Run) - 7 cols */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-7 industrial-card p-5 space-y-3 bento-dotted-bg shadow-sm"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-[#D8C9AE]/60">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#71845B]" />
                <h2 className="text-xs font-semibold text-[#292A26] uppercase tracking-wider font-sans">
                  Inspection Volume & Defect Trend (7-Day Run)
                </h2>
              </div>
              <p className="text-xs text-[#77766E] font-sans mt-0.5">
                Daily component throughput comparing passed components against detected flaws
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#77766E] bg-[#F0EAE1] px-2.5 py-1 rounded-lg border border-[#D8C9AE]">
              Daily Volume
            </span>
          </div>
          <DefectTrendBarChart trendHistory={metrics.trend_history} />
        </motion.div>

        {/* Chart 2: Donut Chart - Defect Category Distribution & FTT Yield - 5 cols */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-5 industrial-card p-5 space-y-3 bento-dotted-bg shadow-sm"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-[#D8C9AE]/60">
            <div>
              <div className="flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#C97958]" />
                <h2 className="text-xs font-semibold text-[#292A26] uppercase tracking-wider font-sans">
                  Defect Category Distribution & Yield
                </h2>
              </div>
              <p className="text-xs text-[#77766E] font-sans mt-0.5">
                Pareto breakdown across verified manufacturing classifications
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#77766E] bg-[#F0EAE1] px-2.5 py-1 rounded-lg border border-[#D8C9AE] tabular-nums font-semibold">
              {defects.length} Confirmed
            </span>
          </div>
          <DefectCategoryDonutChart metrics={metrics} defects={defects} />
        </motion.div>
      </div>

      {/* =========================================================================
          SECTION E: IMMEDIATE QUALITY ACTION QUEUE (SURFACE CRITICAL OPERATIONAL TASKS)
         ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="industrial-card p-5 space-y-3 shadow-sm border-[#D8C9AE]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#D8C9AE]/60">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#C97958]" />
              <h2 className="text-sm font-semibold text-[#292A26] font-sans">
                Immediate Quality Action Queue
              </h2>
            </div>
            <p className="text-xs text-[#77766E] font-sans mt-0.5">
              Actionable operational tasks: pending dispositions, overdue corrective actions, and critical containment
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-[#77766E] tabular-nums bg-[#F0EAE1] px-2.5 py-1 rounded-lg border border-[#D8C9AE]">
              {actionQueue.length} Attention Items
            </span>
          </div>
        </div>

        {actionQueue.length === 0 ? (
          <div className="p-8 text-center bg-[#F0EAE1]/50 rounded-xl border border-[#D8C9AE] text-xs font-sans text-[#77766E] space-y-1">
            <CheckCircle2 className="w-6 h-6 text-[#71845B] mx-auto mb-1" />
            <p className="font-semibold text-[#292A26]">No Immediate Escalations</p>
            <p>All inspections reviewed and corrective actions are on track within committed SLA windows.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-sans">
              <thead>
                <tr className="border-b border-[#D8C9AE] text-[#77766E] uppercase text-[11px] font-semibold tracking-wider bg-[#F0EAE1]/60">
                  <th className="py-2.5 px-3">Escalation Type</th>
                  <th className="py-2.5 px-3">Identifier</th>
                  <th className="py-2.5 px-3">Operational Context</th>
                  <th className="py-2.5 px-3">Assigned Owner</th>
                  <th className="py-2.5 px-3">Due / Recorded</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8C9AE]/50">
                {actionQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F0EAE1]/70 transition-colors">
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold font-sans uppercase tracking-wider border ${
                        item.type === 'OVERDUE_CAPA'
                          ? 'bg-[rgba(201,121,88,0.12)] text-[#C97958] border-[#C97958]/35'
                          : item.type === 'CRITICAL_DEFECT'
                          ? 'bg-[rgba(212,91,91,0.12)] text-[#D45B5B] border-[#D45B5B]/35'
                          : 'bg-[rgba(196,154,82,0.12)] text-[#A07834] border-[#C49A52]/35'
                      }`}>
                        {item.severityOrStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-xs text-[#292A26]">
                      {item.refCode}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-xs text-[#292A26]">{item.title}</div>
                      <div className="text-[11px] text-[#77766E]">{item.context}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[#292A26] text-xs">
                      {item.owner}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs tabular-nums text-[#77766E]">
                      {item.dateOrDeadline}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {item.type === 'REVIEW' && item.targetInspectionId ? (
                        <button
                          onClick={() => onViewInspection(item.targetInspectionId!)}
                          className="btn-primary-sage text-xs py-1 px-3 min-h-[32px]"
                        >
                          Review Evidence
                        </button>
                      ) : item.type === 'OVERDUE_CAPA' ? (
                        <button
                          onClick={() => onNavigate('defects', { overdueOnly: true })}
                          className="px-3 py-1 rounded-lg border border-[#C97958] bg-[rgba(201,121,88,0.12)] hover:bg-[rgba(201,121,88,0.2)] text-[#C97958] font-semibold text-xs transition-colors cursor-pointer min-h-[32px]"
                        >
                          Manage CAPA
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigate('defects')}
                          className="btn-secondary-ivory text-xs py-1 px-3 min-h-[32px]"
                        >
                          Defect Log
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* =========================================================================
          SECTION D: RECENT INSPECTION REGISTER
         ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="industrial-card p-5 space-y-3 bento-dotted-bg shadow-sm"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-[#D8C9AE]/60">
          <div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans">
              Recent Inspection Register
            </h2>
            <p className="text-xs text-[#77766E] font-sans mt-0.5">
              Continuous chronological log of component optical scans with model flags and human dispositions
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'All Records' },
              { id: 'PENDING', label: 'Pending Review' },
              { id: 'DEFECT', label: 'Defects Flagged' },
              { id: 'PASSED', label: 'Passed Scans' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setInspectionFilter(f.id as any)}
                className={`px-3 py-1.5 text-xs font-sans font-medium rounded-xl border transition-colors cursor-pointer min-h-[36px] ${
                  inspectionFilter === f.id
                    ? 'bg-[#71845B] text-[#FFFFFF] border-[#71845B] font-semibold shadow-xs'
                    : 'bg-[#FFFCF6] text-[#77766E] border-[#D8C9AE] hover:text-[#292A26] hover:bg-[#F0EAE1]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-sans">
            <thead>
              <tr className="border-b border-[#D8C9AE] text-[#77766E] uppercase text-[11px] font-semibold tracking-wider bg-[#F0EAE1]/60">
                <th className="py-2.5 px-3">Item Identifier</th>
                <th className="py-2.5 px-3">Product / Batch</th>
                <th className="py-2.5 px-3">AI Prediction</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Disposition Status</th>
                <th className="py-2.5 px-3">Logged At</th>
                <th className="py-2.5 px-3 text-right">Workbench</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8C9AE]/50">
              {filteredRecentInspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#77766E] text-xs font-sans">
                    No inspection records found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredRecentInspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-[#F0EAE1]/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-semibold text-xs text-[#292A26]">
                      {insp.item_identifier}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-xs text-[#292A26]">{insp.product_name || 'Component'}</div>
                      <div className="font-mono text-xs text-[#71845B] font-medium">{insp.batch_number}</div>
                    </td>
                    <td className="py-3 px-3">
                      {insp.latest_prediction ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-sans font-semibold uppercase tracking-wider ${
                          insp.latest_prediction === 'DEFECTIVE' ? 'text-[#C97958]' : 'text-[#71845B]'
                        }`}>
                          {insp.latest_prediction === 'DEFECTIVE' ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>{insp.latest_prediction}</span>
                        </span>
                      ) : (
                        <span className="text-[#96958B] font-sans text-xs">Unprocessed</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#292A26] font-mono text-xs tabular-nums font-semibold">
                      {insp.latest_confidence !== null && insp.latest_confidence !== undefined
                        ? `${(insp.latest_confidence * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={insp.status} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-[#77766E] font-mono text-xs tabular-nums">
                      {new Date(insp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onViewInspection(insp.id)}
                        className="text-[#71845B] hover:text-[#5F704C] font-sans text-xs cursor-pointer font-semibold inline-flex items-center gap-1"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};
