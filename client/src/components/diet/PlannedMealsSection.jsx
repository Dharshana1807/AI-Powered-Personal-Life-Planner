import React, { useState } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import Modal from '../common/Modal.jsx';
import { formatTime12h } from '../../utils/dateUtils.js';

export default function PlannedMealsSection({
  date,
  plannedMeals = [],
  onMarkAsEaten,
  onUnmarkAsEaten,
  onOpenLogModalWithMeal,
}) {
  const [confirmModalMeal, setConfirmModalMeal] = useState(null);

  const handleConfirmDirect = () => {
    if (!confirmModalMeal) return;
    onMarkAsEaten(confirmModalMeal);
    setConfirmModalMeal(null);
  };

  const handleCustomizeEaten = () => {
    if (!confirmModalMeal) return;
    const meal = confirmModalMeal;
    setConfirmModalMeal(null);
    if (onOpenLogModalWithMeal) {
      onOpenLogModalWithMeal(meal);
    }
  };

  return (
    <Card padding="lg" style={{ marginBottom: 'var(--space-6)' }}>
      {/* Header */}
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
        <div>
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            SCHEDULED TIMETABLE INTEGRATION
          </div>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: '2px 0 0', color: 'var(--color-text)' }}>
            Planned Meals for {date} ({plannedMeals.length})
          </h2>
        </div>

        <span
          style={{
            fontSize: '11px',
            padding: '3px 8px',
            backgroundColor: 'var(--color-secondary-subtle)',
            color: 'var(--color-secondary-accent)',
            border: '1px solid var(--color-secondary)',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 700,
          }}
        >
          🔒 Strict Separation: Planned ≠ Consumed
        </span>
      </div>

      {/* Safety Notice Banner */}
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-surface-hover)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-muted-text)',
          marginBottom: 'var(--space-4)',
          lineHeight: 1.4,
        }}
      >
        Planned meals from your daily routine do <strong>not</strong> count toward your daily macro totals. Click <strong>"Mark as eaten"</strong> only after you consume the meal. You can revert it anytime with <strong>"Mark as not eaten"</strong>.
      </div>

      {plannedMeals.length === 0 ? (
        <div
          style={{
            padding: 'var(--space-4)',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-muted-text)',
            fontSize: 'var(--font-sm)',
          }}
        >
          No planned meals scheduled for {date}. You can configure meal times in your Regular Routine or Daily Planner.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
          {plannedMeals.map((planned) => {
            const isEaten = Boolean(planned.eaten);

            return (
              <div
                key={planned.id}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: isEaten ? 'var(--color-success-bg)' : 'var(--color-surface)',
                  border: '1px solid',
                  borderColor: isEaten ? 'var(--color-success-border)' : 'var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                    {planned.name}
                  </strong>
                  {isEaten ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        backgroundColor: 'var(--color-success)',
                        color: '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      ✓ Consumed
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-surface-hover)',
                        color: 'var(--color-muted-text)',
                        border: '1px solid var(--color-border)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                      }}
                    >
                      Planned
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                  {planned.startTime && planned.endTime ? (
                    <span>⏱ {formatTime12h(planned.startTime)} – {formatTime12h(planned.endTime)}</span>
                  ) : (
                    <span>Planned Routine Meal</span>
                  )}
                </div>

                <div style={{ fontSize: '11px', color: 'var(--color-muted-text)' }}>
                  Estimated: ~{planned.estimatedCalories || 400} kcal • ~{planned.estimatedProtein || 18}g Protein • ~{planned.estimatedFiber || 6}g Fiber
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-1)' }}>
                  {isEaten ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUnmarkAsEaten(planned.id)}
                      title="Undo consumed status and remove from food log"
                    >
                      ↩️ Mark as not eaten
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setConfirmModalMeal(planned)}
                      title="Confirm this meal as eaten and record to consumed totals"
                    >
                      ✅ Mark as eaten
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal when Marking Planned Meal as Eaten */}
      {confirmModalMeal && (
        <Modal
          isOpen={Boolean(confirmModalMeal)}
          onClose={() => setConfirmModalMeal(null)}
          title={`Confirm Consumption: ${confirmModalMeal.name}`}
          maxWidth="480px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)', margin: 0 }}>
              Did you eat your scheduled <strong>{confirmModalMeal.name}</strong>?
            </p>

            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'var(--color-primary-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-xs)',
                lineHeight: 1.5,
              }}
            >
              Estimated standard values:
              <br />
              <strong>~{confirmModalMeal.estimatedCalories || 400} kcal</strong> •{' '}
              <strong>~{confirmModalMeal.estimatedProtein || 18}g protein</strong> •{' '}
              <strong>~{confirmModalMeal.estimatedFiber || 6}g fiber</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setConfirmModalMeal(null)}>
                Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleCustomizeEaten}>
                ✏️ Customize Foods Eaten
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmDirect}>
                ✓ Confirm Eaten
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}
