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
  Layers,
  Shield,
  ShieldCheck,
  UserCheck,
  Lock,
  Unlock,
  Check,
  X,
  Tag,
  Info,
  Users
} from 'lucide-react';
import { DashboardMetrics, ConfirmedDefect, CorrectiveAction, Inspection, User } from '../types';
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
  currentUser?: User | null;
  onSwitchUser?: (username: string) => Promise<void>;
}

interface DefectTaxonomyItem {
  code: string;
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  visualFeatures: string;
  cause: string;
  remediation: string;
  color: string;
}

const DATASET_DEFECT_TAXONOMY: DefectTaxonomyItem[] = [
  {
    code: 'CRAZING',
    name: 'Crazing (Surface Microcracks)',
    severity: 'CRITICAL',
    visualFeatures: 'Interconnected network of fine micro-fissures running along strip surface.',
    cause: 'Thermal fatigue during rapid non-uniform secondary water spray cooling.',
    remediation: 'Inspect cooling header nozzle alignment; adjust roll gap and finish.',
    color: '#D4736A',
  },
  {
    code: 'INCLUSION',
    name: 'Inclusions (Non-Metallic Impurities)',
    severity: 'HIGH',
    visualFeatures: 'Isolated dark non-metallic slag or alumina particles embedded in matrix.',
    cause: 'Slag entrapment in continuous casting tundish or deoxidation precipitate flotation failure.',
    remediation: 'Check continuous casting tundish purity & ladle shroud inert gas seal.',
    color: '#E59866',
  },
  {
    code: 'PATCHES',
    name: 'Patches (Surface Plate Flaws)',
    severity: 'MEDIUM',
    visualFeatures: 'Irregular dark surface patches with uneven oxide plate thickness.',
    cause: 'Localized primary scale peeling failure or material adhesion on work rolls.',
    remediation: 'Clean high-pressure descaling nozzles; service roughing descaler pumps.',
    color: '#F4D03F',
  },
  {
    code: 'PITTED_SURFACE',
    name: 'Pitted Surface (Cavities & Pits)',
    severity: 'CRITICAL',
    visualFeatures: 'Periodic clusters of small crater-like depressions and surface pits.',
    cause: 'Secondary oxide scale pressed into strip and subsequently dislodged.',
    remediation: 'Optimize furnace atmosphere to suppress excessive tertiary scale growth.',
    color: '#AF7AC5',
  },
  {
    code: 'ROLLED_IN_SCALE',
    name: 'Rolled-in Scale (Embedded Oxidation)',
    severity: 'CRITICAL',
    visualFeatures: 'Dark, fish-scale or streak-like embedded iron oxide rolled into strip.',
    cause: 'Residual oxide scale pressed firmly into surface during reduction passes.',
    remediation: 'Verify descaling lead time before roughing pass; inspect roll roughness.',
    color: '#C0392B',
  },
  {
    code: 'SCRATCHES',
    name: 'Scratches (Linear Abrasions)',
    severity: 'LOW',
    visualFeatures: 'Straight continuous grooves or scratch tracks parallel to rolling line.',
    cause: 'Mechanical friction with worn table guide rollers, apron plates, or line debris.',
    remediation: 'Polish line delivery guide plates; verify strip tension and clearance.',
    color: '#5DADE2',
  },
  {
    code: 'NORMAL',
    name: 'Normal (Defect-Free Prime Steel)',
    severity: 'NONE',
    visualFeatures: 'Smooth, uniform hot-rolled strip grain meeting ASTM A36 surface standard.',
    cause: 'Stable continuous rolling process with uniform temperature and descaling.',
    remediation: 'Proceed with coiling and release for final packaging disposition.',
    color: '#71845B',
  },
];

const RBAC_ROLE_DEFINITIONS = [
  {
    id: 'production_operator',
    roleName: 'Production Operator',
    sampleUser: 'op_alex',
    sampleUserName: 'Alex Koval',
    badge: 'LINE INTAKE & SCAN',
    color: '#4A6B82',
    description: 'Executes shop floor line intake, camera scan uploads, and completes assigned containment tasks.',
    permissions: [
      { key: 'inspection:create', label: 'Create new inspection intake scans', granted: true },
      { key: 'inspection:infer', label: 'Trigger real ML inference & Grad-CAM', granted: true },
      { key: 'inspection:read', label: 'View permitted inspection scans', granted: true },
      { key: 'capa:complete', label: 'Mark assigned remediation steps complete', granted: true },
      { key: 'batch:read', label: 'View production batch queue & status', granted: true },
      { key: 'inspection:review', label: 'Authorize or confirm defect dispositions', granted: false },
      { key: 'batch:release', label: 'Release quarantined production lots', granted: false },
      { key: 'capa:verify', label: 'Sign off or verify CAPA effectiveness', granted: false },
      { key: 'users:manage', label: 'System user & credential administration', granted: false },
    ],
  },
  {
    id: 'quality_inspector',
    roleName: 'Quality Inspector',
    sampleUser: 'inspector_marcus',
    sampleUserName: 'Marcus Lee',
    badge: 'DISPOSITION WORKBENCH',
    color: '#5E704B',
    description: 'Evaluates Grad-CAM evidence heatmaps, classifies defect taxonomy, and confirms quality dispositions.',
    permissions: [
      { key: 'inspection:review', label: 'Access disposition workbench & heatmaps', granted: true },
      { key: 'defect:create', label: 'Confirm defect taxonomy from dataset', granted: true },
      { key: 'defect:flag', label: 'Flag suspect batches for containment', granted: true },
      { key: 'inspection:read_all', label: 'Audit all plant inspection scans', granted: true },
      { key: 'dashboard:kpi', label: 'Inspect quality analytics & defect KPIs', granted: true },
      { key: 'self_approval', label: 'Approve self-submitted inspection scans', granted: false },
      { key: 'batch:release', label: 'Release quarantined production lots', granted: false },
      { key: 'capa:close', label: 'Sign off or close CAPA investigations', granted: false },
      { key: 'users:manage', label: 'System user & credential administration', granted: false },
    ],
  },
  {
    id: 'quality_manager',
    roleName: 'Quality Manager',
    sampleUser: 'qm_elena',
    sampleUserName: 'Elena Vance',
    badge: 'GOVERNANCE & CONTAINMENT',
    color: '#8B4513',
    description: 'Owns plant quality performance, batch quarantine/release authority, and CAPA governance.',
    permissions: [
      { key: 'batch:quarantine', label: 'Quarantine out-of-spec production lots', granted: true },
      { key: 'batch:release', label: 'Formally release batches for shipment', granted: true },
      { key: 'capa:assign', label: 'Assign root-cause CAPAs to supervisors', granted: true },
      { key: 'capa:verify', label: 'Verify remediation & close CAPA logs', granted: true },
      { key: 'defect:resolve', label: 'Sign off on resolved quality items', granted: true },
      { key: 'inspection:review', label: 'Full review authority across all stations', granted: true },
      { key: 'audit:read', label: 'Audit immutable compliance logs', granted: true },
      { key: 'system:config', label: 'Configure IT security & system passwords', granted: false },
    ],
  },
  {
    id: 'system_admin',
    roleName: 'System Administrator',
    sampleUser: 'admin',
    sampleUserName: 'Sarah Connor',
    badge: 'SECURITY & ACCESS',
    color: '#2C3E50',
    description: 'Manages user accounts, cryptographic audit trails, role assignments, and IT system configuration.',
    permissions: [
      { key: 'users:create', label: 'Provision new employee user accounts', granted: true },
      { key: 'users:update', label: 'Deactivate users & update credentials', granted: true },
      { key: 'roles:assign', label: 'Assign & revoke system access roles', granted: true },
      { key: 'audit:read', label: 'Inspect immutable SHA-256 audit logs', granted: true },
      { key: 'system:config', label: 'Manage server runtime & security configuration', granted: true },
      { key: 'batch:release', label: 'Override lot quality release dispositions', granted: false },
      { key: 'defect:create', label: 'Approve product defect classifications', granted: false },
      { key: 'capa:verify', label: 'Sign off on metallurgical CAPA actions', granted: false },
    ],
  },
];

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
  onViewInspection,
  currentUser,
  onSwitchUser
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
                      <div className="flex flex-col gap-0.5">
                        <span>{insp.item_identifier}</span>
                        {insp.is_reinspection && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase bg-[rgba(196,154,82,0.15)] text-[#A07834] border border-[#C49A52]/30 px-1 py-0.2 rounded w-fit">
                            <span>REINSPECTION (OF #{insp.original_inspection_id})</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-xs text-[#292A26]">{insp.product_name || 'Component'}</div>
                      <div className="font-mono text-xs text-[#71845B] font-medium">{insp.batch_number}</div>
                    </td>
                    <td className="py-3 px-3">
                      {insp.latest_prediction ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center gap-1 text-xs font-sans font-bold uppercase tracking-wider ${
                            insp.latest_prediction === 'DEFECTIVE' ? 'text-[#C97958]' : 'text-[#71845B]'
                          }`}>
                            {insp.latest_prediction === 'DEFECTIVE' ? (
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{insp.latest_prediction}</span>
                          </span>
                          {insp.latest_defect_type && insp.latest_defect_type !== 'NORMAL' ? (
                            <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider bg-[rgba(201,121,88,0.12)] text-[#C97958] px-1.5 py-0.5 rounded border border-[#C97958]/25">
                              {insp.latest_defect_type.replace('_', ' ')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-[#71845B] font-semibold">
                              Prime Surface
                            </span>
                          )}
                        </div>
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
      {/* =========================================================================
          SECTION F: DATASET DEFECT CLASSIFICATION TAXONOMY (NEU STEEL LABELS ONLY)
         ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="industrial-card p-5 space-y-4 shadow-sm border-[#D8C9AE]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8C9AE]/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wider">
                NEU DATASET GROUND TRUTH // TAXONOMY RESTRICTION
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#71845B] font-mono font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Only Dataset-Supplied Defect Classes Permitted
              </span>
            </div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#71845B]" />
              Defect-Category Classification & Visual Standards
            </h2>
            <p className="text-xs text-[#77766E] font-sans mt-0.5">
              Inference suggestions and human review confirmations are strictly bound to the 6 hot-rolled steel surface defect categories defined in the verified dataset.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#77766E] font-mono tabular-nums bg-[#F0EAE1] px-2.5 py-1 rounded-lg border border-[#D8C9AE]">
              7 Total Classes (6 Defect + 1 Prime)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DATASET_DEFECT_TAXONOMY.map((item) => {
            const confirmedCount = defects.filter(
              d => (d.defect_category || '').toUpperCase().trim() === item.code
            ).length;

            return (
              <div
                key={item.code}
                className="p-3.5 bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl flex flex-col justify-between hover:border-[#71845B] transition-colors shadow-2xs space-y-2.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <span className="font-mono text-xs font-bold text-[#292A26] tracking-tight flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.code}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        item.severity === 'CRITICAL'
                          ? 'bg-[#D4736A]/10 text-[#C0392B] border-[#D4736A]/40'
                          : item.severity === 'HIGH'
                          ? 'bg-[#E59866]/10 text-[#D35400] border-[#E59866]/40'
                          : item.severity === 'MEDIUM'
                          ? 'bg-[#F4D03F]/15 text-[#B7950B] border-[#F4D03F]/50'
                          : item.severity === 'LOW'
                          ? 'bg-[#5DADE2]/10 text-[#2980B9] border-[#5DADE2]/40'
                          : 'bg-[#71845B]/10 text-[#5E704B] border-[#71845B]/40'
                      }`}
                    >
                      {item.severity}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-[#292A26] font-sans mb-1">
                    {item.name}
                  </p>

                  <div className="space-y-1 text-[11px] font-sans text-[#77766E]">
                    <p>
                      <strong className="text-[#292A26] font-medium">Visual: </strong>
                      {item.visualFeatures}
                    </p>
                    <p>
                      <strong className="text-[#292A26] font-medium">Root Cause: </strong>
                      {item.cause}
                    </p>
                    <p className="text-[#5E704B]">
                      <strong className="text-[#292A26] font-medium">CAPA Action: </strong>
                      {item.remediation}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#D8C9AE]/40 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#96958B]">Live Occurrences:</span>
                  <span className={`font-bold px-2 py-0.5 rounded ${confirmedCount > 0 ? 'bg-[#D4736A]/10 text-[#C0392B]' : 'bg-[#E4DCCE] text-[#77766E]'}`}>
                    {confirmedCount} Confirmed
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* =========================================================================
          SECTION G: ROLE-BASED ACCESS CONTROL (RBAC) GOVERNANCE & PERMISSION MATRIX
         ========================================================================= */}
      <motion.div
        variants={itemVariants}
        className="industrial-card p-5 space-y-4 shadow-sm border-[#D8C9AE] bg-gradient-to-b from-[#FFFCF6] to-[#F9F5EC]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8C9AE]/60">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[#2C3E50]/10 text-[#2C3E50] border border-[#2C3E50]/30 tracking-wider">
                SECURITY & SEPARATION OF DUTIES // 21 CFR COMPLIANT
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#71845B] font-mono font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Multi-Tier Role Governance Active
              </span>
            </div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans flex items-center gap-2">
              <Users className="w-4 h-4 text-[#71845B]" />
              Role-Based Access Control (RBAC) Permissions Matrix
            </h2>
            <p className="text-xs text-[#77766E] font-sans mt-0.5">
              Distinct operational boundaries ensure that operators who scan metal strips cannot sign off on defect release, and system admins cannot bypass quality containment.
            </p>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2 bg-[#FFFCF6] px-3 py-1.5 rounded-xl border border-[#D8C9AE] shadow-2xs">
              <UserCheck className="w-4 h-4 text-[#71845B]" />
              <div className="text-right">
                <span className="text-[10px] font-mono text-[#96958B] block">Current Persona</span>
                <span className="text-xs font-bold text-[#292A26] font-sans">
                  {currentUser.full_name} ({currentUser.role})
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {RBAC_ROLE_DEFINITIONS.map((roleDef) => {
            const isCurrent = currentUser?.role === roleDef.id || (currentUser?.username === roleDef.sampleUser);

            return (
              <div
                key={roleDef.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-[#FFFCF6] border-2 border-[#71845B] shadow-sm ring-2 ring-[#71845B]/10'
                    : 'bg-[#FFFCF6]/80 border-[#D8C9AE] hover:border-[#71845B]/60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded tracking-wide" style={{ backgroundColor: `${roleDef.color}15`, color: roleDef.color }}>
                        {roleDef.badge}
                      </span>
                      <h3 className="text-sm font-bold text-[#292A26] font-sans mt-1.5">
                        {roleDef.roleName}
                      </h3>
                      <p className="text-[11px] font-mono text-[#77766E]">
                        Demo: {roleDef.sampleUserName} (<code>{roleDef.sampleUser}</code>)
                      </p>
                    </div>

                    {isCurrent && (
                      <span className="font-mono text-[9px] font-bold bg-[#71845B] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#77766E] font-sans leading-relaxed">
                    {roleDef.description}
                  </p>

                  <div className="pt-2 border-t border-[#D8C9AE]/40 space-y-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#96958B] block mb-1">
                      Permissions & Boundaries:
                    </span>
                    {roleDef.permissions.map((p) => (
                      <div key={p.key} className="flex items-start gap-1.5 text-xs font-sans">
                        {p.granted ? (
                          <Check className="w-3.5 h-3.5 text-[#71845B] shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-[#C0392B] shrink-0 mt-0.5" />
                        )}
                        <span className={p.granted ? 'text-[#292A26] font-medium' : 'text-[#96958B] line-through'}>
                          {p.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {onSwitchUser && !isCurrent && (
                  <div className="pt-3 mt-3 border-t border-[#D8C9AE]/40">
                    <button
                      type="button"
                      onClick={() => onSwitchUser(roleDef.sampleUser)}
                      className="w-full py-1.5 px-3 rounded-lg text-xs font-sans font-semibold bg-[#F0EAE1] hover:bg-[#71845B] hover:text-white text-[#292A26] border border-[#D8C9AE] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Switch to {roleDef.sampleUserName.split(' ')[0]}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

    </motion.div>
  );
};
