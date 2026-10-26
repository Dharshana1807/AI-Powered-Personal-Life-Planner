import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import { Input, Select } from '../components/common/FormField.jsx';
import Badge from '../components/common/Badge.jsx';
import Alert from '../components/common/Alert.jsx';
import Modal from '../components/common/Modal.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import RoutineSetupModal from '../components/dashboard/RoutineSetupModal.jsx';
import { usePlanner } from '../context/PlannerContext.jsx';
import {
  loadAppSettings,
  saveAppSettings,
  exportFullBackup,
  restoreFromBackup,
  resetAllData,
  loadChangeHistory,
  loadSavedRoutine,
  loadScheduleVersions,
} from '../utils/storage.js';
import { formatTime12h, formatTimeRange12h } from '../utils/dateUtils.js';

export default function Settings({ activeSubTab = 'preferences', onSubTabChange }) {
  const { restoreScheduleVersionOp } = usePlanner();

  const [currentTab, setCurrentTab] = useState(activeSubTab || 'preferences');
  const [settings, setSettings] = useState(() => loadAppSettings());
  const [routine, setRoutine] = useState(() => loadSavedRoutine());
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [historyList, setHistoryList] = useState(() => loadChangeHistory());
  const [scheduleVersions, setScheduleVersions] = useState(() => loadScheduleVersions());
  const [serverHealth, setServerHealth] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);
  const [restoreText, setRestoreText] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  useEffect(() => {
    if (activeSubTab && activeSubTab !== currentTab) {
      setCurrentTab(activeSubTab);
    }
  }, [activeSubTab]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setServerHealth(data))
      .catch((err) => setServerHealth({ status: 'error', error: err.message }));
  }, []);

  const handleTabClick = (tabId) => {
    setCurrentTab(tabId);
    if (onSubTabChange) {
      onSubTabChange(tabId);
    } else {
      window.location.hash = `#/settings/${tabId}`;
    }
  };

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault();
    saveAppSettings(settings);
    if (settings.userName) {
      try {
        localStorage.setItem('adaptive_planner_username', settings.userName.trim());
      } catch {}
    }
    setStatusNotice({ type: 'success', text: 'Settings updated successfully.' });
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleRequestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatusNotice({
        type: 'error',
        text: 'Browser notifications are not supported on this browser or platform.',
      });
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        setStatusNotice({
          type: 'success',
          text: 'Notification permission granted! Active reminders will trigger while this app tab is open.',
        });
      } else {
        setStatusNotice({
          type: 'info',
          text: `Notification permission status: ${permission}. In-app reminder banners remain active.`,
        });
      }
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
    }
  };

  const handleExportBackup = () => {
    const jsonStr = exportFullBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adaptive-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusNotice({ type: 'success', text: 'Backup file exported successfully.' });
  };

  const handleConfirmRestore = () => {
    if (!restoreText.trim()) return;
    const res = restoreFromBackup(restoreText);
    if (res.success) {
      setShowRestoreModal(false);
      setSettings(loadAppSettings());
      setRoutine(loadSavedRoutine());
      setHistoryList(loadChangeHistory());
      setScheduleVersions(loadScheduleVersions());
      setStatusNotice({ type: 'success', text: 'Backup restored successfully! All records updated.' });
    } else {
      setStatusNotice({ type: 'error', text: res.error });
    }
  };

  const handleRestoreVersion = (versionId) => {
    if (restoreScheduleVersionOp) {
      const success = restoreScheduleVersionOp(versionId);
      if (success) {
        setScheduleVersions(loadScheduleVersions());
        setHistoryList(loadChangeHistory());
        setStatusNotice({
          type: 'success',
          text: 'Schedule version restored! Completion records and unrelated data were preserved.',
        });
      }
    }
  };

  const handleConfirmReset = () => {
    resetAllData();
    setShowResetModal(false);
    setSettings(loadAppSettings());
    setRoutine(loadSavedRoutine());
    setHistoryList([]);
    setScheduleVersions([]);
    setStatusNotice({ type: 'info', text: 'All data has been reset to defaults.' });
  };

  const tabs = [
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'reminders', label: 'Reminder Settings', icon: '🔔' },
    { id: 'planner', label: 'Planner Settings', icon: '🛠️' },
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        title="Settings & System Configuration"
        description="Configure your personal preferences, smart reminder quiet hours, routine boundaries, and schedule version restore."
        actions={
          <Button variant="outline" onClick={handleExportBackup}>
            📥 Export Backup JSON
          </Button>
        }
      />

      {statusNotice && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert type={statusNotice.type}>{statusNotice.text}</Alert>
        </div>
      )}

      {/* Tabs Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-2)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
        }}
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                border: 'none',
                borderBottom: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                backgroundColor: 'transparent',
                color: isActive ? 'var(--color-text)' : 'var(--color-muted-text)',
                fontWeight: isActive ? 800 : 600,
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: PREFERENCES */}
      {currentTab === 'preferences' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              👤 User Profile & Role
            </h2>
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
                <Input
                  id="settings-username"
                  label="Display Name / Welcome Name"
                  value={settings.userName || ''}
                  onChange={(e) => setSettings((p) => ({ ...p, userName: e.target.value }))}
                  placeholder="e.g. Alex"
                />
                <Input
                  id="settings-userrole"
                  label="Primary Role / Academic Focus"
                  value={settings.userRole || ''}
                  onChange={(e) => setSettings((p) => ({ ...p, userRole: e.target.value }))}
                  placeholder="e.g. CS Student & Cloud Aspirant"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    window.location.hash = '#/welcome';
                  }}
                  title="Go to prototype entry screen"
                >
                  🔄 Switch User / Welcome Screen
                </Button>
                <Button type="submit" variant="primary">
                  Save Profile
                </Button>
              </div>
            </form>
          </Card>

          <Card padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: 0 }}>
                  🤖 Gemini AI Assistant Integration
                </h2>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', marginTop: '4px' }}>
                  Server-side configuration and unified assistant status. The API key is stored securely in your server environment only.
                </p>
              </div>

              <Badge
                type="status"
                value={serverHealth?.geminiConfigured ? 'completed' : 'pending'}
                label={serverHealth?.geminiConfigured ? 'Active & Configured' : 'Offline / Manual Mode'}
              />
            </div>

            <div
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div><strong>Environment:</strong> {serverHealth?.environment || 'development'}</div>
              <div><strong>Server Model:</strong> {serverHealth?.model || 'gemini-3-flash-preview'}</div>
              <div><strong>Execution Mode:</strong> Single Express process with Vite dev server (unified same-origin URL)</div>
              <div><strong>Safety Constraint:</strong> AI generates proposals only. Timetables are never altered without user confirmation.</div>
            </div>
          </Card>

          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
              🕒 Time Display & Classification System
            </h2>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span>✓</span>
                <span><strong>User-Facing Format:</strong> 12-hour AM/PM format throughout the entire interface (e.g. <code>9:00 AM - 10:30 AM</code>).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span>✓</span>
                <span><strong>Day-Part Classification:</strong> Morning (5:00 AM - 11:59 AM), Afternoon (12:00 PM - 4:59 PM), Evening (5:00 PM - 8:59 PM), Night (9:00 PM - 4:59 AM).</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span>✓</span>
                <span><strong>Internal Precision:</strong> Canonical 24-hour ISO strings for conflict detection and schedule math.</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: REMINDER SETTINGS */}
      {currentTab === 'reminders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              🌙 Quiet Hours Configuration
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)' }}>
              During quiet hours, reminders will be silenced and labeled as muted on your dashboard.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer', fontSize: 'var(--font-sm)', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={settings.quietHours?.enabled ?? true}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      quietHours: { ...(p.quietHours || {}), enabled: e.target.checked },
                    }))
                  }
                  style={{ width: '18px', height: '18px' }}
                />
                <span>Enable Quiet Hours</span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                <Input
                  id="quiet-hours-start"
                  type="time"
                  label="Quiet Hours Start"
                  value={settings.quietHours?.start || '22:00'}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      quietHours: { ...(p.quietHours || {}), start: e.target.value },
                    }))
                  }
                />
                <Input
                  id="quiet-hours-end"
                  type="time"
                  label="Quiet Hours End"
                  value={settings.quietHours?.end || '07:00'}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      quietHours: { ...(p.quietHours || {}), end: e.target.value },
                    }))
                  }
                />
              </div>

              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="primary" onClick={handleSaveSettings}>
                  Save Quiet Hours
                </Button>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              🔔 Smart Reminder Categories & Lead Time
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)' }}>
              Select which categories generate dashboard reminders and how far in advance you wish to be alerted.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ maxWidth: '240px' }}>
                <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', display: 'block', marginBottom: '4px' }}>
                  REMINDER LEAD TIME:
                </label>
                <select
                  value={settings.reminders?.leadTimeMinutes || 15}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      reminders: { ...(p.reminders || {}), leadTimeMinutes: Number(e.target.value) },
                    }))
                  }
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--font-sm)',
                    backgroundColor: 'var(--color-bg)',
                  }}
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before (Default)</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                {[
                  { key: 'tasks', label: 'Scheduled Tasks & Sessions', icon: '📅' },
                  { key: 'deadlines', label: 'Assignments & Exam Deadlines', icon: '📚' },
                  { key: 'milestones', label: 'Career Milestones & Goals', icon: '💼' },
                  { key: 'habits', label: 'Daily Habits Routine', icon: '⚡' },
                  { key: 'meals', label: 'Planned Meal Reminders', icon: '🥗' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-3)',
                      backgroundColor: 'var(--color-surface-hover)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={settings.reminders?.[item.key] ?? true}
                      onChange={(e) =>
                        setSettings((p) => ({
                          ...p,
                          reminders: { ...(p.reminders || {}), [item.key]: e.target.checked },
                        }))
                      }
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="primary" onClick={handleSaveSettings}>
                  Save Reminder Preferences
                </Button>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              🌐 Web Browser Notifications
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)', lineHeight: 1.5 }}>
              Browser notifications allow your browser to show desktop alert banners for active tasks and deadlines.
            </p>

            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-muted-text)',
                marginBottom: 'var(--space-4)',
                lineHeight: 1.5,
              }}
            >
              ℹ️ <strong>Truth in Notification Support:</strong> Web notifications fire while this application tab is open in your browser. Web applications cannot deliver background alerts when the computer is off or the browser is completely closed.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--font-sm)' }}>
                Status: <strong>{notificationPermission.toUpperCase()}</strong>
              </div>
              {notificationPermission !== 'granted' && (
                <Button variant="outline" onClick={handleRequestNotificationPermission}>
                  🔔 Request Notification Permission
                </Button>
              )}
              {notificationPermission === 'granted' && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', fontWeight: 700 }}>
                  ✓ Notifications Active
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: PLANNER SETTINGS */}
      {currentTab === 'planner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {/* Regular Routine Configuration */}
          <Card padding="lg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: 0 }}>
                  ⚙️ Regular Routine & Protected Times
                </h2>
                <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
                  Define waking hours, bedtime, work/college commitments, and meal windows that protect your schedule.
                </p>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: '8px' }}>
                  <span>🌅 Wake: <strong>{formatTime12h(routine.wakeTime)}</strong></span>
                  <span>🌙 Sleep: <strong>{formatTime12h(routine.bedTime)}</strong></span>
                  {routine.workHours?.enabled && (
                    <span>💼 Work: <strong>{formatTimeRange12h(routine.workHours.start, routine.workHours.end)}</strong></span>
                  )}
                  <span>🥗 Meals: <strong>{(routine.meals || []).length} configured</strong></span>
                </div>
              </div>

              <Button variant="primary" onClick={() => setShowRoutineModal(true)}>
                Edit Regular Routine
              </Button>
            </div>
          </Card>

          {/* Schedule History & Version Restoration */}
          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              📜 Schedule History & Version Restore
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)' }}>
              Every schedule update is automatically snapshotted. You can restore an earlier schedule without erasing completed tasks or goal records.
            </p>

            {scheduleVersions.length === 0 ? (
              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-surface-hover)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  fontSize: 'var(--font-sm)',
                  color: 'var(--color-muted-text)',
                }}
              >
                No schedule versions recorded yet. As you generate plans or apply AI proposals, snapshots will be listed here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {scheduleVersions.slice(0, 8).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 'var(--space-2)',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 800, fontSize: 'var(--font-sm)' }}>{v.action}</span>
                        <Badge
                          type="status"
                          value={v.author === 'Gemini AI' ? 'completed' : 'pending'}
                          label={v.author}
                        />
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                          for {v.date} ({v.tasksCount} tasks)
                        </span>
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                        {v.summary} &bull; {new Date(v.timestamp).toLocaleString()}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreVersion(v.id)}
                      title="Restore this schedule version without affecting completed tasks"
                    >
                      ↩ Restore This Version
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Backup, Restore & Reset */}
          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
              💾 Unified Storage Backup & Export
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)' }}>
              Download a complete archive of your plans, goals, routines, and records for local backup.
            </p>

            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={handleExportBackup}>
                📥 Download Backup Archive (.json)
              </Button>
              <Button variant="outline" onClick={() => setShowRestoreModal(true)}>
                📤 Restore From Backup
              </Button>
              <Button variant="danger" onClick={() => setShowResetModal(true)}>
                🗑️ Reset All Data
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Routine Setup Modal */}
      {showRoutineModal && (
        <RoutineSetupModal
          isOpen={showRoutineModal}
          onClose={() => setShowRoutineModal(false)}
          onSave={(updated) => setRoutine(updated)}
        />
      )}

      {/* Restore Modal */}
      {showRestoreModal && (
        <Modal
          isOpen={showRestoreModal}
          onClose={() => setShowRestoreModal(false)}
          title="Restore Data from Backup JSON"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowRestoreModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmRestore}>
                Confirm Restore
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: 0 }}>
              Paste your exported backup JSON below to restore your plans, goals, routines, and records.
            </p>
            <textarea
              rows={8}
              value={restoreText}
              onChange={(e) => setRestoreText(e.target.value)}
              placeholder="Paste JSON content here..."
              style={{
                width: '100%',
                padding: 'var(--space-3)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-xs)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </Modal>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <Modal
          isOpen={showResetModal}
          onClose={() => setShowResetModal(false)}
          title="Reset All Application Data"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowResetModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmReset}>
                Yes, Reset Everything
              </Button>
            </>
          }
        >
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)', margin: 0, lineHeight: 1.5 }}>
            Are you sure you want to reset all data? This will clear your saved plans, goals, routines, and history from local storage.
          </p>
        </Modal>
      )}
    </div>
  );
}
