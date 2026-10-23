import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { User } from '../types';
import { getRoleBadge } from '../utils/rbac';

interface AccessDeniedProps {
  requiredPermission?: string;
  requiredRole?: string;
  currentUser: User | null;
  onNavigateHome: () => void;
  customMessage?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  requiredPermission,
  requiredRole = 'Quality Inspector / Quality Manager',
  currentUser,
  onNavigateHome,
  customMessage
}) => {
  const roleInfo = getRoleBadge(currentUser?.role);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 font-sans">
      <div className="max-w-xl w-full bg-[#FFFCF6] border border-[#D8C9AE] rounded-2xl p-8 shadow-sm text-center relative overflow-hidden">
        {/* Top security watermark */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#C97958]" />
        
        <div className="w-14 h-14 rounded-2xl bg-[rgba(201,121,88,0.12)] border border-[#C97958] flex items-center justify-center mx-auto mb-5 text-[#C97958]">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div className="flex items-center justify-center gap-2 mb-2 font-mono text-xs uppercase tracking-wider text-[#C97958] font-bold">
          <Lock className="w-3.5 h-3.5" />
          <span>Access Restricted // RBAC Policy Enforcement</span>
        </div>

        <h2 className="text-2xl font-bold text-[#292A26] tracking-tight mb-3">
          Unauthorized Workspace Access
        </h2>

        <p className="text-sm text-[#77766E] leading-relaxed mb-6">
          {customMessage || (
            <>
              Your authenticated session (<strong className="text-[#292A26]">{currentUser?.full_name || 'Anonymous'}</strong>, assigned as{' '}
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${roleInfo.badgeColor}`}>
                {roleInfo.label}
              </span>
              ) does not possess quality authority to access this workspace.
            </>
          )}
        </p>

        {/* Manufacturing Security Context Box */}
        <div className="bg-[#F5F1E8] border border-[#D8C9AE] rounded-xl p-4 text-left text-xs mb-6 space-y-2 font-mono">
          <div className="flex justify-between items-center text-[#77766E]">
            <span>Required Clearance:</span>
            <span className="font-bold text-[#292A26]">{requiredRole}</span>
          </div>
          {requiredPermission && (
            <div className="flex justify-between items-center text-[#77766E]">
              <span>Required Permission:</span>
              <span className="font-bold text-[#C97958]">{requiredPermission}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-[#77766E]">
            <span>Active Security Principle:</span>
            <span className="font-bold text-[#71845B]">Separation of Manufacturing Duties</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onNavigateHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#71845B] hover:bg-[#5E6F4B] text-[#FFFFFF] font-sans font-semibold text-xs transition-colors cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Plant Overview</span>
          </button>
        </div>
      </div>
    </div>
  );
};
