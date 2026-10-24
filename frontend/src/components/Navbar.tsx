import React, { useState } from 'react';
import { ChevronDown, Play, AlertCircle, Shield, KeyRound } from 'lucide-react';
import { User } from '../types';
import { getRoleBadge } from '../utils/rbac';

interface NavbarProps {
  currentUser: User | null;
  onSwitchUser: (username: string) => void;
  onReplayIntro: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onSwitchUser, onReplayIntro }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const DEMO_USERS = [
    { username: 'op_alex', name: 'Alex Koval', role: 'Production Operator', desc: 'Shop floor optical intake; cannot confirm defect dispositions or manage CAPA' },
    { username: 'inspector_marcus', name: 'Marcus Lee', role: 'Quality Inspector', desc: 'Runs camera scans; reviews evidence; blocked from approving own items' },
    { username: 'qm_elena', name: 'Elena Vance', role: 'Quality Manager', desc: 'Full plant-wide quality governance, lot quarantine, and CAPA resolution' },
    { username: 'sup_davis', name: 'John Davis', role: 'Production Supervisor', desc: 'Shop floor supervisor assigned to line/kiln remediation actions' },
    { username: 'admin', name: 'Quality Director', role: 'System Admin', desc: 'User administration & security audit logs; separated from quality authority' },
  ];

  const currentRoleInfo = getRoleBadge(currentUser?.role);

  return (
    <header className="bg-[#FFFCF6] border-b border-[#D8C9AE] sticky top-0 z-40 px-5 py-2.5 shadow-sm">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#71845B] border border-[#71845B] flex items-center justify-center text-[#FFFFFF] font-sans font-bold text-sm shadow-sm">
            FS
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-[#292A26] font-sans">STEEL-IQ</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-[#71845B] text-[#FFFFFF]">
                AI
              </span>
              <span className="hidden sm:inline-block text-[11px] text-[#77766E] font-mono">
                // OPTICAL DEFECT TRACKING
              </span>
            </div>
            <p className="text-xs text-[#77766E] font-sans">Automated Surface Quality Inspection & CAPA System</p>
          </div>
        </div>

        {/* Center: Model Architecture & Domain Disclosure */}
        <div className="hidden lg:flex items-center gap-3 px-3.5 py-1.5 rounded-lg bg-[#F0EAE1] border border-[#D8C9AE] text-xs">
          <div className="flex items-center gap-1.5 text-[#292A26] font-sans">
            <span className="w-2 h-2 rounded-full bg-[#71845B]" />
            <span className="font-medium">MobileNetV3 PyTorch</span>
          </div>
          <span className="text-[#D8C9AE]">|</span>
          <div className="flex items-center gap-1.5 text-[#77766E] font-sans" title="Production model trained on industrial steel surfaces">
            <AlertCircle className="w-3.5 h-3.5 text-[#C49A52] shrink-0" />
            <span>Inference: <strong className="text-[#292A26] font-mono font-semibold">v1.0-PROD</strong> (Grad-CAM Enabled)</span>
          </div>
        </div>

        {/* Right Controls: Replay Intro & Role Switcher */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onReplayIntro}
            title="Replay Opening Sequence"
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D8C9AE] bg-[#FFFCF6] hover:bg-[#F0EAE1] text-[#77766E] hover:text-[#292A26] text-xs font-sans font-medium transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-[#71845B]" />
            <span className="hidden md:inline">Intro</span>
          </button>

          {/* User profile dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="min-h-[40px] flex items-center gap-2.5 bg-[#FFFCF6] hover:bg-[#F0EAE1] border border-[#D8C9AE] hover:border-[#B5A58B] px-3.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer shadow-sm"
            >
              <div className="w-6 h-6 rounded-lg bg-[#71845B] text-[#FFFFFF] flex items-center justify-center font-sans font-bold text-xs">
                {currentUser?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block font-sans">
                <div className="text-xs font-semibold text-[#292A26] leading-none">{currentUser?.full_name || 'Sign In'}</div>
                <div className="text-[10px] text-[#71845B] uppercase tracking-wider font-semibold mt-0.5">
                  {currentRoleInfo.label}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#77766E]" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[#FFFCF6] border border-[#D8C9AE] rounded-xl sky-modal-shadow p-2.5 z-50">
                <div className="px-2.5 py-1.5 text-[10px] font-sans font-semibold text-[#77766E] uppercase tracking-wider border-b border-[#D8C9AE] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#71845B]" />
                    <span>Authenticated RBAC Persona</span>
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-[rgba(113,132,91,0.12)] text-[#5E704B]">
                    JWT SECURED
                  </span>
                </div>
                <p className="px-2.5 pb-2 text-[11px] text-[#77766E] border-b border-[#D8C9AE]/40 mb-1 leading-tight">
                  Selecting a persona signs into a distinct manufacturing account via the backend to verify separation of duties.
                </p>
                {DEMO_USERS.map((u) => {
                  const isActive = currentUser?.username === u.username;
                  return (
                    <button
                      key={u.username}
                      onClick={() => {
                        onSwitchUser(u.username);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg text-xs font-sans transition-colors mb-1 cursor-pointer ${
                        isActive
                          ? 'bg-[rgba(113,132,91,0.12)] border border-[#71845B] text-[#292A26]'
                          : 'hover:bg-[#F0EAE1] text-[#77766E] hover:text-[#292A26]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-[#292A26]">{u.name}</span>
                        <span className="text-[10px] text-[#71845B] font-mono font-semibold uppercase">{u.role}</span>
                      </div>
                      <p className="text-[11px] text-[#77766E] mt-0.5">{u.desc}</p>
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
