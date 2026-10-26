import React from 'react';

export default function Alert({
  type = 'info', // 'info' | 'success' | 'error'
  title,
  children,
  onClose,
  style = {},
}) {
  const configs = {
    info: {
      bg: 'var(--color-info-bg)',
      border: 'var(--color-info-border)',
      text: 'var(--color-info-text)',
      icon: 'ℹ️',
      role: 'status',
    },
    success: {
      bg: 'var(--color-success-bg)',
      border: 'var(--color-success-border)',
      text: 'var(--color-success-text)',
      icon: '✓',
      role: 'status',
    },
    error: {
      bg: 'var(--color-danger-bg)',
      border: 'var(--color-danger-border)',
      text: 'var(--color-danger-text)',
      icon: '⚠️',
      role: 'alert',
    },
  };

  const current = configs[type] || configs.info;

  return (
    <div
      role={current.role}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: current.bg,
        border: '1px solid',
        borderColor: current.border,
        color: current.text,
        fontSize: 'var(--font-sm)',
        marginBottom: 'var(--space-4)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: 'var(--font-md)' }} aria-hidden="true">
        {current.icon}
      </span>
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 700, marginBottom: '2px' }}>{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          style={{
            background: 'transparent',
            border: 'none',
            color: current.text,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 'var(--font-md)',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
}
