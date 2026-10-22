import React from 'react';

interface BadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<BadgeProps> = ({ status, size = 'md' }) => {
  const s = status.toUpperCase();
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs font-medium';

  let colorClasses = 'bg-[#303134] text-[#C4C7C5] border-[#3C4043]';

  if (s === 'PASSED' || s === 'RELEASED' || s === 'COMPLETED' || s === 'RESOLVED' || s === 'NO_DEFECT_CONFIRMED' || s === 'LOW') {
    colorClasses = 'bg-[rgba(129,201,149,0.15)] text-[#81C995] border-[rgba(129,201,149,0.3)]';
  } else if (s === 'CONFIRMED_DEFECT' || s === 'REJECTED' || s === 'CRITICAL' || s === 'DEFECTIVE') {
    colorClasses = 'bg-[rgba(242,139,130,0.15)] text-[#F28B82] border-[rgba(242,139,130,0.35)]';
  } else if (s === 'ON_HOLD' || s === 'MAJOR' || s === 'HIGH' || s === 'ACTION_ASSIGNED' || s === 'IN_REMEDIATION') {
    colorClasses = 'bg-[rgba(253,214,99,0.15)] text-[#FDD663] border-[rgba(253,214,99,0.3)]';
  } else if (s === 'UNDER_REVIEW' || s === 'INFERENCE_COMPLETED' || s === 'IN_PROGRESS' || s === 'MEDIUM' || s === 'NEEDS_MORE_EVIDENCE') {
    colorClasses = 'bg-[rgba(168,199,250,0.15)] text-[#A8C7FA] border-[rgba(168,199,250,0.35)]';
  } else if (s === 'PENDING_INFERENCE' || s === 'PENDING' || s === 'OPEN') {
    colorClasses = 'bg-[#303134] text-[#C4C7C5] border-[#3C4043]';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono ${sizeClasses} ${colorClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
