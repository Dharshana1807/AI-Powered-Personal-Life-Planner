import React from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';

export default function NutritionProgressBars({ totals, targets, onOpenEditTargets }) {
  const calPercent = Math.min(100, Math.round(((totals.calories || 0) / (targets.calories || 2100)) * 100));
  const proPercent = Math.min(100, Math.round(((totals.protein || 0) / (targets.protein || 110)) * 100));
  const fibPercent = Math.min(100, Math.round(((totals.fiber || 0) / (targets.fiber || 35)) * 100));
  const carbPercent = Math.min(100, Math.round(((totals.carbs || 0) / (targets.carbs || 260)) * 100));
  const fatPercent = Math.min(100, Math.round(((totals.fat || 0) / (targets.fat || 60)) * 100));

  const items = [
    {
      label: 'Calories',
      consumed: `${totals.calories} kcal`,
      target: `${targets.calories} kcal`,
      percent: calPercent,
      color: 'var(--color-primary-active)', // Yellow accent
      subtleColor: 'var(--color-primary-subtle)',
      icon: '⚡',
    },
    {
      label: 'Protein',
      consumed: `${totals.protein}g`,
      target: `${targets.protein}g`,
      percent: proPercent,
      color: 'var(--color-secondary-accent)', // Orange highlight
      subtleColor: 'var(--color-secondary-subtle)',
      icon: '🍗',
    },
    {
      label: 'Fiber',
      consumed: `${totals.fiber}g`,
      target: `${targets.fiber}g`,
      percent: fibPercent,
      color: 'var(--color-success)',
      subtleColor: 'var(--color-success-bg)',
      icon: '🌱',
    },
    {
      label: 'Carbs',
      consumed: `${totals.carbs}g`,
      target: `${targets.carbs}g`,
      percent: carbPercent,
      color: '#D97706', // warm amber
      subtleColor: '#FEF3C7',
      icon: '🍚',
    },
    {
      label: 'Fat',
      consumed: `${totals.fat}g`,
      target: `${targets.fat}g`,
      percent: fatPercent,
      color: '#4B5563', // charcoal
      subtleColor: '#F3F4F6',
      icon: '🥑',
    },
  ];

  return (
    <Card padding="md" style={{ marginBottom: 'var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            DAILY CONSUMPTION PROGRESS
          </div>
          <div style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
            Consumed vs Daily Targets
          </div>
        </div>

        {onOpenEditTargets && (
          <Button size="sm" variant="outline" onClick={onOpenEditTargets} title="Adjust your daily nutrition goals">
            🎯 Edit Targets
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              padding: 'var(--space-3)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                {it.icon} {it.label}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: it.subtleColor,
                  color: it.color,
                }}
              >
                {it.percent}%
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)' }}>
                {it.consumed}
              </span>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                / {it.target}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '7px',
                backgroundColor: 'var(--color-border)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${it.percent}%`,
                  height: '100%',
                  backgroundColor: it.color,
                  transition: 'width 250ms ease',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
