import React from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import EmptyState from '../common/EmptyState.jsx';
import { formatTime12h } from '../../utils/dateUtils.js';

export default function FoodLogList({
  date,
  meals = [],
  totals,
  onOpenLogModal,
  onEditMeal,
  onDeleteMeal,
}) {
  const getMealTypeBadge = (mealType) => {
    const type = (mealType || 'Meal').toLowerCase();
    let badgeColor = 'var(--color-primary-active)';
    let badgeBg = 'var(--color-primary-subtle)';

    if (type.includes('breakfast')) {
      badgeColor = '#D97706';
      badgeBg = '#FEF3C7';
    } else if (type.includes('lunch')) {
      badgeColor = '#16A34A';
      badgeBg = '#DCFCE7';
    } else if (type.includes('snack')) {
      badgeColor = '#EA580C';
      badgeBg = '#FFEDD5';
    } else if (type.includes('dinner')) {
      badgeColor = '#2563EB';
      badgeBg = '#DBEAFE';
    }

    return (
      <span
        style={{
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          padding: '2px 8px',
          borderRadius: 'var(--radius-full)',
          color: badgeColor,
          backgroundColor: badgeBg,
        }}
      >
        {mealType}
      </span>
    );
  };

  return (
    <Card padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
      {/* Header Bar */}
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
            DAILY FOOD LOG
          </div>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '2px 0 0', color: 'var(--color-text)' }}>
            Consumed Meals for {date} ({meals.length})
          </h2>
        </div>

        <Button variant="primary" size="sm" onClick={() => onOpenLogModal()}>
          + Log Eaten Meal
        </Button>
      </div>

      {/* Empty State */}
      {meals.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-6)',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--color-border)',
          }}
        >
          <div style={{ fontSize: '28px', marginBottom: 'var(--space-2)' }}>🍽️</div>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 700, margin: '0 0 var(--space-1)' }}>
            No meals logged for this date yet
          </h3>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '0 0 var(--space-4)' }}>
            Record breakfast, lunch, snacks, or dinner to calculate your calories, protein, fiber, carbs, and fat.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenLogModal()}>
            + Log First Meal
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {meals.map((meal) => (
            <div
              key={meal.id}
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                transition: 'border-color var(--transition-fast)',
              }}
            >
              {/* Meal Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {getMealTypeBadge(meal.mealType)}
                  <strong style={{ fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                    {meal.name || meal.mealType}
                  </strong>
                  {meal.time && (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                      • {formatTime12h(meal.time)}
                    </span>
                  )}
                  {meal.fromPlannedId && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        backgroundColor: 'var(--color-success-bg)',
                        color: 'var(--color-success-text)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                      }}
                    >
                      ✓ From Plan
                    </span>
                  )}
                </div>

                {/* Edit & Delete Action Buttons */}
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditMeal(meal)}
                    title="Edit meal foods, quantities, or type"
                  >
                    ✏️ Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (window.confirm(`Delete logged meal "${meal.name || meal.mealType}"? This will recalculate your daily totals.`)) {
                        onDeleteMeal(meal.id);
                      }
                    }}
                    style={{ color: 'var(--color-danger)' }}
                    title="Delete meal from log"
                  >
                    🗑️
                  </Button>
                </div>
              </div>

              {/* Items List */}
              {Array.isArray(meal.items) && meal.items.length > 0 && (
                <div
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    backgroundColor: 'var(--color-surface-hover)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-xs)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}
                >
                  {meal.items.map((item, idx) => (
                    <span
                      key={item.id || idx}
                      style={{
                        padding: '3px 8px',
                        backgroundColor: 'var(--color-bg)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text)',
                      }}
                    >
                      <strong>{item.quantity} {item.unit}</strong> {item.foodName}
                      <span style={{ color: 'var(--color-muted-text)', marginLeft: '4px' }}>
                        ({item.calories} kcal)
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Nutrition Tag Strip */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-primary-subtle)',
                    color: 'var(--color-text)',
                  }}
                >
                  ⚡ {meal.calories} kcal
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-secondary-subtle)',
                    color: 'var(--color-secondary-accent)',
                  }}
                >
                  🍗 {meal.protein}g Protein
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'var(--color-success-bg)',
                    color: 'var(--color-success-text)',
                  }}
                >
                  🌱 {meal.fiber}g Fiber
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                  }}
                >
                  🍚 {meal.carbs}g Carbs
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#F3F4F6',
                    color: '#4B5563',
                  }}
                >
                  🥑 {meal.fat}g Fat
                </span>
              </div>
            </div>
          ))}

          {/* Running Day's Total Footer */}
          {totals && (
            <div
              style={{
                marginTop: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'var(--color-primary-subtle)',
                border: '1px solid var(--color-primary-active)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
              }}
            >
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 800, textTransform: 'uppercase' }}>
                DAY'S RUNNING CONSUMPTION TOTAL:
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', fontSize: 'var(--font-sm)', fontWeight: 700 }}>
                <span>⚡ {totals.calories} kcal</span>
                <span>🍗 {totals.protein}g Protein</span>
                <span>🌱 {totals.fiber}g Fiber</span>
                <span>🍚 {totals.carbs}g Carbs</span>
                <span>🥑 {totals.fat}g Fat</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
