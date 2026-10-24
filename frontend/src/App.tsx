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

import { AccessDenied } from './components/AccessDenied';
import { hasPermission, PERM_INSPECTION_REVIEW, PERM_INSPECTION_CREATE } from './utils/rbac';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<number | null>(null);
  const [targetDefectId, setTargetDefectId] = useState<number | null>(null);
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
      const loginRes = await api.login(username, password);
      setCurrentUser(loginRes.user);
      fetchMetrics();
    } catch (e) {
      console.error('Auto-login error:', e);
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
    // If user has review permission, route to review workbench; otherwise navigate to overview
    if (hasPermission(currentUser, PERM_INSPECTION_REVIEW)) {
      setActiveTab('review');
    } else {
      setActiveTab('overview');
    }
    fetchMetrics();
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

      {/* Main Studio Frame */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
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

        {/* Focused Workspace View */}
        <main className="flex-1 p-5 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewPage
              metrics={metrics}
              onNavigate={(tab) => setActiveTab(tab)}
              onViewInspection={handleViewInspection}
              currentUser={currentUser}
              onSwitchUser={handleSwitchUser}
            />
          )}

          {activeTab === 'digital_twin' && (
            <DigitalTwinPage
              metrics={metrics}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'batches' && (
            <ProductsBatchesPage
              currentUser={currentUser}
              onRefreshMetrics={fetchMetrics}
            />
          )}

          {activeTab === 'new_inspection' && (
            hasPermission(currentUser, PERM_INSPECTION_CREATE) ? (
              <NewInspectionPage
                onInspectionCreated={handleInspectionCreated}
                reinspectionContext={reinspectionContext}
                onClearReinspection={() => setReinspectionContext(null)}
              />
            ) : (
              <AccessDenied
                requiredRole="Production Operator / Quality Inspector"
                requiredPermission={PERM_INSPECTION_CREATE}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('overview')}
              />
            )
          )}

          {activeTab === 'review' && (
            hasPermission(currentUser, PERM_INSPECTION_REVIEW) ? (
              <InspectionReviewPage
                currentUser={currentUser}
                selectedInspectionId={selectedInspectionId}
                onNavigateToActions={handleNavigateToActions}
                onRefreshMetrics={fetchMetrics}
                onStartReinspection={handleStartReinspection}
                onViewInspection={handleViewInspection}
              />
            ) : (
              <AccessDenied
                requiredRole="Quality Inspector / Quality Manager"
                requiredPermission={PERM_INSPECTION_REVIEW}
                currentUser={currentUser}
                onNavigateHome={() => setActiveTab('overview')}
                customMessage="Review Workbench and defect disposition requires authorized Quality Inspector or Quality Manager clearance. Machine predictions remain protected from unauthorized sign-off."
              />
            )
          )}

          {activeTab === 'defects' && (
            <DefectsActionsPage
              currentUser={currentUser}
              targetDefectId={targetDefectId}
              onStartReinspection={handleStartReinspection}
              onRefreshMetrics={fetchMetrics}
            />
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
                onNavigateHome={() => setActiveTab('overview')}
              />
            )
          )}

          {activeTab === 'copilot' && (
            <CopilotPage />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
