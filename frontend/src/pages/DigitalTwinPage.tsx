import React, { useState } from 'react';
import AgenticFactory3D, { StationId } from '../components/ui/agentic-factory-3d';
import { DashboardMetrics } from '../types';
import {
  Camera,
  Cpu,
  UserCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  Maximize2,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  Scan
} from 'lucide-react';

interface DigitalTwinPageProps {
  metrics: DashboardMetrics | null;
  onNavigate: (tab: string) => void;
}

interface StationInfo {
  id: StationId;
  step: string;
  name: string;
  subtitle: string;
  icon: React.ElementType;
  description: string;
  specs: { label: string; value: string }[];
  targetTab?: string;
  actionText?: string;
}

export const DigitalTwinPage: React.FC<DigitalTwinPageProps> = ({ metrics, onNavigate }) => {
  const [selectedStation, setSelectedStation] = useState<StationId>('capture');

  const STATIONS_DATA: Record<StationId, StationInfo> = {
    infeed: {
      id: 'infeed',
      step: '01',
      name: 'Tile Conveyor Infeed',
      subtitle: 'Raw Vitrified Porcelain Intake',
      icon: Layers,
      description: 'Continuous roller conveyor intake accepting 600×600 mm unglazed & glazed porcelain slabs. Features dual-axis pneumatic edge centering to align tiles precisely within ±0.2 mm of the optical inspection axis.',
      specs: [
        { label: 'Bed Dimension', value: '600×600 mm' },
        { label: 'Conveyor Speed', value: '1.2 m/s' },
        { label: 'Centering Tolerance', value: '±0.2 mm' },
        { label: 'Daily Intake', value: `${metrics?.total_inspected_items ?? 18} slabs logged` }
      ],
      targetTab: 'new_inspection',
      actionText: 'Ingest New Inspection Image'
    },
    capture: {
      id: 'capture',
      step: '02',
      name: 'Optical Image Capture Gantry',
      subtitle: '4K Multi-Spectrum Glaze Surface Rig',
      icon: Camera,
      description: 'Overhead optical inspection gantry equipped with dual 4K CMOS line-scan cameras and twin high-CRI strobe arrays. Captures specular reflections to identify micro-cracks, pinholes, and glaze inconsistencies before neural classification.',
      specs: [
        { label: 'Optical Resolution', value: '0.12 mm/px' },
        { label: 'Illumination', value: '5500K Dual Strobe LED' },
        { label: 'Frame Rate', value: '120 fps continuous' },
        { label: 'Evidence Capture', value: 'Lossless PNG RAW' }
      ],
      targetTab: 'new_inspection',
      actionText: 'Capture & Run Live AI'
    },
    ai_engine: {
      id: 'ai_engine',
      step: '03',
      name: 'AI Vision Inference Engine',
      subtitle: 'MobileNetV3 Neural Network & Grad-CAM',
      icon: Cpu,
      description: 'Local edge compute server executing MobileNetV3 PyTorch model fine-tuned on industrial manufacturing surfaces. Generates class confidence, defect classification, and Grad-CAM spatial localization heatmaps with sub-50ms CPU latency.',
      specs: [
        { label: 'Model Architecture', value: 'MobileNetV3-Small' },
        { label: 'Held-Out Test Acc', value: '87.97% benchmark' },
        { label: 'Inference Latency', value: '38–48 ms CPU' },
        { label: 'Explainability', value: 'Layer Grad-CAM Heatmap' }
      ],
      targetTab: 'prioritization',
      actionText: 'View Review Prioritization Queue'
    },
    human_review: {
      id: 'human_review',
      step: '04',
      name: 'Human Review Workbench',
      subtitle: 'Mandatory Separation of Duties',
      icon: UserCheck,
      description: 'Quality inspector disposition terminal. AI predictions are suggestions only; certified human inspectors must independently confirm, challenge, or modify AI defect classifications before batches can be cleared.',
      specs: [
        { label: 'Compliance Policy', value: 'Separation of Duties' },
        { label: 'Pending Reviews', value: `${metrics?.pending_reviews ?? 4} awaiting disposition` },
        { label: 'Audit Trail', value: 'Timestamped User ID' },
        { label: 'Review SLA', value: '< 15 mins/lot' }
      ],
      targetTab: 'review',
      actionText: 'Open Human Review Workbench'
    },
    defect_tracking: {
      id: 'defect_tracking',
      step: '05',
      name: 'Defect Tracking & CAPA Log',
      subtitle: 'Root Cause & SLA Accountability',
      icon: AlertTriangle,
      description: 'Automated digital traveler generation linking defect severity, defect classification (crack, chip, pinhole), batch ID, and corrective actions (CAPA). Tracks kiln cooling rates, glaze viscosity, and maintenance deadlines.',
      specs: [
        { label: 'Confirmed Defects', value: `${metrics?.confirmed_defects ?? 6} active` },
        { label: 'Open Actions', value: `${metrics?.open_corrective_actions ?? 4} CAPA items` },
        { label: 'Overdue Actions', value: metrics?.overdue_actions ? `${metrics.overdue_actions} late` : '0 late (On track)' },
        { label: 'Standard', value: 'ISO 9001 / 8D CAPA' }
      ],
      targetTab: 'defects',
      actionText: 'Manage Defects & Actions'
    },
    quality_gate: {
      id: 'quality_gate',
      step: '06',
      name: 'Pneumatic Quality Gate',
      subtitle: 'Pass / Quarantine Diverter',
      icon: Scan,
      description: 'High-speed pneumatic diverter mechanism routing inspected tiles based on human-reviewed disposition. Defect-free slabs proceed directly to automated packaging; defect-flagged slabs divert to quarantine buffer for containment.',
      specs: [
        { label: 'Mechanism', value: 'Pneumatic High-Speed Arm' },
        { label: 'Switch Time', value: '85 ms actuator' },
        { label: 'Discharge Lanes', value: 'Pass (Green) / Hold (Red)' },
        { label: 'Lot Disposition', value: 'Manual Hold/Release Sync' }
      ],
      targetTab: 'batches',
      actionText: 'View Batch Hold/Release Records'
    },
    reinspection: {
      id: 'reinspection',
      step: '07',
      name: 'Corrective Action & Reinspection Bay',
      subtitle: 'Closed-Loop Verification',
      icon: RotateCcw,
      description: 'Secondary verification loop for remediated or re-fired tiles. Ensures all corrective actions undergo optical re-evaluation before quarantine hold can be lifted and batch release authorized.',
      specs: [
        { label: 'Reinspection Mode', value: 'Multi-Scan Verification' },
        { label: 'Parent Defect Link', value: 'Bidirectional Trace' },
        { label: 'Line Clearance', value: 'Quality Manager Required' },
        { label: 'Pass Rate', value: '94.2% post-rework' }
      ],
      targetTab: 'defects',
      actionText: 'Verify Corrective Actions'
    }
  };

  const activeData = STATIONS_DATA[selectedStation];
  const IconComponent = activeData.icon;

  const handleStationClick = (id: StationId) => {
    setSelectedStation(id);
    if (window.__machine) {
      window.__machine.focusStation(id);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Banner with Model Transparency */}
      <div className="sky-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[#A8C7FA] animate-pulse shrink-0" />
            <h1 className="text-base font-bold text-white font-mono tracking-wide uppercase">
              3D Digital Twin — Ceramic Inspection Line 01
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40 shrink-0">
              PROCEDURAL THREE.JS
            </span>
          </div>
          <p className="text-xs text-[#9AA0A6] mt-1">
            Real-time interactive 3D miniature factory twin. Follow porcelain tiles through infeed, optical scanning, MobileNetV3 AI inference, human review, defect tagging, and pneumatic gating.
          </p>
        </div>

        {/* Model Domain Limitations Notice */}
        <div className="bg-[#202124] border border-[#3C4043] rounded-xl p-3 text-xs text-[#E3E3E3] max-w-md shrink-0">
          <div className="flex items-center gap-1.5 text-[#FDD663] font-mono text-[11px] font-semibold mb-0.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Operational Notice: Model Weights Domain</span>
          </div>
          <p className="text-[11px] text-[#9AA0A6] leading-snug">
            Current live PyTorch weights (<code className="text-[#A8C7FA]">casting_mobilenet_v3.pth</code>) are benchmarked on industrial casting baseline. Ceramic tile transfer training is queued.
          </p>
        </div>
      </div>

      {/* Main 3D Container & Interactive Station Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3D Scene Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-[#1E1F20] border border-[#3C4043] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col">
          {/* Viewport Top Bar */}
          <div className="px-4 py-2.5 bg-[#202124] border-b border-[#3C4043] flex items-center justify-between text-xs font-mono text-[#9AA0A6]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#81C995]" />
              <span>RIG SENSORS: ONLINE</span>
              <span className="text-[#3C4043]">|</span>
              <span>ORBIT: ENABLED</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#9AA0A6]">CLICK STATION OR DRAG TO ROTATE</span>
            </div>
          </div>

          {/* Embedded 3D Scene */}
          <div className="relative w-full h-[540px] bg-black">
            <AgenticFactory3D
              height="100%"
              activeStationId={selectedStation}
              onStation={handleStationClick}
            />
          </div>

          {/* Quick Station Navigation Strip */}
          <div className="px-3 py-2.5 bg-[#1E1F20] border-t border-[#3C4043] flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[10px] font-mono uppercase text-[#9AA0A6] mr-1 shrink-0">Stations:</span>
            {(Object.keys(STATIONS_DATA) as StationId[]).map((stId) => {
              const st = STATIONS_DATA[stId];
              const isSelected = selectedStation === stId;
              return (
                <button
                  key={stId}
                  onClick={() => handleStationClick(stId)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-mono shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40 font-bold'
                      : 'bg-[#202124] hover:bg-[#303134] text-[#9AA0A6] hover:text-white border border-[#3C4043]'
                  }`}
                >
                  <span>{st.step}</span>
                  <span>{st.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Station Telemetry & Action Drawer (4 Cols) */}
        <div className="lg:col-span-4 sky-card p-5 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            {/* Active Station Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#3C4043]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-[#004A77] border border-[#A8C7FA]/40 text-[#C2E7FF] font-mono text-xs font-bold">
                    STATION {activeData.step}
                  </span>
                  <span className="text-[10px] font-mono text-[#81C995] uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#81C995]" />
                    Operational
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-1.5">{activeData.name}</h2>
                <p className="text-xs text-[#9AA0A6]">{activeData.subtitle}</p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[#202124] border border-[#3C4043] flex items-center justify-center text-[#A8C7FA] shrink-0">
                <IconComponent className="w-5 h-5" />
              </div>
            </div>

            {/* Description */}
            <div className="text-xs text-[#E3E3E3] leading-relaxed bg-[#202124] p-3 rounded-xl border border-[#3C4043]">
              {activeData.description}
            </div>

            {/* Technical Specifications & Telemetry */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#9AA0A6]">
                Station Engineering Specs
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {activeData.specs.map((spec, i) => (
                  <div key={i} className="bg-[#202124] p-2.5 rounded-xl border border-[#3C4043]">
                    <div className="text-[10px] font-mono text-[#9AA0A6] uppercase">{spec.label}</div>
                    <div className="text-xs font-mono font-semibold text-[#E3E3E3] mt-0.5">{spec.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Progression Map */}
            <div className="p-3 bg-[#202124] rounded-xl border border-[#3C4043] text-xs">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#9AA0A6] mb-2">
                <span>Inspection Progression</span>
                <span>Stage {activeData.step} / 07</span>
              </div>
              <div className="w-full h-1.5 bg-[#303134] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#A8C7FA] to-[#81C995] rounded-full transition-all duration-300"
                  style={{ width: `${(parseInt(activeData.step) / 7) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Button linking to real product workflow */}
          <div className="pt-4 border-t border-[#3C4043]">
            {activeData.targetTab && activeData.actionText ? (
              <button
                onClick={() => onNavigate(activeData.targetTab!)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] font-bold text-xs transition-all cursor-pointer shadow-sm active:scale-98"
              >
                <span>{activeData.actionText}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
