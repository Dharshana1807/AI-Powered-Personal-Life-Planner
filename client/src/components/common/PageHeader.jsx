import React from 'react';
import Button from './Button.jsx';

export default function PageHeader({
  title,
  description,
  badge = null,
  actions = null,
  suggestedPrompts = [],
  onPromptClick = null,
}) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: suggestedPrompts.length > 0 ? 'var(--space-3)' : 0,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h1
              style={{
                fontSize: 'var(--font-2xl)',
                fontWeight: 900,
                color: 'var(--color-text)',
                letterSpacing: '-0.5px',
                margin: 0,
              }}
            >
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p
              style={{
                fontSize: 'var(--font-sm)',
                color: 'var(--color-muted-text)',
                marginTop: 'var(--space-1)',
                lineHeight: 1.4,
                maxWidth: '750px',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {actions}
          </div>
        )}
      </div>

      {/* Context-aware Suggested AI Prompts for this page */}
      {suggestedPrompts.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flexWrap: 'wrap',
            padding: 'var(--space-2) 0',
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            💡 Ask Assistant:
          </span>
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (onPromptClick) {
                  onPromptClick(p);
                } else {
                  window.location.hash = `#/assistant?prompt=${encodeURIComponent(p)}`;
                }
              }}
              style={{
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
                color: 'var(--color-text)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-subtle)';
                e.currentTarget.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
              }}
            >
              "{p}"
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
