import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toUpperCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px] sm:text-[11px]' : 'px-2.5 py-1 text-xs';

  // Warm theme status styling
  let colorClasses = 'bg-[#F0EAE1] text-[#77766E] border-[#D8C9AE]';

  if (s === 'PASSED' || s === 'RELEASED' || s === 'COMPLETED' || s === 'RESOLVED' || s === 'NO_DEFECT_CONFIRMED' || s === 'LOW') {
    // Sage green healthy
    colorClasses = 'bg-[rgba(113,132,91,0.12)] text-[#5E704B] border-[rgba(113,132,91,0.32)]';
  } else if (s === 'CONFIRMED_DEFECT' || s === 'REJECTED' || s === 'CRITICAL' || s === 'DEFECTIVE') {
    // Terracotta critical / defect
    colorClasses = 'bg-[rgba(201,121,88,0.12)] text-[#C97958] border-[rgba(201,121,88,0.32)]';
  } else if (s === 'ON_HOLD' || s === 'MAJOR' || s === 'HIGH' || s === 'ACTION_ASSIGNED' || s === 'IN_REMEDIATION') {
    // Warm amber warning
    colorClasses = 'bg-[rgba(196,154,82,0.12)] text-[#A07834] border-[rgba(196,154,82,0.32)]';
  } else if (s === 'UNDER_REVIEW' || s === 'INFERENCE_COMPLETED' || s === 'IN_PROGRESS' || s === 'MEDIUM' || s === 'NEEDS_MORE_EVIDENCE') {
    // Slate blue analytics / review
    colorClasses = 'bg-[rgba(120,149,165,0.12)] text-[#456272] border-[rgba(120,149,165,0.32)]';
  } else if (s === 'PENDING_INFERENCE' || s === 'PENDING' || s === 'OPEN') {
    colorClasses = 'bg-[#F0EAE1] text-[#77766E] border-[#D8C9AE]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-sans font-medium uppercase tracking-wider ${sizeClasses} ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90 shrink-0" />
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
};
