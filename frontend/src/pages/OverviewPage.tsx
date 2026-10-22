import React from 'react';
import {
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Camera,
  Sparkles,
  Info,
  Box
} from 'lucide-react';
import { DashboardMetrics } from '../types';
import { StatusBadge } from '../components/Badge';

interface OverviewPageProps {
  metrics: DashboardMetrics | null;
  onNavigate: (tab: string, filter?: any) => void;
  onViewInspection: (inspectionId: number) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  metrics,
  onNavigate,
  onViewInspection
}) => {
  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-48 text-[#8E918F] font-mono text-xs">
        Loading quality assurance telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Industrial Domain & Compliance Notice */}
      <div className="p-4 bg-[#1E1F20] border border-[#3C4043] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#004A77]/40 text-[#A8C7FA] border border-[#A8C7FA]/30 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-[#E3E3E3] font-semibold">
              <span>QC STAGE: OPTICAL SURFACE INSPECTION</span>
              <span className="text-[10px] text-[#FDD663] bg-[rgba(253,214,99,0.12)] border border-[#FDD663]/30 px-2 py-0.5 rounded font-mono">
                BASELINE CASTING WEIGHTS
              </span>
            </div>
            <p className="text-[11px] text-[#C4C7C5] mt-0.5">
              Active model runs fine-tuned MobileNetV3 (87.97% test accuracy). Ceramic-tile transfer learning dataset integration in progress.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate('digital_twin')}
            className="min-h-[44px] flex items-center gap-1.5 bg-[#303134] hover:bg-[#3C4043] text-[#E3E3E3] font-mono text-xs px-3.5 py-2 rounded-xl border border-[#3C4043] transition-colors cursor-pointer"
          >
            <Box className="w-3.5 h-3.5 text-[#A8C7FA]" />
            <span>3D Twin</span>
          </button>
          <button
            onClick={() => onNavigate('new_inspection')}
            className="min-h-[44px] flex items-center gap-1.5 bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] font-mono text-xs font-semibold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>New Scan</span>
          </button>
          <button
            onClick={() => onNavigate('copilot')}
            className="min-h-[44px] flex items-center gap-1.5 bg-[#303134] hover:bg-[#3C4043] text-[#E3E3E3] font-mono text-xs px-3.5 py-2 rounded-xl border border-[#3C4043] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#A8C7FA]" />
            <span>Copilot</span>
          </button>
        </div>
      </div>

      {/* Compact 4-Metric Primary Status Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Metric 1: Inspected Units */}
        <div
          onClick={() => onNavigate('review')}
          className="industrial-card p-4 hover:border-[#5F6368] cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-[#8E918F] text-xs font-mono mb-1">
            <span>INSPECTED PARTS</span>
            <CheckCircle2 className="w-4 h-4 text-[#A8C7FA]" />
          </div>
          <div className="text-2xl font-mono font-bold text-[#FFFFFF]">
            {metrics.total_inspected_items}
          </div>
          <p className="text-[10px] text-[#8E918F] mt-0.5">Distinct evaluated pieces</p>
        </div>

        {/* Metric 2: Defect Rate */}
        <div className="industrial-card p-4 hover:border-[#5F6368]">
          <div className="flex items-center justify-between text-[#8E918F] text-xs font-mono mb-1">
            <span>PLANT DEFECT RATE</span>
            <TrendingUp className="w-4 h-4 text-[#F28B82]" />
          </div>
          <div className="text-2xl font-mono font-bold text-[#F28B82]">
            {metrics.overall_defect_rate}%
          </div>
          <p className="text-[10px] text-[#8E918F] mt-0.5">Confirmed defects / items</p>
        </div>

        {/* Metric 3: Pending Reviews */}
        <div
          onClick={() => onNavigate('review')}
          className="industrial-card p-4 hover:border-[#FDD663]/50 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-[#8E918F] text-xs font-mono mb-1">
            <span>AWAITING SIGN-OFF</span>
            <Clock className="w-4 h-4 text-[#FDD663]" />
          </div>
          <div className="text-2xl font-mono font-bold text-[#FDD663]">
            {metrics.pending_reviews}
          </div>
          <p className="text-[10px] text-[#8E918F] mt-0.5">Requires inspector review</p>
        </div>

        {/* Metric 4: Overdue Actions */}
        <div
          onClick={() => onNavigate('defects', { overdueOnly: true })}
          className="industrial-card p-4 hover:border-[#F28B82]/50 cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-[#8E918F] text-xs font-mono mb-1">
            <span>OVERDUE REMEDIATIONS</span>
            <AlertCircle className="w-4 h-4 text-[#F28B82]" />
          </div>
          <div className={`text-2xl font-mono font-bold ${metrics.overdue_actions > 0 ? 'text-[#F28B82]' : 'text-[#C4C7C5]'}`}>
            {metrics.overdue_actions}
          </div>
          <p className="text-[10px] text-[#8E918F] mt-0.5">Past committed target SLA</p>
        </div>
      </div>

      {/* Main Grid: Recent Activity & Trend Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Recent Inspection Activity Table (8 Cols) */}
        <div className="lg:col-span-8 industrial-card p-5 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#3C4043]">
            <div>
              <h2 className="text-xs font-bold text-[#E3E3E3] font-mono uppercase tracking-wider">
                Inspection Activity Stream
              </h2>
              <p className="text-[11px] text-[#8E918F]">Chronological list of component optical scans</p>
            </div>
            <button
              onClick={() => onNavigate('review')}
              className="text-xs font-mono text-[#A8C7FA] hover:text-[#C2E7FF] flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#3C4043] text-[#8E918F] uppercase font-mono text-[10px]">
                  <th className="py-2.5 px-3">Item Identifier</th>
                  <th className="py-2.5 px-3">Batch</th>
                  <th className="py-2.5 px-3">Model Flag</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3C4043]/60 font-mono">
                {metrics.recent_inspections.map((insp) => (
                  <tr key={insp.id} className="hover:bg-[#282A2C] transition-colors">
                    <td className="py-3 px-3 font-bold text-[#E3E3E3]">
                      {insp.item_identifier}
                    </td>
                    <td className="py-3 px-3 text-[#C4C7C5]">
                      {insp.batch_number}
                    </td>
                    <td className="py-3 px-3">
                      {insp.latest_prediction ? (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                          insp.latest_prediction === 'DEFECTIVE' ? 'text-[#F28B82]' : 'text-[#81C995]'
                        }`}>
                          {insp.latest_prediction}
                        </span>
                      ) : (
                        <span className="text-[#8E918F]">Unprocessed</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#C4C7C5] text-[11px]">
                      {insp.latest_confidence !== null && insp.latest_confidence !== undefined
                        ? `${(insp.latest_confidence * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={insp.status} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onViewInspection(insp.id)}
                        className="text-[#A8C7FA] hover:text-[#C2E7FF] font-mono text-xs cursor-pointer font-medium"
                      >
                        [Open]
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Trend & Innovation Widget (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Trend Card */}
          <div className="industrial-card p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#3C4043]">
              <span className="text-xs font-bold text-[#E3E3E3] font-mono uppercase tracking-wider">
                7-Day Run Trend
              </span>
              <span className="text-[10px] font-mono text-[#8E918F]">Daily Units</span>
            </div>

            <div className="h-36 flex items-end justify-between gap-2 pt-2 px-1 border-b border-[#3C4043]/80">
              {metrics.trend_history.map((pt, idx) => {
                const maxCount = Math.max(...metrics.trend_history.map(t => t.inspected_count), 5);
                const heightPct = Math.min(100, Math.max(14, (pt.inspected_count / maxCount) * 100));

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <div className="w-full flex items-end justify-center h-28">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className="w-full max-w-[20px] rounded-t bg-[#303134] group-hover:bg-[#A8C7FA] transition-colors relative"
                      >
                        {pt.defect_count > 0 && (
                          <div
                            style={{ height: `${Math.min(100, (pt.defect_count / pt.inspected_count) * 100)}%` }}
                            className="w-full rounded-t bg-[#F28B82] absolute bottom-0 left-0"
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-[#8E918F]">{pt.date.split(' ')[1] || pt.date}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-[#8E918F]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#303134] border border-[#3C4043]" />
                <span>Passed Scans</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-[#F28B82]" />
                <span>Confirmed Flaws</span>
              </div>
            </div>
          </div>

          {/* Quick Review Prioritization Shortcut */}
          <div className="industrial-card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#E3E3E3] font-mono uppercase tracking-wider">
                Prioritized Triage
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#004A77]/40 text-[#C2E7FF] border border-[#A8C7FA]/40 font-medium">
                +82.7% GAIN
              </span>
            </div>
            <p className="text-[11px] text-[#C4C7C5] leading-relaxed">
              Prioritizes unreviewed scans by model uncertainty and batch defect recurrence over chronological FIFO order.
            </p>
            <button
              onClick={() => onNavigate('prioritization')}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#303134] hover:bg-[#3C4043] text-[#E3E3E3] border border-[#3C4043] text-xs font-mono font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Open Prioritized Backlog</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#A8C7FA]" />
            </button>
          </div>

          {/* 3D Ceramic Line Digital Twin Promo Card */}
          <div className="industrial-card p-4 space-y-2.5 bg-[#1E1F20]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#A8C7FA] animate-pulse" />
                <span className="text-xs font-bold text-[#E3E3E3] font-mono uppercase tracking-wider">
                  3D Line Digital Twin
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#004A77]/40 text-[#C2E7FF] border border-[#A8C7FA]/40">
                7 STATIONS
              </span>
            </div>
            <p className="text-[11px] text-[#C4C7C5] leading-relaxed">
              Interactive 3D procedural simulation of ceramic tile infeed, 4K optical scan gantry, MobileNetV3 inference, human review, and pneumatic quality gating.
            </p>
            <button
              onClick={() => onNavigate('digital_twin')}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-[#303134] hover:bg-[#3C4043] text-[#E3E3E3] border border-[#3C4043] text-xs font-mono font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span>Launch 3D Inspection Twin</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#A8C7FA]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
