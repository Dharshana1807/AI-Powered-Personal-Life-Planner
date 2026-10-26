import React from 'react';

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  showPercentage = true,
  height = '10px',
  style = {},
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100) || 0));

  return (
    <div style={{ width: '100%', marginBottom: 'var(--space-3)', ...style }}>
      {(label || showPercentage) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 'var(--space-1)',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          <span>{label}</span>
          {showPercentage && (
            <span style={{ color: 'var(--color-muted-text)', fontSize: 'var(--font-xs)' }}>
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        style={{
          width: '100%',
          height,
          backgroundColor: 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: 'var(--color-primary)',
            transition: 'width 300ms ease',
          }}
        />
      </div>
    </div>
  );
}
