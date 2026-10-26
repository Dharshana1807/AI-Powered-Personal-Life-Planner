import React, { useState, useRef, useEffect } from 'react';

export default function Navigation({
  activeTab,
  activeGoalSubTab,
  serverHealth,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState(false);
  const [mobileGoalsExpanded, setMobileGoalsExpanded] = useState(false);
  const dropdownRef = useRef(null);

  const goalCategories = [
    { id: 'fitness', label: 'Fitness', hash: '#/goals/fitness' },
    { id: 'diet', label: 'Diet', hash: '#/goals/diet' },
    { id: 'career', label: 'Career', hash: '#/goals/career' },
    { id: 'education', label: 'Education', hash: '#/goals/education' },
  ];

  // Close desktop dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDesktopDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setDesktopDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigateTo = (hash) => {
    window.location.hash = hash;
    setMobileMenuOpen(false);
    setDesktopDropdownOpen(false);
  };

  return (
    <header
      style={{
        backgroundColor: 'var(--color-bg)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '68px',
        }}
      >
        {/* Brand / Logo */}
        <a
          href="#/dashboard"
          onClick={(e) => {
            e.preventDefault();
            navigateTo('#/dashboard');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            textDecoration: 'none',
            color: 'inherit',
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
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--color-text)',
              border: '1px solid var(--color-primary-hover)',
            }}
          >
            ⚡
          </div>
          <div>
            <div
              style={{
                fontSize: 'var(--font-lg)',
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
              }}
            >
              Adaptive AI Planner
            </div>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav
          className="desktop-nav"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: 'var(--space-2)',
          }}
          aria-label="Main Navigation"
        >
          {/* Dashboard */}
          <a
            href="#/dashboard"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('#/dashboard');
            }}
            style={{
              minHeight: 'var(--touch-target-min)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: activeTab === 'dashboard' ? 'var(--color-primary-hover)' : 'transparent',
              backgroundColor: activeTab === 'dashboard' ? 'var(--color-primary)' : 'transparent',
              color: 'var(--color-text)',
              fontWeight: activeTab === 'dashboard' ? 700 : 500,
              fontSize: 'var(--font-sm)',
              textDecoration: 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            Dashboard
          </a>

          {/* Goal Tracking with Dropdown */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              type="button"
              aria-haspopup="true"
              aria-expanded={desktopDropdownOpen}
              onClick={() => {
                setDesktopDropdownOpen(!desktopDropdownOpen);
                if (activeTab !== 'goals') {
                  navigateTo('#/goals/fitness');
                }
              }}
              style={{
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                borderColor: activeTab === 'goals' ? 'var(--color-primary-hover)' : 'transparent',
                backgroundColor: activeTab === 'goals' ? 'var(--color-primary)' : 'transparent',
                color: 'var(--color-text)',
                fontWeight: activeTab === 'goals' ? 700 : 500,
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                transition: 'all var(--transition-fast)',
              }}
            >
              Goal Tracking
              <span style={{ fontSize: '10px' }} aria-hidden="true">
                {desktopDropdownOpen ? '▲' : '▼'}
              </span>
            </button>

            {desktopDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 'var(--space-1)',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  minWidth: '180px',
                  zIndex: 50,
                  overflow: 'hidden',
                }}
              >
                {goalCategories.map((sub) => {
                  const isSubActive = activeTab === 'goals' && activeGoalSubTab === sub.id;
                  return (
                    <a
                      key={sub.id}
                      href={sub.hash}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTo(sub.hash);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        minHeight: 'var(--touch-target-min)',
                        padding: 'var(--space-2) var(--space-4)',
                        backgroundColor: isSubActive ? 'var(--color-primary-subtle)' : 'var(--color-bg)',
                        color: 'var(--color-text)',
                        fontWeight: isSubActive ? 700 : 500,
                        fontSize: 'var(--font-sm)',
                        textDecoration: 'none',
                        borderLeft: isSubActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                        transition: 'background-color var(--transition-fast)',
                        boxSizing: 'border-box',
                      }}
                    >
                      {sub.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Chatbot */}
          <a
            href="#/chatbot"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('#/chatbot');
            }}
            style={{
              minHeight: 'var(--touch-target-min)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: activeTab === 'chatbot' ? 'var(--color-primary-hover)' : 'transparent',
              backgroundColor: activeTab === 'chatbot' ? 'var(--color-primary)' : 'transparent',
              color: 'var(--color-text)',
              fontWeight: activeTab === 'chatbot' ? 700 : 500,
              fontSize: 'var(--font-sm)',
              textDecoration: 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            AI Chatbot
          </a>

          {/* Journal */}
          <a
            href="#/journal"
            onClick={(e) => {
              e.preventDefault();
              navigateTo('#/journal');
            }}
            style={{
              minHeight: 'var(--touch-target-min)',
              display: 'inline-flex',
              alignItems: 'center',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid',
              borderColor: activeTab === 'journal' ? 'var(--color-primary-hover)' : 'transparent',
              backgroundColor: activeTab === 'journal' ? 'var(--color-primary)' : 'transparent',
              color: 'var(--color-text)',
              fontWeight: activeTab === 'journal' ? 700 : 500,
              fontSize: 'var(--font-sm)',
              textDecoration: 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            Journal
          </a>
        </nav>

        {/* Right Info / Mobile Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 9px',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
              backgroundColor: serverHealth?.status === 'ok' ? 'var(--color-success-bg)' : 'var(--color-secondary-subtle)',
              color: serverHealth?.status === 'ok' ? 'var(--color-success-text)' : 'var(--color-secondary-accent)',
              border: '1px solid',
              borderColor: serverHealth?.status === 'ok' ? 'var(--color-success-border)' : 'var(--color-secondary)',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: serverHealth?.status === 'ok' ? 'var(--color-success)' : 'var(--color-secondary-hover)',
                display: 'inline-block',
              }}
              aria-hidden="true"
            />
            {serverHealth?.status === 'ok' ? 'Server Active' : 'Checking...'}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'var(--touch-target-min)',
              height: 'var(--touch-target-min)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: 'var(--font-lg)',
            }}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Full-width Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="mobile-nav-drawer"
          style={{
            borderTop: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            padding: 'var(--space-4)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <a
              href="#/dashboard"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('#/dashboard');
              }}
              style={{
                width: '100%',
                display: 'block',
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === 'dashboard' ? 'var(--color-primary)' : 'transparent',
                color: 'var(--color-text)',
                fontWeight: activeTab === 'dashboard' ? 700 : 500,
                fontSize: 'var(--font-base)',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              Dashboard
            </a>

            <div>
              <button
                type="button"
                onClick={() => setMobileGoalsExpanded(!mobileGoalsExpanded)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  minHeight: 'var(--touch-target-min)',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: activeTab === 'goals' ? 'var(--color-primary)' : 'transparent',
                  color: 'var(--color-text)',
                  fontWeight: activeTab === 'goals' ? 700 : 500,
                  fontSize: 'var(--font-base)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Goal Tracking</span>
                <span>{mobileGoalsExpanded ? '▲' : '▼'}</span>
              </button>

              {mobileGoalsExpanded && (
                <div
                  style={{
                    paddingLeft: 'var(--space-4)',
                    marginTop: 'var(--space-1)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-1)',
                  }}
                >
                  {goalCategories.map((sub) => {
                    const isSubActive = activeTab === 'goals' && activeGoalSubTab === sub.id;
                    return (
                      <a
                        key={sub.id}
                        href={sub.hash}
                        onClick={(e) => {
                          e.preventDefault();
                          navigateTo(sub.hash);
                        }}
                        style={{
                          width: '100%',
                          display: 'block',
                          minHeight: 'var(--touch-target-min)',
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: isSubActive ? 'var(--color-secondary)' : 'var(--color-surface-hover)',
                          color: 'var(--color-text)',
                          fontWeight: isSubActive ? 700 : 500,
                          fontSize: 'var(--font-sm)',
                          textDecoration: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        {sub.label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <a
              href="#/chatbot"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('#/chatbot');
              }}
              style={{
                width: '100%',
                display: 'block',
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === 'chatbot' ? 'var(--color-primary)' : 'transparent',
                color: 'var(--color-text)',
                fontWeight: activeTab === 'chatbot' ? 700 : 500,
                fontSize: 'var(--font-base)',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              AI Chatbot
            </a>

            <a
              href="#/journal"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('#/journal');
              }}
              style={{
                width: '100%',
                display: 'block',
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: activeTab === 'journal' ? 'var(--color-primary)' : 'transparent',
                color: 'var(--color-text)',
                fontWeight: activeTab === 'journal' ? 700 : 500,
                fontSize: 'var(--font-base)',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              Journal
            </a>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .mobile-hamburger-btn {
            display: none !important;
          }
          .mobile-nav-drawer {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
