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
  RotateCcw,
  ShieldAlert,
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
      name: 'Component Infeed Conveyor',
      subtitle: 'Raw Vitrified Intake Gantry',
      icon: Layers,
      description: 'Continuous roller conveyor intake accepting unglazed & glazed slabs. Features dual-axis pneumatic edge centering to align pieces precisely within ±0.2 mm of the optical inspection axis.',
      specs: [
        { label: 'Bed Dimension', value: '600×600 mm' },
        { label: 'Conveyor Speed', value: '1.2 m/s' },
        { label: 'Centering Tolerance', value: '±0.2 mm' },
        { label: 'Daily Intake', value: `${metrics?.total_inspected_items ?? 18} units logged` }
      ],
      targetTab: 'new_inspection',
      actionText: 'Ingest New Inspection Image'
    },
    capture: {
      id: 'capture',
      step: '02',
      name: 'Optical Image Capture Gantry',
      subtitle: '4K Multi-Spectrum Surface Rig',
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
      description: 'High-speed pneumatic diverter mechanism routing inspected parts based on human-reviewed disposition. Defect-free items proceed directly to automated packaging; defect-flagged items divert to quarantine buffer for containment.',
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
      description: 'Secondary verification loop for remediated or re-fired components. Ensures all corrective actions undergo optical re-evaluation before quarantine hold can be lifted and batch release authorized.',
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
      <div className="industrial-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-[#71845B] animate-pulse shrink-0" />
            <h1 className="text-base font-bold text-[#292A26] font-sans tracking-tight uppercase">
              3D Digital Twin — Inspection Line 01
            </h1>
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-sans font-semibold uppercase tracking-wider bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/40 shrink-0">
              PROCEDURAL THREE.JS
            </span>
          </div>
          <p className="text-xs text-[#77766E] mt-0.5 leading-relaxed font-sans">
            Real-time interactive 3D miniature factory twin. Follow components through infeed, optical scanning, MobileNetV3 AI inference, human review, defect tagging, and pneumatic gating.
          </p>
        </div>

        {/* Model Domain Limitations Notice */}
        <div className="bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl p-3 text-xs text-[#292A26] max-w-md shrink-0 font-sans">
          <div className="flex items-center gap-1.5 text-[#A07834] font-sans text-[11px] font-semibold mb-0.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Operational Notice: Model Weights Domain</span>
          </div>
          <p className="text-[11px] text-[#77766E] leading-snug">
            Current live PyTorch weights (<code className="font-mono text-[11px] text-[#71845B] font-medium">casting_mobilenet_v3.pth</code>) are benchmarked on hot-rolled steel surface baseline. Grad-CAM enabled.
          </p>
        </div>
      </div>

      {/* Main 3D Container & Interactive Station Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* 3D Scene Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl overflow-hidden shadow-sm relative flex flex-col">
          {/* Viewport Top Bar */}
          <div className="px-4 py-2 bg-[#F0EAE1] border-b border-[#D8C9AE] flex items-center justify-between text-xs font-mono tabular-nums text-[#77766E]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#71845B]" />
              <span>RIG SENSORS: ONLINE</span>
              <span className="text-[#D8C9AE]">|</span>
              <span>ORBIT: ENABLED</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-[#77766E]">CLICK STATION OR DRAG TO ROTATE</span>
            </div>
          </div>

          {/* Embedded 3D Scene */}
          <div className="relative w-full h-[540px] bg-[#1a1b18]">
            <AgenticFactory3D
              height="100%"
              activeStationId={selectedStation}
              onStation={handleStationClick}
            />
          </div>

          {/* Quick Station Navigation Strip */}
          <div className="px-3 py-2.5 bg-[#FFFCF6] border-t border-[#D8C9AE] flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="type-label-meta mr-1 shrink-0 text-[#77766E]">Stations:</span>
            {(Object.keys(STATIONS_DATA) as StationId[]).map((stId) => {
              const st = STATIONS_DATA[stId];
              const isSelected = selectedStation === stId;
              return (
                <button
                  key={stId}
                  onClick={() => handleStationClick(stId)}
                  className={`px-3 py-1.5 rounded-xl text-xs shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#71845B] text-[#FFFFFF] font-semibold shadow-xs'
                      : 'bg-[#F0EAE1] hover:bg-[#EBE4D8] text-[#77766E] hover:text-[#292A26] border border-[#D8C9AE]'
                  }`}
                >
                  <span className="font-mono tabular-nums font-semibold">{st.step}</span>
                  <span className="font-sans font-medium">{st.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Station Telemetry & Action Drawer (4 Cols) */}
        <div className="lg:col-span-4 industrial-card p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-4">
            {/* Active Station Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#D8C9AE]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-[rgba(113,132,91,0.12)] border border-[#71845B]/40 text-[#5E704B] font-mono tabular-nums text-xs font-bold">
                    STATION {activeData.step}
                  </span>
                  <span className="text-[10px] font-sans text-[#5E704B] uppercase tracking-wider flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71845B]" />
                    Operational
                  </span>
                </div>
                <h2 className="type-section-title mt-1.5">{activeData.name}</h2>
                <p className="text-xs text-[#77766E] font-sans">{activeData.subtitle}</p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-[rgba(113,132,91,0.12)] border border-[#71845B]/30 flex items-center justify-center text-[#71845B] shrink-0">
                <IconComponent className="w-5 h-5" />
              </div>
            </div>

            {/* Description */}
            <div className="text-xs text-[#292A26] leading-relaxed bg-[#F0EAE1] p-3 rounded-xl border border-[#D8C9AE] font-sans">
              {activeData.description}
            </div>

            {/* Technical Specifications & Telemetry */}
            <div className="space-y-2">
              <h3 className="type-label-meta text-[#77766E]">
                Station Engineering Specs
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {activeData.specs.map((spec, i) => (
                  <div key={i} className="bg-[#F0EAE1] p-2.5 rounded-xl border border-[#D8C9AE]">
                    <div className="text-[10px] font-sans font-medium text-[#77766E] uppercase tracking-wider">{spec.label}</div>
                    <div className="text-xs font-mono tabular-nums font-semibold text-[#292A26] mt-0.5">{spec.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Progression Map */}
            <div className="p-3 bg-[#F0EAE1] rounded-xl border border-[#D8C9AE] text-xs">
              <div className="flex items-center justify-between text-[11px] font-sans text-[#77766E] mb-2 font-medium">
                <span>Inspection Progression</span>
                <span className="font-mono tabular-nums font-semibold">Stage {activeData.step} / 07</span>
              </div>
              <div className="w-full h-1.5 bg-[#D8C9AE]/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#71845B] rounded-full transition-all duration-300"
                  style={{ width: `${(parseInt(activeData.step) / 7) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Action Button linking to real product workflow */}
          <div className="pt-4 border-t border-[#D8C9AE]">
            {activeData.targetTab && activeData.actionText ? (
              <button
                onClick={() => onNavigate(activeData.targetTab!)}
                className="w-full btn-primary-sage font-sans text-xs font-semibold"
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
