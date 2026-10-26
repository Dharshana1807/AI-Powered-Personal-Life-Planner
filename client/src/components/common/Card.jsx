import React from 'react';

export default function Card({
  children,
  highlight = null, // null | 'yellow' | 'orange'
  padding = 'md',    // 'sm' | 'md' | 'lg' | 'none'
  className = '',
  style = {},
  ...props
}) {
  const paddingMap = {
    none: '0',
    sm: 'var(--space-3)',
    md: 'var(--space-5)',
    lg: 'var(--space-6)',
  };

  const highlightBorder =
    highlight === 'yellow'
      ? { borderLeft: '4px solid var(--color-primary)' }
      : highlight === 'orange'
      ? { borderLeft: '4px solid var(--color-secondary-hover)', backgroundColor: 'var(--color-secondary-subtle)' }
      : {};

  const cardStyle = {
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: paddingMap[padding] || paddingMap.md,
    boxShadow: 'var(--shadow-sm)',
    transition: 'border-color var(--transition-fast)',
    boxSizing: 'border-box',
    ...highlightBorder,
    ...style,
  };

  return (
    <div style={cardStyle} className={`card-component ${className}`} {...props}>
      {children}
    </div>
  );
}
