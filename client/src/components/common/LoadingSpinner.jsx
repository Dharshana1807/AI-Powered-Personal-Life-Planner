import React from 'react';

export default function LoadingSpinner({
  size = 'md', // 'sm' | 'md' | 'lg'
  label = 'Loading...',
  style = {},
}) {
  const sizeMap = {
    sm: '16px',
    md: '24px',
    lg: '36px',
  };

  const dim = sizeMap[size] || sizeMap.md;

  return (
    <div
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        color: 'var(--color-muted-text)',
        fontSize: 'var(--font-sm)',
        ...style,
      }}
    >
      <div
        style={{
          width: dim,
          height: dim,
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: 'var(--radius-full)',
          animation: 'spin 0.8s linear infinite',
          boxSizing: 'border-box',
        }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
