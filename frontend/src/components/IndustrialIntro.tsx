import React, { useState, useEffect } from 'react';
import { SkipForward } from 'lucide-react';

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
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F5F1E8] text-[#292A26] transition-opacity duration-400 ${
        phase === 'exit' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Skip Button */}
      <button
        onClick={onComplete}
        className="absolute top-6 right-6 flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-[#D8C9AE] bg-[#FFFCF6] hover:bg-[#F0EAE1] text-[#292A26] text-xs font-sans font-medium transition-colors cursor-pointer z-50 shadow-sm"
      >
        <span className="tracking-wide">SKIP INTRO</span>
        <span className="font-mono tabular-nums text-[10px] text-[#77766E]">[ESC]</span>
        <SkipForward className="w-3.5 h-3.5 text-[#71845B]" />
      </button>

      {/* Industrial Inspection Stage Simulation */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        {/* Conveyor Grid Background */}
        <div className="absolute inset-0 rounded-2xl border border-[#D8C9AE] bg-[#FFFCF6] overflow-hidden shadow-md">
          {/* Subtle Warm Grid Lines */}
          <div
            className="w-full h-full opacity-20"
            style={{
              backgroundImage: 'linear-gradient(#B5A58B 1px, transparent 1px), linear-gradient(90deg, #B5A58B 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          {/* Optical Axis Crosshairs */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-[#D8C9AE]" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-[#D8C9AE]" />
          
          <div className="absolute top-2 left-3 text-[9px] font-mono tabular-nums text-[#77766E] uppercase font-medium">
            STATION: CAM-01 // OPTICAL CALIBRATION
          </div>
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-[#77766E] uppercase font-medium">
            STAGE: SURFACE BED
          </div>
        </div>

        {/* The Component / Tile */}
        <div
          className={`relative w-48 h-48 rounded-lg bg-[#F0EAE1] text-[#292A26] shadow-md overflow-hidden transition-all duration-700 ease-out border-2 border-[#D8C9AE] ${
            phase === 'enter'
              ? '-translate-x-32 opacity-0'
              : 'translate-x-0 opacity-100'
          }`}
        >
          {/* Surface Texture */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#FFFCF6] via-[#F0EAE1] to-[#E6DCB8] flex flex-col justify-between p-2">
            <span className="text-[9px] font-sans text-[#77766E] uppercase tracking-wider font-semibold">
              INSPECTION-SLAB
            </span>
            <div className="flex justify-between items-end font-mono tabular-nums text-[8px] text-[#77766E]">
              <span>BATCH: #B-904</span>
              <span>LOT: 2026-A</span>
            </div>
          </div>

          {/* Scanning Laser Light Beam (Sage Green Accent) */}
          {(phase === 'scan' || phase === 'defect' || phase === 'brand') && (
            <div
              className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-[#71845B] to-transparent shadow-[0_0_12px_rgba(113,132,91,0.6)] transition-all duration-800 ease-linear"
              style={{
                top: phase === 'scan' ? '85%' : '45%',
                opacity: phase === 'brand' ? 0.2 : 0.95
              }}
            />
          )}

          {/* Defect Highlight Bounding Box (Terracotta) */}
          {(phase === 'defect' || phase === 'brand') && (
            <div className="absolute top-12 left-14 w-14 h-10 border-2 border-[#C97958] rounded bg-[rgba(201,121,88,0.2)] animate-pulse flex flex-col justify-between p-0.5">
              <span className="text-[7.5px] font-sans font-bold text-[#FFFFFF] bg-[#C97958] px-1 py-0.5 rounded leading-none w-max uppercase tracking-wider">
                CRACK
              </span>
              <span className="text-[7px] font-mono tabular-nums text-[#C97958] self-end font-semibold">
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
          <div className="w-7 h-7 rounded-xl bg-[#71845B] border border-[#71845B] flex items-center justify-center text-[#FFFFFF] font-bold text-xs shadow-xs font-sans">
            FS
          </div>
          <h1 className="text-2xl font-bold font-sans tracking-tight text-[#292A26]">
            STEEL-IQ <span className="text-[#71845B]">AI</span>
          </h1>
        </div>
        <p className="text-xs font-sans text-[#77766E] tracking-widest uppercase font-semibold mt-1">
          Precision. Inspection. Traceability.
        </p>
      </div>

      {/* Optical Status Bar */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center items-center gap-4 text-[10px] font-mono tabular-nums text-[#77766E] uppercase">
        <span>SENSOR: ACTIVE</span>
        <span>•</span>
        <span>RESOLUTION: 0.12 MM/PX</span>
        <span>•</span>
        <span>INFERENCE: MOBILENETV3</span>
      </div>
    </div>
  );
};
