import React from 'react';

export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'outline' | 'ghost'
  size = 'md',        // 'sm' | 'md' | 'lg'
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  title,
  className = '',
  style = {},
  ...props
}) {
  // Variant color definitions using tokens only
  const variantStyles = {
    primary: {
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-text)',
      borderColor: 'var(--color-primary-hover)',
    },
    secondary: {
      backgroundColor: 'var(--color-secondary)',
      color: 'var(--color-text)',
      borderColor: 'var(--color-secondary-hover)',
    },
    outline: {
      backgroundColor: 'var(--color-surface)',
      color: 'var(--color-text)',
      borderColor: 'var(--color-border)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: 'var(--color-text)',
      borderColor: 'transparent',
    },
  };

  const sizeStyles = {
    sm: {
      minHeight: 'var(--touch-target-min)',
      padding: 'var(--space-2) var(--space-3)',
      fontSize: 'var(--font-sm)',
    },
    md: {
      minHeight: 'var(--touch-target-min)',
      padding: 'var(--space-2) var(--space-4)',
      fontSize: 'var(--font-base)',
    },
    lg: {
      minHeight: '48px',
      padding: 'var(--space-3) var(--space-6)',
      fontSize: 'var(--font-md)',
    },
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-2)',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    borderRadius: 'var(--radius-md)',
    borderWidth: '1px',
    borderStyle: 'solid',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    transition: 'all var(--transition-fast)',
    textDecoration: 'none',
    boxSizing: 'border-box',
    ...currentVariant,
    ...currentSize,
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={disabled || loading ? undefined : onClick}
      title={disabled && !title ? 'Coming soon' : title}
      style={baseStyle}
      className={`btn-component ${className}`}
      {...props}
    >
      {loading && (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid var(--color-text)',
            borderTopColor: 'transparent',
            borderRadius: 'var(--radius-full)',
            animation: 'spin 0.7s linear infinite',
            display: 'inline-block',
          }}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
