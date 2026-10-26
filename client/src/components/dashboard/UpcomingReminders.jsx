import React, { useState, useEffect } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import { getUpcomingReminders, loadAppSettings } from '../../utils/storage.js';
import { formatTime12h, formatLocalDateString } from '../../utils/dateUtils.js';

export default function UpcomingReminders({ selectedDate, now }) {
  const [settings, setSettings] = useState(() => loadAppSettings());
  const [reminders, setReminders] = useState(() =>
    getUpcomingReminders(selectedDate, now?.currentTime || '00:00')
  );
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const refreshReminders = () => {
    setSettings(loadAppSettings());
    setReminders(getUpcomingReminders(selectedDate, now?.currentTime || '00:00'));
  };

  useEffect(() => {
    refreshReminders();
  }, [selectedDate, now]);

  const quietHours = settings.quietHours || { enabled: true, start: '22:00', end: '07:00' };
  const currentTime = now?.currentTime || '12:00';

  // Check if currently within quiet hours
  const isQuietHoursActive = Boolean(
    quietHours.enabled &&
      ((quietHours.start > quietHours.end &&
        (currentTime >= quietHours.start || currentTime < quietHours.end)) ||
        (quietHours.start <= quietHours.end &&
          currentTime >= quietHours.start &&
          currentTime < quietHours.end))
  );

  const handleRequestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotificationPermission(res);
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
    }
  };

  return (
    <Card padding="md">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '20px' }}>🔔</span>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-muted-text)' }}>
              UPCOMING & SMART REMINDERS
            </div>
            <strong style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
              Scheduled sessions, deadlines, habits & routine alerts
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {isQuietHoursActive && (
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--color-muted-text)',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
              title="Quiet hours are active right now. Alerts will not play audio."
            >
              🌙 Quiet Hours Active ({formatTime12h(quietHours.start)} - {formatTime12h(quietHours.end)})
            </span>
          )}

          <a
            href="#/settings/reminders"
            style={{
              fontSize: 'var(--font-xs)',
              fontWeight: 700,
              color: 'var(--color-text)',
              textDecoration: 'none',
              padding: '4px 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            ⚙️ Reminder Settings
          </a>
        </div>
      </div>

      {/* Browser Notification Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          padding: '6px 12px',
          backgroundColor: 'var(--color-surface-hover)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '11px',
          color: 'var(--color-muted-text)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span>
          ℹ️ <strong>Lead Time:</strong> Alerts trigger {settings.reminders?.leadTimeMinutes || 15} minutes before start. Reminders operate while tab is open.
        </span>

        {notificationPermission === 'default' && (
          <button
            type="button"
            onClick={handleRequestPermission}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-info)',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            Enable Browser Alerts
          </button>
        )}
        {notificationPermission === 'granted' && (
          <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>
            🟢 Browser Alerts Active (In-Tab)
          </span>
        )}
      </div>

      {/* List of Reminders */}
      {reminders.length === 0 ? (
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
          🎉 All caught up! No upcoming deadlines or routine alerts for this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {reminders.slice(0, 6).map((rem) => (
            <div
              key={rem.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span style={{ fontSize: '16px' }}>{rem.icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
                      {rem.title}
                    </span>
                    <Badge type="status" value={rem.priority === 'High' ? 'rescheduled' : 'pending'} label={rem.category} />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                    {rem.date === selectedDate ? 'Today' : rem.date} at {formatTime12h(rem.time)}
                  </div>
                </div>
              </div>

              <a
                href={rem.sourceUrl}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  textDecoration: 'none',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-hover)',
                }}
              >
                View &rarr;
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
