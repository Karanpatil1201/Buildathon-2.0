import React, { useState } from 'react';
import { Cpu, ChevronDown, Play, AlertCircle, Shield } from 'lucide-react';
import { User } from '../types';

interface NavbarProps {
  currentUser: User | null;
  onSwitchUser: (username: string) => void;
  onReplayIntro: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onSwitchUser, onReplayIntro }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const DEMO_USERS = [
    { username: 'qm_elena', name: 'Elena Vance', role: 'Quality Manager', desc: 'Can hold/release lots & review disputed tiles' },
    { username: 'inspector_marcus', name: 'Marcus Lee', role: 'Lead Inspector', desc: 'Runs camera inspection; blocked from approving own items' },
    { username: 'sup_davis', name: 'John Davis', role: 'Line Supervisor', desc: 'Assigns kiln/glazing remediation actions' },
    { username: 'admin', name: 'Quality Director', role: 'System Admin', desc: 'Full plant-wide quality configuration' },
  ];

  return (
    <header className="bg-[#1E1F20] border-b border-[#3C4043] sticky top-0 z-40 px-5 py-2.5">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#004A77] border border-[#A8C7FA]/40 flex items-center justify-center text-[#A8C7FA] font-mono font-bold text-sm shadow-sm">
            FS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-[#E3E3E3] font-mono">FORGESIGHT</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/50">
                AI
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#8E918F] font-mono">
                // CERAMIC TILE QC
              </span>
            </div>
            <p className="text-[11px] text-[#C4C7C5]">Industrial Defect Detection & Corrective Action System</p>
          </div>
        </div>

        {/* Center: Model Architecture & Honest Domain Notice */}
        <div className="hidden lg:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-[#202124] border border-[#3C4043] text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-[#E3E3E3]">
            <span className="w-2 h-2 rounded-full bg-[#81C995]" />
            <span>MobileNetV3 PyTorch</span>
          </div>
          <span className="text-[#3C4043]">|</span>
          <div className="flex items-center gap-1.5 text-[#FDD663]" title="Current model weights baseline trained on industrial castings; ceramic-tile fine-tuning in progress">
            <AlertCircle className="w-3.5 h-3.5 text-[#FDD663] shrink-0" />
            <span className="text-[#C4C7C5]">Domain: <strong className="text-[#E3E3E3]">Metal Casting v1.0</strong> (Tile Transfer Pending)</span>
          </div>
        </div>

        {/* Right Controls: Replay Intro & Role Switcher */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onReplayIntro}
            title="Replay Opening Sequence"
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#3C4043] bg-[#303134] hover:bg-[#35373A] text-[#C4C7C5] hover:text-[#E3E3E3] text-xs font-mono transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-[#A8C7FA]" />
            <span className="hidden md:inline">Intro</span>
          </button>

          {/* User profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="min-h-[44px] flex items-center gap-2.5 bg-[#303134] hover:bg-[#35373A] border border-[#3C4043] hover:border-[#5F6368] px-3.5 py-2 rounded-xl text-left transition-colors cursor-pointer"
            >
              <div className="w-6 h-6 rounded-lg bg-[#202124] border border-[#3C4043] flex items-center justify-center text-[#A8C7FA] font-mono font-bold text-xs">
                {currentUser?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold text-[#E3E3E3] leading-none">{currentUser?.full_name || 'Sign In'}</div>
                <div className="text-[10px] text-[#A8C7FA] uppercase tracking-wider font-mono mt-0.5 font-medium">
                  {currentUser?.role?.replace('_', ' ') || 'Inspector'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#8E918F]" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#202124] border border-[#3C4043] rounded-xl industrial-modal-shadow p-2 z-50">
                <div className="px-3 py-1.5 text-[10px] font-mono text-[#8E918F] uppercase tracking-wider border-b border-[#3C4043] mb-1 flex items-center justify-between">
                  <span>Switch Inspector Persona</span>
                  <Shield className="w-3 h-3 text-[#A8C7FA]" />
                </div>
                {DEMO_USERS.map((u) => {
                  const isActive = currentUser?.username === u.username;
                  return (
                    <button
                      key={u.username}
                      onClick={() => {
                        onSwitchUser(u.username);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors mb-1 cursor-pointer ${
                        isActive
                          ? 'bg-[#004A77]/40 border border-[#A8C7FA] text-[#C2E7FF]'
                          : 'hover:bg-[#303134] text-[#C4C7C5] hover:text-[#E3E3E3]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{u.name}</span>
                        <span className="text-[10px] text-[#A8C7FA] font-mono uppercase">{u.role}</span>
                      </div>
                      <p className="text-[11px] text-[#8E918F] mt-0.5">{u.desc}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
