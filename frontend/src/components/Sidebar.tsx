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

import { User } from '../types';
import {
  hasPermission,
  PERM_INSPECTION_CREATE,
  PERM_INSPECTION_REVIEW,
  PERM_DASHBOARD_READ,
  PERM_BATCH_READ,
  PERM_DEFECT_READ
} from '../utils/rbac';

interface SidebarProps {
  currentUser?: User | null;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingReviewsCount: number;
  openDefectsCount: number;
  overdueActionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  pendingReviewsCount,
  openDefectsCount,
  overdueActionsCount
}) => {
  const navSections = [
    {
      heading: 'Plant Quality Control',
      items: [
        {
          id: 'overview',
          label: 'Plant Overview',
          icon: LayoutDashboard,
          badge: null
        },
        {
          id: 'digital_twin',
          label: '3D Line Twin',
          icon: Box,
          badge: 'Interactive',
          badgeColor: 'bg-[rgba(113,132,91,0.12)] text-[#5E704B] border-[rgba(113,132,91,0.32)]'
        },
        {
          id: 'batches',
          label: 'Products & Batches',
          icon: Layers,
          badge: null
        }
      ]
    },
    {
      heading: 'Inspection Workflow',
      items: [
        {
          id: 'new_inspection',
          label: 'New Optical Intake',
          icon: Camera,
          badge: null
        },
        {
          id: 'review',
          label: 'Review Workbench',
          icon: ClipboardCheck,
          badge: pendingReviewsCount > 0 ? pendingReviewsCount : null,
          badgeColor: 'bg-[rgba(120,149,165,0.12)] text-[#456272] border-[rgba(120,149,165,0.32)]'
        },
        {
          id: 'prioritization',
          label: 'Prioritization Queue',
          icon: Zap,
          badge: 'Prioritized',
          badgeColor: 'bg-[rgba(113,132,91,0.12)] text-[#5E704B] border-[rgba(113,132,91,0.32)]'
        }
      ]
    },
    {
      heading: 'Defects & Governance',
      items: [
        {
          id: 'defects',
          label: 'Defect Register & CAPA',
          icon: AlertTriangle,
          badge: overdueActionsCount > 0 ? `${overdueActionsCount} Late` : (openDefectsCount > 0 ? openDefectsCount : null),
          badgeColor: overdueActionsCount > 0
            ? 'bg-[rgba(201,121,88,0.12)] text-[#C97958] border-[rgba(201,121,88,0.32)]'
            : 'bg-[rgba(196,154,82,0.12)] text-[#A07834] border-[rgba(196,154,82,0.32)]'
        },
        {
          id: 'copilot',
          label: 'Quality Copilot AI',
          icon: Sparkles,
          badge: 'Grounded AI',
          badgeColor: 'bg-[rgba(120,149,165,0.12)] text-[#456272] border-[rgba(120,149,165,0.32)]'
        }
      ]
    }
  ];

  // RBAC permission filter for navigation items
  const user = currentUser ?? null;
  const filteredSections = navSections.map((section) => {
    const visibleItems = section.items.filter((item) => {
      if (item.id === 'review' || item.id === 'prioritization') {
        return hasPermission(user, PERM_INSPECTION_REVIEW);
      }
      if (item.id === 'new_inspection') {
        return hasPermission(user, PERM_INSPECTION_CREATE);
      }
      if (item.id === 'batches') {
        return hasPermission(user, PERM_BATCH_READ);
      }
      if (item.id === 'defects') {
        return hasPermission(user, PERM_DEFECT_READ);
      }
      return true;
    });
    return { ...section, items: visibleItems };
  }).filter((section) => section.items.length > 0);

  return (
    <aside className="w-64 bg-[#FFFCF6] border-r border-[#D8C9AE] flex flex-col justify-between p-4 shrink-0 shadow-sm">
      <div className="space-y-4">
        {filteredSections.map((sec, secIdx) => (
          <div key={secIdx} className="space-y-1">
            <div className="px-3 py-1.5 text-[10.5px] font-semibold text-[#77766E] uppercase tracking-wider font-sans border-b border-[#D8C9AE]/40 mb-1">
              {sec.heading}
            </div>
            {sec.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full min-h-[38px] flex items-center justify-between px-3 py-1.5 rounded-xl text-[13px] font-sans transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[rgba(113,132,91,0.12)] text-[#292A26] border border-[#71845B] font-semibold shadow-xs'
                      : 'text-[#77766E] font-medium hover:text-[#292A26] hover:bg-[#F0EAE1]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#71845B]' : 'text-[#77766E]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold tabular-nums ${item.badgeColor}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Model Spec Card */}
      <div className="bg-[#F0EAE1] border border-[#D8C9AE] rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-[#77766E]">
          <span className="text-xs font-semibold text-[#292A26] font-sans">Model Deployment</span>
          <span className="text-[10px] text-[#5E704B] font-mono font-semibold tracking-wide">v1.0-PROD</span>
        </div>
        <p className="text-xs text-[#77766E] leading-relaxed font-sans">
          Trained on authentic industrial casting dataset (MobileNetV3). 87.97% held-out test accuracy.
        </p>
        <div className="pt-2 border-t border-[#D8C9AE] flex items-center justify-between text-[11px] text-[#77766E] font-mono tabular-nums">
          <span>Inference: ~45ms</span>
          <span className="text-[#71845B] font-semibold">Grad-CAM: ON</span>
        </div>
      </div>
    </aside>
  );
};
