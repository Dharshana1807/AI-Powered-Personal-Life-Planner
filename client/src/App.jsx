import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DailyPlanner from './pages/DailyPlanner.jsx';
import Chatbot from './pages/Chatbot.jsx';
import GoalTracking from './pages/GoalTracking.jsx';
import StudyPlanner from './pages/StudyPlanner.jsx';
import CareerPlanner from './pages/CareerPlanner.jsx';
import DietNutrition from './pages/DietNutrition.jsx';
import FitnessPlanner from './pages/FitnessPlanner.jsx';
import HabitTracker from './pages/HabitTracker.jsx';
import FocusMode from './pages/FocusMode.jsx';
import Journal from './pages/Journal.jsx';
import ProgressReports from './pages/ProgressReports.jsx';
import Settings from './pages/Settings.jsx';
import Welcome from './pages/Welcome.jsx';
import Toast from './components/common/Toast.jsx';
import { PlannerProvider, usePlanner } from './context/PlannerContext.jsx';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const savedUser = localStorage.getItem('adaptive_planner_username');
      const hash = window.location.hash;
      if (hash === '#/welcome' || (!savedUser && (!hash || hash === '#/' || hash === '#/dashboard'))) {
        return 'welcome';
      }
    } catch {}
    return 'dashboard';
  });
  const [activeGoalSubTab, setActiveGoalSubTab] = useState('fitness');
  const [activeSettingsSubTab, setActiveSettingsSubTab] = useState('preferences');
  const [serverHealth, setServerHealth] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('adaptive_planner_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const { toast, dismissToast, undoLastAction } = usePlanner();

  // Parse location hash
  const parseHash = () => {
    const rawHash = window.location.hash || '';
    const cleanHash = rawHash.split('?')[0];

    let savedUser = '';
    try {
      savedUser = localStorage.getItem('adaptive_planner_username') || '';
    } catch {}

    if (cleanHash === '#/welcome' || (!savedUser && (!cleanHash || cleanHash === '#/' || cleanHash === '#/dashboard'))) {
      setActiveTab('welcome');
      return;
    }

    if (cleanHash.startsWith('#/goals')) {
      const parts = cleanHash.split('/');
      const sub = parts[2] || 'fitness';
      setActiveTab('goals');
      setActiveGoalSubTab(['fitness', 'diet', 'career', 'education'].includes(sub) ? sub : 'fitness');
    } else if (cleanHash === '#/planner') {
      setActiveTab('planner');
    } else if (cleanHash === '#/assistant' || cleanHash === '#/chatbot') {
      setActiveTab('assistant');
    } else if (cleanHash === '#/study') {
      setActiveTab('study');
    } else if (cleanHash === '#/career') {
      setActiveTab('career');
    } else if (cleanHash === '#/nutrition') {
      setActiveTab('nutrition');
    } else if (cleanHash === '#/fitness') {
      setActiveTab('fitness');
    } else if (cleanHash === '#/habits') {
      setActiveTab('habits');
    } else if (cleanHash === '#/focus') {
      setActiveTab('focus');
    } else if (cleanHash === '#/journal') {
      setActiveTab('journal');
    } else if (cleanHash === '#/reports') {
      setActiveTab('reports');
    } else if (cleanHash.startsWith('#/settings')) {
      const parts = cleanHash.split('/');
      const sub = parts[2] || 'preferences';
      setActiveTab('settings');
      setActiveSettingsSubTab(['preferences', 'reminders', 'planner'].includes(sub) ? sub : 'preferences');
    } else {
      setActiveTab('dashboard');
      if (cleanHash !== '#/dashboard') {
        window.location.hash = '#/dashboard';
      }
    }
  };

  useEffect(() => {
    parseHash();
    const handleHashChange = () => parseHash();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check backend API connectivity
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setServerHealth(data))
      .catch((err) => {
        console.error('Health check failed:', err);
        setServerHealth({ status: 'error', error: err.message });
      });
  }, []);

  const handleGoalSubTabChange = (sub) => {
    window.location.hash = `#/goals/${sub}`;
  };

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('adaptive_planner_sidebar_collapsed', String(next));
      } catch (err) {
        console.warn('Could not save sidebar state:', err);
      }
      return next;
    });
  };

  if (activeTab === 'welcome') {
    return (
      <Welcome
        onContinue={(name) => {
          window.location.hash = '#/dashboard';
          setActiveTab('dashboard');
        }}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      {/* Fixed Vertical Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        activeSettingsSubTab={activeSettingsSubTab}
        serverHealth={serverHealth}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area (Offset by sidebar width on desktop) */}
      <div
        className="app-content-wrapper"
        style={{
          marginLeft: isCollapsed ? '76px' : '260px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'margin-left var(--transition-normal)',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        {/* Mobile Top Header (hidden on desktop via CSS) */}
        <header
          className="mobile-top-bar"
          style={{
            height: '60px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--space-4)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open Navigation Menu"
              style={{
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                fontSize: 'var(--font-lg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 'var(--font-xs)',
                }}
              >
                AI
              </div>
              <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)' }}>Adaptive Planner</span>
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
            {serverHealth?.geminiConfigured ? '🟢 AI Online' : '⚪ Manual'}
          </div>
        </header>

        {/* Page Main Content */}
        <main
          style={{
            flex: 1,
            paddingTop: 'var(--space-6)',
            paddingBottom: 'var(--space-10)',
          }}
        >
          <div className="container">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'planner' && <DailyPlanner />}
            {activeTab === 'assistant' && <Chatbot />}
            {activeTab === 'goals' && (
              <GoalTracking
                activeSubTab={activeGoalSubTab}
                onSubTabChange={handleGoalSubTabChange}
              />
            )}
            {activeTab === 'study' && <StudyPlanner />}
            {activeTab === 'career' && <CareerPlanner />}
            {activeTab === 'nutrition' && <DietNutrition />}
            {activeTab === 'fitness' && <FitnessPlanner />}
            {activeTab === 'habits' && <HabitTracker />}
            {activeTab === 'focus' && <FocusMode />}
            {activeTab === 'journal' && <Journal />}
            {activeTab === 'reports' && <ProgressReports />}
            {activeTab === 'settings' && (
              <Settings
                activeSubTab={activeSettingsSubTab}
                onSubTabChange={(sub) => {
                  window.location.hash = `#/settings/${sub}`;
                }}
              />
            )}
          </div>
        </main>

        {/* Shared Footer */}
        <footer
          style={{
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-muted-text)',
            fontSize: 'var(--font-xs)',
            padding: 'var(--space-4) 0',
          }}
        >
          <div
            className="container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div>
              <strong style={{ color: 'var(--color-text)' }}>Adaptive AI Life Planner</strong> • Unified Single-Origin Application
            </div>
            <div>
              Local Storage Single Source of Truth • 12-Hour AM/PM Time Display
            </div>
          </div>
        </footer>
      </div>

      {/* Global Section-Persistent Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onUndo={toast.showUndo ? undoLastAction : undefined}
          onDismiss={dismissToast}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PlannerProvider>
      <AppContent />
    </PlannerProvider>
  );
}
