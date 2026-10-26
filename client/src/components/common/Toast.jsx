import React, { useState, useEffect, useRef } from 'react';
import Button from './Button.jsx';

/**
 * Shared Toast Notification with Undo Support.
 * - 8000ms countdown progress line.
 * - Pauses countdown while hovered or focused.
 * - Uses aria-live="polite" for screen-reader accessibility.
 * - Remains visible across section changes.
 */
export default function Toast({
  message,
  type = 'success', // 'success' | 'info' | 'error' | 'warning'
  onUndo,
  onDismiss,
  durationMs = 8000,
}) {
  const [timeLeft, setTimeLeft] = useState(durationMs);
  const isPausedRef = useRef(false);
  const remainingRef = useRef(durationMs);

  useEffect(() => {
    if (!message) return;

    remainingRef.current = durationMs;
    setTimeLeft(durationMs);
    isPausedRef.current = false;

    const interval = setInterval(() => {
      if (!isPausedRef.current) {
        remainingRef.current -= 100;
        setTimeLeft(Math.max(0, remainingRef.current));
        if (remainingRef.current <= 0) {
          clearInterval(interval);
          if (onDismiss) onDismiss();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  const percentage = Math.max(0, (timeLeft / durationMs) * 100);

  return (
    <div
      role="region"
      aria-live="polite"
      tabIndex={0}
      onMouseEnter={() => {
        isPausedRef.current = true;
      }}
      onMouseLeave={() => {
        isPausedRef.current = false;
      }}
      onFocus={() => {
        isPausedRef.current = true;
      }}
      onBlur={() => {
        isPausedRef.current = false;
      }}
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        right: 'var(--space-6)',
        zIndex: 1000,
        maxWidth: '440px',
        width: 'calc(100% - 32px)',
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        overflow: 'hidden',
        boxSizing: 'border-box',
        outline: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          gap: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flex: 1 }}>
          <span style={{ fontSize: '18px' }} aria-hidden="true">
            {type === 'success' ? '✓' : type === 'error' ? '⚠️' : type === 'warning' ? '⚡' : 'ℹ️'}
          </span>
          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
            {message}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {onUndo && (
            <Button
              variant="primary"
              size="sm"
              onClick={onUndo}
              style={{ fontWeight: 800, padding: '4px 12px', minHeight: '32px' }}
            >
              ↩ Undo
            </Button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted-text)',
              fontSize: '20px',
              lineHeight: 1,
              padding: '4px 8px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Countdown progress indicator line */}
      <div
        style={{
          height: '3px',
          width: '100%',
          backgroundColor: 'var(--color-border)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: 'var(--color-primary)',
            transition: 'width 100ms linear',
          }}
        />
      </div>
    </div>
  );
}
