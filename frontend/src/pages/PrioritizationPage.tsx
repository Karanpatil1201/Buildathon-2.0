import React, { useState, useEffect } from 'react';
import { Zap, TrendingUp, CheckCircle, Clock, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, BarChart3 } from 'lucide-react';
import { PrioritizedInspection, BenchmarkMetrics } from '../types';
import { api } from '../api/client';
import { StatusBadge } from '../components/Badge';

interface PrioritizationPageProps {
  onSelectInspection: (inspectionId: number) => void;
}

export const PrioritizationPage: React.FC<PrioritizationPageProps> = ({ onSelectInspection }) => {
  const [queue, setQueue] = useState<PrioritizedInspection[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [q, b] = await Promise.all([
          api.getPrioritizationQueue(),
          api.getPrioritizationBenchmark()
        ]);
        setQueue(q);
        setBenchmark(b);
      } catch (err: any) {
        setError(err.message || 'Failed to load prioritization data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40">
            ENGINEERING INNOVATION
          </span>
          <span className="text-xs text-[#9AA0A6]">Deterministic Risk Ranking</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Zap className="w-5 h-5 text-[#A8C7FA]" />
          Evidence-Driven Review Prioritization Engine
        </h1>
        <p className="text-xs text-[#9AA0A6] mt-1">
          Surfaces high-risk casting defects first using transparent multi-factor scoring: model uncertainty, defect probability, batch recurrence, and overdue corrective actions.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-[#F28B82]/10 border border-[#F28B82]/40 rounded-xl text-[#F28B82] text-xs">
          {error}
        </div>
      )}

      {/* Benchmark Evaluation Showcase */}
      {benchmark && (
        <div className="sky-card p-5 bg-[#1E1F20] border-[#3C4043]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#A8C7FA]" />
              <h2 className="text-sm font-bold text-white">
                Measurable Benchmark: Evidence-Driven Prioritization vs Standard FIFO
              </h2>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-[#81C995]/20 text-[#81C995] border border-[#81C995]/40 font-semibold">
              +{benchmark.evidence_driven_priority.efficiency_gain_pct}% Efficiency Gain
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#202124] border border-[#3C4043] rounded-xl">
              <span className="text-xs text-[#9AA0A6] block mb-1">Time to 1st Critical Defect</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-[#81C995]">
                  {benchmark.evidence_driven_priority.time_to_first_critical_defect_min} min
                </span>
                <span className="text-xs text-[#9AA0A6] line-through">
                  {benchmark.fifo_baseline.time_to_first_critical_defect_min} min FIFO
                </span>
              </div>
              <p className="text-[11px] text-[#9AA0A6] mt-1">Faster defect isolation on production line</p>
            </div>

            <div className="p-4 bg-[#202124] border border-[#3C4043] rounded-xl">
              <span className="text-xs text-[#9AA0A6] block mb-1">High-Risk Coverage in Top 20%</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-bold text-[#A8C7FA]">
                  {(benchmark.evidence_driven_priority.high_risk_coverage_rate * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-[#9AA0A6] line-through">20% FIFO</span>
              </div>
              <p className="text-[11px] text-[#9AA0A6] mt-1">Concentrates critical items in early reviews</p>
            </div>

            <div className="p-4 bg-[#202124] border border-[#3C4043] rounded-xl">
              <span className="text-xs text-[#9AA0A6] block mb-1">Total Queue Items Analyzed</span>
              <div className="text-2xl font-mono font-bold text-white">
                {benchmark.total_items_in_backlog}
              </div>
              <p className="text-[11px] text-[#9AA0A6] mt-1">Real-time risk computed across backlog</p>
            </div>
          </div>

          <p className="text-xs text-[#9AA0A6] mt-3 pt-3 border-t border-[#3C4043] italic">
            "{benchmark.comparison_summary}"
          </p>
        </div>
      )}

      {/* Prioritized Review Queue */}
      <div className="sky-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Risk-Ranked Review Queue</h2>
            <p className="text-xs text-[#9AA0A6]">Sorted by deterministic composite risk score</p>
          </div>
          <span className="text-xs font-mono text-[#9AA0A6]">{queue.length} inspections awaiting review</span>
        </div>

        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="p-8 text-center text-[#9AA0A6] text-xs">
              No pending inspections currently in the review backlog.
            </div>
          ) : (
            queue.map((item) => {
              const insp = item.inspection;
              const isCritical = item.priority_tier === 'CRITICAL';
              const isHigh = item.priority_tier === 'HIGH';

              return (
                <div
                  key={insp.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isCritical
                      ? 'bg-[#F28B82]/10 border-[#F28B82]/40 hover:border-[#F28B82]'
                      : isHigh
                      ? 'bg-[#FDD663]/10 border-[#FDD663]/40 hover:border-[#FDD663]'
                      : 'bg-[#202124] border-[#3C4043] hover:border-[#5F6368]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Item Identifiers */}
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold border ${
                        isCritical
                          ? 'bg-[#F28B82]/20 text-[#F28B82] border-[#F28B82]/50'
                          : isHigh
                          ? 'bg-[#FDD663]/20 text-[#FDD663] border-[#FDD663]/50'
                          : 'bg-[#303134] text-[#E3E3E3] border-[#3C4043]'
                      }`}>
                        <span className="text-sm">{item.priority_score.toFixed(0)}</span>
                        <span className="text-[9px] uppercase tracking-tighter">SCORE</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm">
                            {insp.item_identifier}
                          </span>
                          <StatusBadge status={item.priority_tier} size="sm" />
                          <span className="text-[#9AA0A6] text-xs">•</span>
                          <span className="font-mono text-xs text-[#A8C7FA]">{insp.batch_number}</span>
                        </div>
                        <div className="text-xs text-[#9AA0A6] mt-0.5">
                          {insp.product_name} • Model Flag: <strong className={insp.latest_prediction === 'DEFECTIVE' ? 'text-[#F28B82]' : 'text-[#E3E3E3]'}>
                            {insp.latest_prediction || 'N/A'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Trigger */}
                    <button
                      onClick={() => onSelectInspection(insp.id)}
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#A8C7FA] hover:bg-[#C2E7FF] text-[#041E49] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                    >
                      <span>Review Case</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Explainable Factor Pills */}
                  <div className="mt-3 pt-3 border-t border-[#3C4043] flex flex-wrap gap-2">
                    <span className="text-[10px] font-mono text-[#9AA0A6] uppercase self-center">
                      Explainable Factors:
                    </span>
                    {item.factors.map((f, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2.5 py-1 rounded-full bg-[#303134] border border-[#3C4043] text-[#E3E3E3] flex items-center gap-1.5"
                        title={f.description}
                      >
                        <span className="text-[#A8C7FA] font-bold">+{f.score_contribution}</span>
                        <span>{f.factor_name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
