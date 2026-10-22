import React from 'react';
import {
  LayoutDashboard,
  Box,
  Layers,
  Camera,
  ClipboardCheck,
  AlertTriangle,
  Sparkles,
  Zap
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewsCount: number;
  openDefectsCount: number;
  overdueActionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  pendingReviewsCount,
  openDefectsCount,
  overdueActionsCount
}) => {
  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'digital_twin',
      label: '3D Line Twin',
      icon: Box,
      badge: 'Interactive',
      badgeColor: 'bg-[#004A77]/40 text-[#C2E7FF] border-[#A8C7FA]/40'
    },
    {
      id: 'batches',
      label: 'Products & Batches',
      icon: Layers,
      badge: null
    },
    {
      id: 'new_inspection',
      label: 'New Inspection',
      icon: Camera,
      badge: null
    },
    {
      id: 'review',
      label: 'Inspection Review',
      icon: ClipboardCheck,
      badge: pendingReviewsCount > 0 ? pendingReviewsCount : null,
      badgeColor: 'bg-[rgba(168,199,250,0.15)] text-[#A8C7FA] border-[#A8C7FA]/30'
    },
    {
      id: 'defects',
      label: 'Defects & CAPA',
      icon: AlertTriangle,
      badge: overdueActionsCount > 0 ? `${overdueActionsCount} Late` : (openDefectsCount > 0 ? openDefectsCount : null),
      badgeColor: overdueActionsCount > 0 ? 'bg-[rgba(242,139,130,0.15)] text-[#F28B82] border-[#F28B82]/35' : 'bg-[rgba(253,214,99,0.15)] text-[#FDD663] border-[#FDD663]/30'
    },
    {
      id: 'prioritization',
      label: 'Review Prioritization',
      icon: Zap,
      badge: 'Prioritized',
      badgeColor: 'bg-[rgba(168,199,250,0.15)] text-[#A8C7FA] border-[#A8C7FA]/30'
    },
    {
      id: 'copilot',
      label: 'Quality Copilot',
      icon: Sparkles,
      badge: 'Grounded AI',
      badgeColor: 'bg-[#004A77]/50 text-[#C2E7FF] border-[#A8C7FA]/50'
    }
  ];

  return (
    <aside className="w-64 bg-[#1E1F20] border-r border-[#3C4043] flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-mono font-medium text-[#8E918F] uppercase tracking-wider">
          Operations Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#004A77] text-[#C2E7FF] border border-[#A8C7FA]/40 font-semibold shadow-sm'
                  : 'text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#303134]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#A8C7FA]' : 'text-[#8E918F]'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${item.badgeColor}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Model Spec Card */}
      <div className="bg-[#202124] border border-[#3C4043] rounded-xl p-3.5 text-xs space-y-2">
        <div className="flex items-center justify-between text-[#C4C7C5]">
          <span className="font-medium text-[#E3E3E3]">Model Deployment</span>
          <span className="text-[10px] text-[#81C995] font-mono font-medium">v1.0-PROD</span>
        </div>
        <p className="text-[11px] text-[#8E918F] leading-relaxed">
          Trained on authentic industrial casting dataset (MobileNetV3). 87.97% held-out accuracy.
        </p>
        <div className="pt-2 border-t border-[#3C4043]/60 flex items-center justify-between text-[10px] text-[#8E918F] font-mono">
          <span>Inference: ~45ms</span>
          <span className="text-[#A8C7FA]">Grad-CAM: ON</span>
        </div>
      </div>
    </aside>
  );
};
