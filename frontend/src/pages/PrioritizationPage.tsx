import React, { useState, useEffect } from 'react';
import { Zap, ArrowRight, BarChart3 } from 'lucide-react';
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
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/30 tracking-wide">
            ENGINEERING INNOVATION // RISK TRIAGE
          </span>
          <span className="text-xs text-[#77766E] font-sans">Deterministic Risk Ranking</span>
        </div>
        <h1 className="type-page-title flex items-center gap-2.5">
          <Zap className="w-6 h-6 text-[#71845B] shrink-0" />
          Evidence-Driven Review Prioritization Engine
        </h1>
        <p className="text-xs sm:text-sm text-[#77766E] mt-1 font-sans leading-relaxed">
          Surfaces high-risk steel surface defects first using transparent multi-factor scoring: model uncertainty, defect probability, batch recurrence, and overdue corrective actions.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-[rgba(201,121,88,0.12)] border border-[#C97958]/40 rounded-xl text-[#C97958] text-xs font-sans">
          {error}
        </div>
      )}

      {/* Benchmark Evaluation Showcase */}
      {benchmark && (
        <div className="industrial-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#71845B] shrink-0" />
              <h2 className="text-sm font-semibold text-[#292A26] font-sans">
                Measurable Benchmark: Evidence-Driven Prioritization vs Standard FIFO
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums px-2.5 py-1 rounded-xl bg-[rgba(113,132,91,0.12)] text-[#5E704B] border border-[#71845B]/40 font-semibold">
              +{benchmark.evidence_driven_priority.efficiency_gain_pct}% Efficiency Gain
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl font-sans">
              <span className="type-label-meta block mb-1.5">Time to 1st Critical Defect</span>
              <div className="flex items-baseline gap-2">
                <span className="type-kpi-value text-[#5E704B]">
                  {benchmark.evidence_driven_priority.time_to_first_critical_defect_min} min
                </span>
                <span className="text-xs text-[#96958B] line-through font-mono tabular-nums">
                  {benchmark.fifo_baseline.time_to_first_critical_defect_min} min FIFO
                </span>
              </div>
              <p className="text-xs text-[#77766E] mt-1 font-sans">Faster defect isolation on production line</p>
            </div>

            <div className="p-4 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl font-sans">
              <span className="type-label-meta block mb-1.5">High-Risk Coverage in Top 20%</span>
              <div className="flex items-baseline gap-2">
                <span className="type-kpi-value text-[#71845B]">
                  {(benchmark.evidence_driven_priority.high_risk_coverage_rate * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-[#96958B] line-through font-mono tabular-nums">20% FIFO</span>
              </div>
              <p className="text-xs text-[#77766E] mt-1 font-sans">Concentrates critical items in early reviews</p>
            </div>

            <div className="p-4 bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl font-sans">
              <span className="type-label-meta block mb-1.5">Total Queue Items Analyzed</span>
              <div className="type-kpi-value text-[#292A26]">
                {benchmark.total_items_in_backlog}
              </div>
              <p className="text-xs text-[#77766E] mt-1 font-sans">Real-time risk computed across backlog</p>
            </div>
          </div>

          <p className="text-xs text-[#77766E] mt-3 pt-3 border-t border-[#D8C9AE] italic font-sans leading-relaxed">
            "{benchmark.comparison_summary}"
          </p>
        </div>
      )}

      {/* Prioritized Review Queue */}
      <div className="industrial-card p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#292A26] font-sans">Risk-Ranked Review Queue</h2>
            <p className="text-xs text-[#77766E] font-sans">Sorted by deterministic composite risk score</p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#77766E]">{queue.length} inspections awaiting review</span>
        </div>

        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="p-8 text-center text-[#77766E] text-xs font-sans">
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
                      ? 'bg-[rgba(201,121,88,0.08)] border-[#C97958]/50 hover:border-[#C97958]'
                      : isHigh
                      ? 'bg-[rgba(196,154,82,0.08)] border-[#C49A52]/50 hover:border-[#C49A52]'
                      : 'bg-[#FFFCF6] border-[#D8C9AE] hover:border-[#B5A58B]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    {/* Item Identifiers */}
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold border shrink-0 ${
                        isCritical
                          ? 'bg-[rgba(201,121,88,0.18)] text-[#C97958] border-[#C97958]/50'
                          : isHigh
                          ? 'bg-[rgba(196,154,82,0.18)] text-[#A07834] border-[#C49A52]/50'
                          : 'bg-[#F0EAE1] text-[#292A26] border-[#D8C9AE]'
                      }`}>
                        <span className="text-sm tabular-nums">{item.priority_score.toFixed(0)}</span>
                        <span className="text-[9px] uppercase tracking-tighter">SCORE</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-[#292A26] text-sm">
                            {insp.item_identifier}
                          </span>
                          <StatusBadge status={item.priority_tier} size="sm" />
                          <span className="text-[#D8C9AE] text-xs">•</span>
                          <span className="font-mono text-xs text-[#71845B] font-semibold">{insp.batch_number}</span>
                        </div>
                        <div className="text-xs text-[#77766E] mt-0.5 font-sans">
                          {insp.product_name} • Model Flag: <strong className={`font-semibold ${insp.latest_prediction === 'DEFECTIVE' ? 'text-[#C97958]' : 'text-[#71845B]'}`}>
                            {insp.latest_defect_type ? `${insp.latest_prediction} (${insp.latest_defect_type.replace('_', ' ')})` : (insp.latest_prediction || 'N/A')}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Action Trigger */}
                    <button
                      onClick={() => onSelectInspection(insp.id)}
                      className="btn-primary-sage font-sans text-xs font-semibold"
                    >
                      <span>Review Case</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Explainable Factor Pills */}
                  <div className="mt-3 pt-3 border-t border-[#D8C9AE]/60 flex flex-wrap gap-2">
                    <span className="text-[11px] font-sans font-semibold text-[#77766E] uppercase tracking-wider self-center">
                      Explainable Factors:
                    </span>
                    {item.factors.map((f, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2.5 py-1 rounded-full bg-[#F0EAE1] border border-[#D8C9AE] text-[#292A26] flex items-center gap-1.5 font-sans"
                        title={f.description}
                      >
                        <span className="font-mono text-[#71845B] font-bold tabular-nums">+{f.score_contribution}</span>
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
