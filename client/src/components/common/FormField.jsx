import React from 'react';

export function Label({ htmlFor, required = false, children, style = {} }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        fontSize: 'var(--font-sm)',
        fontWeight: 600,
        color: 'var(--color-text)',
        marginBottom: 'var(--space-1)',
        ...style,
      }}
    >
      {children}
      {required && (
        <span style={{ color: 'var(--color-danger)', marginLeft: 'var(--space-1)' }} aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

export function Input({
  id,
  name,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  required = false,
  style = {},
  ...props
}) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: '100%',
          minHeight: 'var(--touch-target-min)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid',
          borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-base)',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      />
      {error && (
        <div
          id={`${id}-error`}
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-danger)',
            marginTop: 'var(--space-1)',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export function Select({
  id,
  name,
  label,
  value,
  onChange,
  options = [],
  error,
  disabled = false,
  required = false,
  style = {},
  ...props
}) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: '100%',
          minHeight: 'var(--touch-target-min)',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid',
          borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-base)',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'border-color var(--transition-fast)',
          ...style,
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <div
          id={`${id}-error`}
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-danger)',
            marginTop: 'var(--space-1)',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export function Textarea({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  error,
  disabled = false,
  required = false,
  style = {},
  ...props
}) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {label && <Label htmlFor={id} required={required}>{label}</Label>}
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        style={{
          width: '100%',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid',
          borderColor: error ? 'var(--color-danger)' : 'var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-base)',
          fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
          resize: 'vertical',
          ...style,
        }}
        {...props}
      />
      {error && (
        <div
          id={`${id}-error`}
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-danger)',
            marginTop: 'var(--space-1)',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
