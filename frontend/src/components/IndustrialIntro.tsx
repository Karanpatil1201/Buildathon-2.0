import React, { useState, useEffect } from 'react';
import { Eye, ShieldCheck, SkipForward } from 'lucide-react';

interface IndustrialIntroProps {
  onComplete: () => void;
}

export const IndustrialIntro: React.FC<IndustrialIntroProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'enter' | 'scan' | 'defect' | 'brand' | 'exit'>('enter');

  useEffect(() => {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      onComplete();
      return;
    }

    // Sequence timeline (~2.6s total)
    // 0.0s - 0.6s: Tile enters on conveyor
    // 0.6s - 1.4s: Laser scanner sweeps
    // 1.4s - 2.0s: Flaw bounding box / defect marker identifies
    // 2.0s - 2.6s: Brand lockup & tagline
    // 2.6s+: Fade out and complete

    const t1 = setTimeout(() => setPhase('scan'), 600);
    const t2 = setTimeout(() => setPhase('defect'), 1400);
    const t3 = setTimeout(() => setPhase('brand'), 2000);
    const t4 = setTimeout(() => {
      setPhase('exit');
      setTimeout(onComplete, 400);
    }, 2800);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onComplete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#131314] text-[#E3E3E3] transition-opacity duration-400 ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Skip Button */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#3C4043] bg-[#1E1F20]/90 hover:bg-[#303134] text-[#E3E3E3] hover:text-white text-xs font-mono tracking-wider transition-colors cursor-pointer z-50"
      >
        <span>SKIP INTRO [ESC]</span>
        <SkipForward className="w-3.5 h-3.5" />
      </button>

      {/* Industrial Inspection Stage Simulation */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        {/* Conveyor Grid Background */}
        <div className="absolute inset-0 rounded-2xl border border-[#3C4043] bg-[#1E1F20] overflow-hidden shadow-2xl">
          {/* Subtle Industrial Grid Lines */}
          <div
            className="w-full h-full opacity-15"
            style={{
              backgroundImage: 'linear-gradient(#5F6368 1px, transparent 1px), linear-gradient(90deg, #5F6368 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Optical Axis Crosshairs */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#3C4043]" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-[#3C4043]" />
          
          <div className="absolute top-2 left-3 text-[9px] font-mono text-[#9AA0A6] uppercase">
            STATION: CAM-01 // OPTICAL CALIBRATION
          </div>
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-[#9AA0A6] uppercase">
            STAGE: 600×600 MM BED
          </div>
        </div>

        {/* The Ceramic Tile */}
        <div
          className={`relative w-48 h-48 rounded-lg bg-[#e2e8f0] text-slate-900 shadow-xl overflow-hidden transition-all duration-700 ease-out border-2 border-slate-400 ${
            phase === 'enter'
              ? '-translate-x-32 opacity-0'
              : 'translate-x-0 opacity-100'
          }`}
        >
          {/* Tile Texture / Glaze Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1] flex flex-col justify-between p-2">
            <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
              PORCELAIN-VITRIFIED
            </span>
            <div className="flex justify-between items-end">
              <span className="text-[7px] font-mono text-slate-400">BATCH: #T-904</span>
              <span className="text-[7px] font-mono text-slate-400">LOT: 2026-A</span>
            </div>
          </div>

          {/* Scanning Laser Light Beam */}
          {(phase === 'scan' || phase === 'defect' || phase === 'brand') && (
            <div
              className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-[#A8C7FA] to-transparent shadow-[0_0_12px_#A8C7FA] transition-all duration-800 ease-linear"
              style={{
                top: phase === 'scan' ? '85%' : '45%',
                opacity: phase === 'brand' ? 0.2 : 0.9
              }}
            />
          )}

          {/* Defect Highlight Bounding Box (appears at phase 'defect') */}
          {(phase === 'defect' || phase === 'brand') && (
            <div className="absolute top-12 left-14 w-12 h-10 border-2 border-[#F28B82] rounded bg-[#F28B82]/20 animate-pulse flex flex-col justify-between p-0.5">
              <span className="text-[7px] font-mono font-bold text-[#601410] bg-[#F28B82] px-0.5 rounded leading-none w-max">
                GLAZE CRACK
              </span>
              <span className="text-[6px] font-mono text-[#F28B82] self-end font-bold">
                98.4%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Brand & Tagline Lockup */}
      <div
        className={`mt-8 text-center transition-all duration-500 ${
          phase === 'brand' || phase === 'exit'
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-3'
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-xl bg-[#004A77] border border-[#A8C7FA]/40 flex items-center justify-center text-[#A8C7FA] font-bold text-xs">
            FS
          </div>
          <h1 className="text-xl font-bold font-mono tracking-tight text-white">
            FORGESIGHT <span className="text-[#A8C7FA]">AI</span>
          </h1>
        </div>
        <p className="text-xs font-mono text-[#9AA0A6] tracking-widest uppercase">
          Precision. Inspection. Traceability.
        </p>
      </div>

      {/* Optical Status Bar */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center items-center gap-6 text-[10px] font-mono text-[#9AA0A6] uppercase">
        <span>SENSOR: ACTIVE</span>
        <span>•</span>
        <span>RESOLUTION: 0.12 MM/PX</span>
        <span>•</span>
        <span>INFERENCE: MOBILENETV3</span>
      </div>
    </div>
  );
};
