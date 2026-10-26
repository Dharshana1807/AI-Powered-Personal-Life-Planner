import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import { Input, Select } from '../components/common/FormField.jsx';
import Badge from '../components/common/Badge.jsx';
import Alert from '../components/common/Alert.jsx';
import Modal from '../components/common/Modal.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import RoutineSetupModal from '../components/dashboard/RoutineSetupModal.jsx';
import {
  loadAppSettings,
  saveAppSettings,
  exportFullBackup,
  restoreFromBackup,
  resetAllData,
  loadChangeHistory,
  loadSavedRoutine,
} from '../utils/storage.js';
import { formatTime12h, formatTimeRange12h } from '../utils/dateUtils.js';

export default function Settings() {
  const [settings, setSettings] = useState(() => loadAppSettings());
  const [routine, setRoutine] = useState(() => loadSavedRoutine());
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [historyList, setHistoryList] = useState(() => loadChangeHistory());
  const [serverHealth, setServerHealth] = useState(null);
  const [statusNotice, setStatusNotice] = useState(null);
  const [restoreText, setRestoreText] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setServerHealth(data))
      .catch((err) => setServerHealth({ status: 'error', error: err.message }));
  }, []);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    saveAppSettings(settings);
    if (settings.userName) {
      try {
        localStorage.setItem('adaptive_planner_username', settings.userName.trim());
      } catch {}
    }
    setStatusNotice({ type: 'success', text: 'Settings saved successfully.' });
    setTimeout(() => setStatusNotice(null), 3000);
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
      setStatusNotice({ type: 'success', text: 'Backup restored successfully! All records updated.' });
    } else {
      setStatusNotice({ type: 'error', text: res.error });
    }
  };

  const handleConfirmReset = () => {
    resetAllData();
    setShowResetModal(false);
    setSettings(loadAppSettings());
    setRoutine(loadSavedRoutine());
    setHistoryList([]);
    setStatusNotice({ type: 'info', text: 'All data has been reset to defaults.' });
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <PageHeader
        title="Settings & System Preferences"
        description="Manage your profile, routine commitments, quiet hours, unified storage backup, and AI connection status."
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {/* 1. Profile & Role */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            👤 User Profile & Role
          </h2>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
              <Input
                id="settings-username"
                label="Full Name / Display Name"
                value={settings.userName || ''}
                onChange={(e) => setSettings((p) => ({ ...p, userName: e.target.value }))}
                placeholder="e.g. Alex"
              />
              <Input
                id="settings-userrole"
                label="Primary Role / Goal"
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

        {/* 2. AI Connection Status */}
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: 0 }}>
                🤖 Gemini AI Assistant Integration
              </h2>
              <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', marginTop: '4px' }}>
                Server-side configuration and unified assistant status. The API key is stored securely on the server only.
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
            <div><strong>Server Time:</strong> {serverHealth?.timestamp ? new Date(serverHealth.timestamp).toLocaleTimeString() : '—'}</div>
            <div><strong>Rule:</strong> AI only proposes; never directly alters stored timetables without confirmation.</div>
          </div>
        </Card>

        {/* 3. Routine Setup Shortcut */}
        <Card padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: 0 }}>
                ⚙️ Regular Routine & Protected Times
              </h2>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: '6px' }}>
                <span>🌅 Wake: <strong>{formatTime12h(routine.wakeTime)}</strong></span>
                <span>🌙 Sleep: <strong>{formatTime12h(routine.bedTime)}</strong></span>
                {routine.workHours?.enabled && (
                  <span>💼 Work/College: <strong>{formatTimeRange12h(routine.workHours.start, routine.workHours.end)}</strong></span>
                )}
                <span>🥗 Meals: <strong>{(routine.meals || []).length} scheduled</strong></span>
              </div>
            </div>

            <Button variant="outline" onClick={() => setShowRoutineModal(true)}>
              Edit Routine
            </Button>
          </div>
        </Card>

        {/* 4. Display & Time Settings */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-4)' }}>
            🕒 Time Format & Day-Part Grouping
          </h2>
          <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>✓</span>
              <span><strong>User-Visible Times:</strong> 12-hour AM/PM format with no leading zeros on hour (e.g. <code>6:00 AM - 8:00 AM</code>, <code>4:30 PM</code>).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>✓</span>
              <span><strong>Day-Part Classification:</strong> Morning (5:00 AM - 11:59 AM), Afternoon (12:00 PM - 4:59 PM), Evening (5:00 PM - 8:59 PM), Night (9:00 PM - 4:59 AM) based on block start time.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>✓</span>
              <span><strong>Internal Storage:</strong> ISO 24-hour strings (<code>HH:mm</code>) for consistency and safety.</span>
            </div>
          </div>
        </Card>

        {/* 5. Backup, Restore & Reset */}
        <Card padding="lg">
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
            💾 Data Management & Backup
          </h2>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)' }}>
            Your data is stored locally in your browser. Create backups to keep your plans, goals, and history safe.
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

        {/* 6. Recent Change History */}
        {historyList.length > 0 && (
          <Card padding="lg">
            <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '0 0 var(--space-3)' }}>
              📜 Recent Change Log (Audit History)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {historyList.slice(0, 5).map((h) => (
                <div
                  key={h.id}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-surface-hover)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-xs)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong>{h.action}:</strong> {h.summary}
                  </div>
                  <span style={{ color: 'var(--color-muted-text)' }}>
                    {new Date(h.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

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
