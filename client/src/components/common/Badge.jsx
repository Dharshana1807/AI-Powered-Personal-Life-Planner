import React from 'react';

export default function Badge({
  type = 'status', // 'status' | 'priority' | 'custom'
  value = 'pending',
  label,
  variant, // override if custom
  className = '',
  style = {},
}) {
  const normalized = (value || '').toLowerCase();

  // Color mapping based strictly on tokens
  const badgeConfig = {
    // Status types
    pending: {
      bg: 'var(--color-surface-hover)',
      text: 'var(--color-muted-text)',
      border: 'var(--color-border)',
      defaultLabel: 'Pending',
    },
    completed: {
      bg: 'var(--color-success-bg)',
      text: 'var(--color-success-text)',
      border: 'var(--color-success-border)',
      defaultLabel: 'Completed',
    },
    skipped: {
      bg: 'var(--color-surface-hover)',
      text: 'var(--color-muted-text)',
      border: 'var(--color-border)',
      defaultLabel: 'Skipped',
    },
    in_progress: {
      bg: 'var(--color-primary-subtle)',
      text: 'var(--color-text)',
      border: 'var(--color-primary)',
      defaultLabel: 'In Progress',
    },
    rescheduled: {
      bg: 'var(--color-secondary)',
      text: 'var(--color-text)',
      border: 'var(--color-secondary-hover)',
      defaultLabel: 'Rescheduled',
    },

    // Priority types
    high: {
      bg: 'var(--color-danger-bg)',
      text: 'var(--color-danger-text)',
      border: 'var(--color-danger-border)',
      defaultLabel: 'High Priority',
    },
    medium: {
      bg: 'var(--color-primary)',
      text: 'var(--color-text)',
      border: 'var(--color-primary-hover)',
      defaultLabel: 'Medium Priority',
    },
    low: {
      bg: 'var(--color-secondary)',
      text: 'var(--color-text)',
      border: 'var(--color-secondary-hover)',
      defaultLabel: 'Low Priority',
    },

    // Day-part types (Requirement #2 & #5: soft colors)
    morning: {
      bg: 'var(--color-primary-subtle)', // soft light yellow
      text: 'var(--color-text)',
      border: '#F5C400',
      defaultLabel: 'Morning',
    },
    afternoon: {
      bg: 'var(--color-secondary-subtle)', // soft light orange
      text: 'var(--color-text)',
      border: '#FFCC80',
      defaultLabel: 'Afternoon',
    },
    evening: {
      bg: '#FFE0B2', // soft light orange
      text: 'var(--color-text)',
      border: '#FFB74D',
      defaultLabel: 'Evening',
    },
    night: {
      bg: '#F3F4F6', // soft light grey
      text: 'var(--color-muted-text)',
      border: '#D1D5DB',
      defaultLabel: 'Night',
    },
  };

  const current = badgeConfig[normalized] || {
    bg: 'var(--color-surface-hover)',
    text: 'var(--color-text)',
    border: 'var(--color-border)',
    defaultLabel: value,
  };

  return (
    <span
      className={`badge-component badge-${normalized} ${className}`.trim()}
      data-testid={`badge-${normalized}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '2px 8px',
        fontSize: 'var(--font-xs)',
        fontWeight: 600,
        borderRadius: 'var(--radius-full)',
        backgroundColor: current.bg,
        color: current.text,
        border: '1px solid',
        borderColor: current.border,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label || current.defaultLabel}
    </span>
  );
}
