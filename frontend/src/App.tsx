import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { IndustrialIntro } from './components/IndustrialIntro';
import { OverviewPage } from './pages/OverviewPage';
import { ProductsBatchesPage } from './pages/ProductsBatchesPage';
import { NewInspectionPage } from './pages/NewInspectionPage';
import { InspectionReviewPage } from './pages/InspectionReviewPage';
import { DefectsActionsPage } from './pages/DefectsActionsPage';
import { PrioritizationPage } from './pages/PrioritizationPage';
import { CopilotPage } from './pages/CopilotPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { DashboardMetrics, User } from './types';
import { api } from './api/client';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { AccessDenied } from './components/AccessDenied';
import {
  hasPermission,
  normalizeRole,
  PERM_INSPECTION_REVIEW,
  PERM_INSPECTION_CREATE,
  PERM_DASHBOARD_READ,
  PERM_BATCH_READ,
  PERM_DEFECT_READ
} from './utils/rbac';

const PAGE_TITLES: Record<string, string> = {
  overview: 'Plant Quality Overview & Telemetry',
  digital_twin: '3D Continuous Casting Line Twin',
  batches: 'Products & Production Batches',
  new_inspection: 'Optical Ingestion & Neural Inference',
  review: 'Visual Evidence Review Workbench',
  prioritization: 'Prioritized Defect Disposition Queue',
  defects: 'Defect Register & CAPA Governance',
  copilot: 'Grounded Quality Copilot'
};

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [targetDefectId, setTargetDefectId] = useState<number | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState<boolean>(false);

  const [reinspectionContext, setReinspectionContext] = useState<{
    originalInspectionId: number;
    productId: number;
    batchId: number;
    itemIdentifier: string;
    defectType?: string;
    defectCategory?: string;
  } | null>(null);

  const handleStartReinspection = (
    originalInspectionId: number,
    productId: number,
    batchId: number,
    itemIdentifier: string,
    defectType?: string,
    defectCategory?: string
  ) => {
    setReinspectionContext({
      originalInspectionId,
      productId,
      batchId,
      itemIdentifier,
      defectType,
      defectCategory
    });
    setActiveTab('new_inspection');
  };

  // Opening animation state: auto-play on initial visit
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    return !sessionStorage.getItem('forgesight_intro_seen');
  });

  const handleIntroComplete = () => {
    sessionStorage.setItem('forgesight_intro_seen', 'true');
    setShowIntro(false);
  };

  const handleReplayIntro = () => {
    setShowIntro(true);
  };

  // Initialize session
  const initAuth = async (username = 'qm_elena', password = 'qm123') => {
    try {
      setReconnecting(true);
      setConnectionError(null);
      const loginRes = await api.login(username, password);
      setCurrentUser(loginRes.user);
      const norm = normalizeRole(loginRes.user.role);
      if (norm === 'production_operator') {
        setActiveTab('new_inspection');
        setMetrics(null);
      } else if (norm === 'quality_inspector') {
        setActiveTab('review');
        fetchMetrics();
      } else if (norm === 'production_supervisor') {
        setActiveTab('defects');
        fetchMetrics();
      } else {
        setActiveTab('overview');
        fetchMetrics();
      }
    } catch (e: any) {
      console.warn('Backend connection notice:', e);
      setConnectionError(
        e.message || 'Unable to establish connection to backend service. Please ensure the API is running.'
      );
    } finally {
      setReconnecting(false);
    }
  };

  const fetchMetrics = async () => {
    try {
      const data = await api.getDashboardMetrics();
      setMetrics(data);
    } catch (e) {
      console.error('Fetch metrics error:', e);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const handleSwitchUser = async (username: string) => {
    // Invalidate prior session and flush cached state immediately
    api.clearAuth();
    setCurrentUser(null);
    setSelectedInspectionId(null);
    setReinspectionContext(null);
    setTargetDefectId(null);
    setMetrics(null);

    const passwords: Record<string, string> = {
      op_alex: 'op123',
      qm_elena: 'qm123',
      inspector_marcus: 'insp123',
      sup_davis: 'sup123',
      admin: 'admin123'
    };
    const pwd = passwords[username] || 'admin123';
    await initAuth(username, pwd);
  };

  const handleViewInspection = (id: number) => {
    setSelectedInspectionId(id);
    setActiveTab('review');
  };

  const handleInspectionCreated = (id: number) => {
    setSelectedInspectionId(id);
    if (hasPermission(currentUser, PERM_INSPECTION_REVIEW)) {
      setActiveTab('review');
    } else {
      setActiveTab('new_inspection');
    }
    if (hasPermission(currentUser, PERM_DASHBOARD_READ)) {
      fetchMetrics();
    }
  };

  const handleNavigateToActions = (defectId: number) => {
    setTargetDefectId(defectId);
    setActiveTab('defects');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F1E8] text-[#292A26] font-sans">
      {/* Opening Animation Overlay */}
      {showIntro && <IndustrialIntro onComplete={handleIntroComplete} />}

      {/* Top Engineering Navbar */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleSwitchUser}
        onReplayIntro={handleReplayIntro}
        activeTab={activeTab}
      />

      {/* Main Studio Frame - Full Responsive Viewport Width */}
      <div className="flex-1 flex w-full min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar
          currentUser={currentUser}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
          }}
          pendingReviewsCount={metrics?.pending_reviews ?? 0}
          openDefectsCount={metrics?.confirmed_defects ?? 0}
          overdueActionsCount={metrics?.overdue_actions ?? 0}
        />

        {/* Focused Workstation Workspace View */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-4 overflow-y-auto">
          {/* Workstation Context Header */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[#D8C9AE]/70">
            <div className="flex items-center gap-2 text-xs font-sans text-[#77766E]">
              <span className="font-semibold text-[#292A26]">Steel-IQ Workstation</span>
              <span className="text-[#D8C9AE]">/</span>
              <span className="text-[#71845B] font-semibold">{PAGE_TITLES[activeTab] || 'Workstation'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-xs font-mono">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFFCF6] border border-[#D8C9AE] text-[#77766E] shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#71845B] animate-pulse" />
                <span>STATION-01 // PRODUCTION-READY</span>
              </span>
              {currentUser && (
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-[#77766E] font-sans">
                  Operator: <strong className="text-[#292A26] font-mono">{currentUser.username}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Graceful Backend Connection Notice */}
          {connectionError && (
            <div className="mb-4 p-3.5 rounded-xl bg-[rgba(201,121,88,0.12)] border border-[#C97958] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-[#C97958] font-sans">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#C97958]" />
                <div>
                  <strong className="font-semibold">Backend Connection Notice:</strong>{' '}
                  <span>{connectionError}</span>
                </div>
              </div>
              <button
                onClick={() => initAuth()}
                disabled={reconnecting}
                className="btn-secondary-ivory py-1.5 px-3.5 text-xs min-h-[34px] self-start sm:self-auto cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconnecting ? 'animate-spin' : ''}`} />
                <span>{reconnecting ? 'Reconnecting...' : 'Retry Connection'}</span>
              </button>
            </div>
          )}

          {activeTab === 'overview' && (
            hasPermission(currentUser, PERM_DASHBOARD_READ) ? (
              <OverviewPage
                metrics={metrics}
                onNavigate={(tab) => setActiveTab(tab)}
                onViewInspection={handleViewInspection}
                currentUser={currentUser}
                onSwitchUser={handleSwitchUser}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Manager / Quality Inspector"
                requiredPermission={PERM_DASHBOARD_READ}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
                customMessage="Plant Governance Dashboard is restricted to authorized Quality Managers and Inspectors. Operators are restricted to optical intake."
              />
            )
          )}

          {activeTab === 'digital_twin' && (
            hasPermission(currentUser, PERM_DASHBOARD_READ) ? (
              <DigitalTwinPage
                metrics={metrics}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Manager / Quality Inspector"
                requiredPermission={PERM_DASHBOARD_READ}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
              />
            )
          )}

          {activeTab === 'batches' && (
            hasPermission(currentUser, PERM_BATCH_READ) && hasPermission(currentUser, PERM_DASHBOARD_READ) ? (
              <ProductsBatchesPage
                currentUser={currentUser}
                onRefreshMetrics={fetchMetrics}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Manager"
                requiredPermission={PERM_BATCH_READ}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
                customMessage="Batch containment and quarantine release requires authorized Quality Manager governance."
              />
            )
          )}

          {activeTab === 'new_inspection' && (
            hasPermission(currentUser, PERM_INSPECTION_CREATE) ? (
              <NewInspectionPage
                onInspectionCreated={handleInspectionCreated}
                reinspectionContext={reinspectionContext}
                onClearReinspectionContext={() => setReinspectionContext(null)}
              />
            ) : (
              <AccessDenied
                requiredRole="Production Operator / Inspector"
                requiredPermission={PERM_INSPECTION_CREATE}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
              />
            )
          )}

          {activeTab === 'review' && (
            hasPermission(currentUser, PERM_INSPECTION_REVIEW) ? (
              <InspectionReviewPage
                selectedInspectionId={selectedInspectionId}
                currentUser={currentUser}
                onRefreshMetrics={fetchMetrics}
                onNavigateToActions={handleNavigateToActions}
                onStartReinspection={handleStartReinspection}
                onViewInspection={handleViewInspection}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Inspector / Quality Manager"
                requiredPermission={PERM_INSPECTION_REVIEW}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
                customMessage="Review Workbench and defect disposition requires authorized Quality Inspector or Quality Manager clearance. Machine predictions remain protected from unauthorized sign-off."
              />
            )
          )}

          {activeTab === 'defects' && (
            hasPermission(currentUser, PERM_DEFECT_READ) ? (
              <DefectsActionsPage
                currentUser={currentUser}
                targetDefectId={targetDefectId}
                onStartReinspection={handleStartReinspection}
                onRefreshMetrics={fetchMetrics}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Inspector / Quality Manager"
                requiredPermission={PERM_DEFECT_READ}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
              />
            )
          )}

          {activeTab === 'prioritization' && (
            hasPermission(currentUser, PERM_INSPECTION_REVIEW) ? (
              <PrioritizationPage
                onSelectInspection={handleViewInspection}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Inspector / Quality Manager"
                requiredPermission={PERM_INSPECTION_REVIEW}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
              />
            )
          )}

          {activeTab === 'copilot' && (
            hasPermission(currentUser, PERM_DASHBOARD_READ) ? (
              <CopilotPage />
            ) : (
              <AccessDenied
                requiredRole="Quality Manager / Quality Inspector"
                requiredPermission={PERM_DASHBOARD_READ}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('new_inspection')}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
