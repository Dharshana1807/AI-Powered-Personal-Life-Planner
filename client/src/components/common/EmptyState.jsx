import React from 'react';

export default function EmptyState({
  icon = '📋',
  title = 'No items found',
  description = 'There is currently no data to display.',
  action,
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-8) var(--space-4)',
        backgroundColor: 'var(--color-surface)',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <div
        style={{
          fontSize: '36px',
          marginBottom: 'var(--space-3)',
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3
        style={{
          fontSize: 'var(--font-lg)',
          fontWeight: 700,
          color: 'var(--color-text)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 'var(--font-sm)',
          color: 'var(--color-muted-text)',
          maxWidth: '440px',
          marginBottom: action ? 'var(--space-5)' : 0,
        }}
      >
        {description}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
}
