import React, { useState, useEffect } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import {
  loadNutritionState,
  getDailyConsumedTotals,
  NUTRITION_UPDATE_EVENT,
} from '../../utils/nutritionStorage.js';

export default function DietDashboardSummary({ selectedDate }) {
  const [nutritionState, setNutritionState] = useState(() => loadNutritionState());
  const [consumedTotals, setConsumedTotals] = useState(() => getDailyConsumedTotals(selectedDate));

  const refreshData = () => {
    const state = loadNutritionState();
    setNutritionState(state);
    setConsumedTotals(getDailyConsumedTotals(selectedDate));
  };

  useEffect(() => {
    refreshData();
  }, [selectedDate]);

  useEffect(() => {
    const handleUpdate = () => {
      refreshData();
    };
    window.addEventListener(NUTRITION_UPDATE_EVENT, handleUpdate);
    return () => window.removeEventListener(NUTRITION_UPDATE_EVENT, handleUpdate);
  }, [selectedDate]);

  const targets = nutritionState.targets || {
    calories: 2100,
    protein: 110,
    fiber: 35,
    carbs: 260,
    fat: 60,
  };

  const calPercent = Math.min(100, Math.round(((consumedTotals.calories || 0) / (targets.calories || 2100)) * 100));
  const proPercent = Math.min(100, Math.round(((consumedTotals.protein || 0) / (targets.protein || 110)) * 100));
  const fibPercent = Math.min(100, Math.round(((consumedTotals.fiber || 0) / (targets.fiber || 35)) * 100));

  return (
    <Card padding="md" style={{ marginBottom: 'var(--space-4)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '18px' }}>🥗</span>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
              NUTRITION & MEAL TRACKING SUMMARY
            </div>
            <strong style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
              Consumed vs Targets ({consumedTotals.mealCount} meal{consumedTotals.mealCount === 1 ? '' : 's'} logged)
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (window.location.hash = '#/nutrition')}
            title="Open Diet and Nutrition Page"
          >
            🍽️ Open Meal Tracker
          </Button>
        </div>
      </div>

      {/* Progress Bars Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
        {/* Calories */}
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', fontWeight: 700 }}>
            <span>⚡ Calories</span>
            <span style={{ color: 'var(--color-primary-active)' }}>{calPercent}%</span>
          </div>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: '2px 0 6px' }}>
            {consumedTotals.calories}{' '}
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--color-muted-text)' }}>
              / {targets.calories} kcal
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${calPercent}%`, height: '100%', backgroundColor: 'var(--color-primary-active)' }} />
          </div>
        </div>

        {/* Protein */}
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', fontWeight: 700 }}>
            <span>🍗 Protein</span>
            <span style={{ color: 'var(--color-secondary-accent)' }}>{proPercent}%</span>
          </div>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: '2px 0 6px' }}>
            {consumedTotals.protein}g{' '}
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--color-muted-text)' }}>
              / {targets.protein}g
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${proPercent}%`, height: '100%', backgroundColor: 'var(--color-secondary-accent)' }} />
          </div>
        </div>

        {/* Fiber */}
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', fontWeight: 700 }}>
            <span>🌱 Fiber</span>
            <span style={{ color: 'var(--color-success)' }}>{fibPercent}%</span>
          </div>
          <div style={{ fontSize: 'var(--font-base)', fontWeight: 800, margin: '2px 0 6px' }}>
            {consumedTotals.fiber}g{' '}
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 500, color: 'var(--color-muted-text)' }}>
              / {targets.fiber}g
            </span>
          </div>
          <div style={{ height: '6px', backgroundColor: 'var(--color-border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
            <div style={{ width: `${fibPercent}%`, height: '100%', backgroundColor: 'var(--color-success)' }} />
          </div>
        </div>

        {/* Carbs & Fat overview */}
        <div
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
            <strong>🍚 Carbs:</strong> {consumedTotals.carbs}g / {targets.carbs}g
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
            <strong>🥑 Fat:</strong> {consumedTotals.fat}g / {targets.fat}g
          </div>
        </div>
      </div>

      {/* Planned vs Confirmed Meals Footnote */}
      <div
        style={{
          marginTop: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 'var(--space-2)',
          fontSize: '11px',
          color: 'var(--color-muted-text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span>
            📋 <strong>{Object.entries(nutritionState.mealPlan?.[selectedDate] || {}).filter(([_, v]) => Boolean(v)).length}</strong> Planned Meals (Estimates)
          </span>
          <span>
            ✓ <strong>{consumedTotals.mealCount}</strong> Confirmed Eaten
          </span>
        </div>
        <div style={{ fontStyle: 'italic' }}>
          *Only confirmed eaten meals count toward actual intake. Planned meals are estimates and never double-counted.
        </div>
      </div>
    </Card>
  );
}
