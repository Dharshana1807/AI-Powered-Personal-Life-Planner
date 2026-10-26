import React from 'react';

export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '#/dashboard' },
      { id: 'planner', label: 'Daily Planner', icon: '📅', path: '#/planner' },
      { id: 'assistant', label: 'AI Assistant', icon: '🤖', path: '#/assistant' },
    ],
  },
  {
    title: 'Personal Growth',
    items: [
      { id: 'goals', label: 'Goal Tracking', icon: '🎯', path: '#/goals' },
      { id: 'study', label: 'Study Planner', icon: '📚', path: '#/study' },
      { id: 'career', label: 'Career Planner', icon: '💼', path: '#/career' },
      { id: 'nutrition', label: 'Diet & Nutrition', icon: '🥗', path: '#/nutrition' },
      { id: 'fitness', label: 'Fitness Planner', icon: '💪', path: '#/fitness' },
    ],
  },
  {
    title: 'Daily Wellness',
    items: [
      { id: 'habits', label: 'Habit Tracker', icon: '⚡', path: '#/habits' },
      { id: 'focus', label: 'Focus Mode', icon: '⏱️', path: '#/focus' },
      { id: 'journal', label: 'Journal', icon: '📖', path: '#/journal' },
      { id: 'reports', label: 'Progress Reports', icon: '📈', path: '#/reports' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { id: 'settings-preferences', subtab: 'preferences', label: 'Preferences', icon: '⚙️', path: '#/settings/preferences' },
      { id: 'settings-reminders', subtab: 'reminders', label: 'Reminder Settings', icon: '🔔', path: '#/settings/reminders' },
      { id: 'settings-planner', subtab: 'planner', label: 'Planner Settings', icon: '🛠️', path: '#/settings/planner' },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export default function Sidebar({
  activeTab = 'dashboard',
  activeSettingsSubTab = 'preferences',
  serverHealth = null,
  isCollapsed = false,
  onToggleCollapse = () => {},
  mobileOpen = false,
  onCloseMobile = () => {},
}) {
  const isAiOnline = Boolean(serverHealth?.geminiConfigured);

  const isItemActive = (item) => {
    if (item.subtab) {
      return activeTab === 'settings' && activeSettingsSubTab === item.subtab;
    }
    if (item.id === 'assistant') {
      return activeTab === 'assistant' || activeTab === 'chatbot';
    }
    return activeTab === item.id;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--color-backdrop)',
            zIndex: 49,
            display: 'block',
          }}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        id="app-sidebar"
        style={{
          width: isCollapsed ? '76px' : '260px',
          minWidth: isCollapsed ? '76px' : '260px',
          backgroundColor: 'var(--color-bg)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 50,
          transition: 'width var(--transition-normal), transform var(--transition-normal)',
          transform: mobileOpen ? 'translateX(0)' : undefined,
          boxShadow: mobileOpen ? 'var(--shadow-lg)' : 'none',
        }}
        className={mobileOpen ? 'sidebar-mobile-open' : ''}
      >
        {/* Top: Brand Header & Collapse Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div
            style={{
              padding: isCollapsed ? 'var(--space-4) var(--space-2)' : 'var(--space-4) var(--space-4)',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              minHeight: '68px',
              flexShrink: 0,
            }}
          >
            <a
              href="#/dashboard"
              onClick={onCloseMobile}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                textDecoration: 'none',
                color: 'var(--color-text)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  backgroundColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '18px',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-primary-hover)',
                  flexShrink: 0,
                }}
              >
                ⚡
              </div>

              {!isCollapsed && (
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontWeight: 800, fontSize: 'var(--font-base)', letterSpacing: '-0.3px' }}>
                    Adaptive AI
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted-text)', fontWeight: 600 }}>
                    Life Planner
                  </div>
                </div>
              )}
            </a>

            {!isCollapsed && (
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 6px',
                  cursor: 'pointer',
                  color: 'var(--color-muted-text)',
                  fontSize: '12px',
                }}
              >
                ◀
              </button>
            )}
          </div>

          {/* Toggle button when collapsed */}
          {isCollapsed && (
            <div style={{ textAlign: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Expand sidebar"
                aria-label="Expand sidebar"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted-text)',
                  fontSize: '14px',
                  padding: '4px',
                }}
              >
                ▶
              </button>
            </div>
          )}

          {/* Middle: Organized Navigation Sections */}
          <nav
            style={{
              padding: 'var(--space-2) var(--space-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {NAV_SECTIONS.map((section, sIdx) => (
              <div key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {!isCollapsed && (
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--color-muted-text)',
                      padding: '4px 10px 2px',
                      marginTop: sIdx > 0 ? '4px' : '0',
                    }}
                  >
                    {section.title}
                  </div>
                )}
                {isCollapsed && sIdx > 0 && (
                  <div style={{ height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 8px' }} />
                )}

                {section.items.map((item) => {
                  const isActive = isItemActive(item);
                  return (
                    <a
                      key={item.id}
                      href={item.path}
                      onClick={onCloseMobile}
                      title={item.label}
                      id={`nav-link-${item.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCollapsed ? '0' : 'var(--space-3)',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        padding: isCollapsed ? '9px 0' : '8px 12px',
                        borderRadius: 'var(--radius-md)',
                        textDecoration: 'none',
                        fontSize: 'var(--font-sm)',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                        color: isActive ? '#000000' : 'var(--color-text)',
                        border: isActive ? '1px solid var(--color-primary-hover)' : '1px solid transparent',
                        transition: 'background-color var(--transition-fast)',
                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <span style={{ fontSize: '18px', flexShrink: 0, width: '22px', textAlign: 'center' }} aria-hidden="true">
                        {item.icon}
                      </span>
                      {!isCollapsed && (
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom: Profile & Status Footer */}
        <div
          style={{
            padding: isCollapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-surface-hover)',
          }}
        >
          <a
            href="#/settings"
            onClick={onCloseMobile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isCollapsed ? '0' : 'var(--space-3)',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-secondary)',
                border: '1px solid var(--color-secondary-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              🎓
            </div>

            {!isCollapsed && (
              <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 'var(--font-xs)',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {((typeof localStorage !== 'undefined' && localStorage.getItem('adaptive_planner_username')) || 'Student Planner')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isAiOnline ? 'var(--color-success)' : 'var(--color-muted-text)',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--color-muted-text)' }}>
                      {isAiOnline ? 'AI Ready' : 'Offline Mode'}
                    </span>
                  </div>
                </div>

                <a
                  href="#/welcome"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMobile();
                  }}
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-muted-text)',
                    textDecoration: 'none',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-border)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    marginLeft: '4px',
                  }}
                  title="Switch user / Go to welcome page"
                >
                  Switch
                </a>
              </div>
            )}
          </a>
        </div>
      </aside>
    </>
  );
}
