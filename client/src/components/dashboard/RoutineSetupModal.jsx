import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input } from '../common/FormField.jsx';
import TimePicker from '../common/TimePicker.jsx';
import { loadSavedRoutine, saveSavedRoutine, getDefaultRoutine } from '../../utils/storage.js';
import { generateId, format12Hour } from '../../utils/dateUtils.js';

export default function RoutineSetupModal({ isOpen, onClose, onSave }) {
  const [routine, setRoutine] = useState(() => loadSavedRoutine());
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setRoutine(loadSavedRoutine());
      setError(null);
    }
  }, [isOpen]);

  const handleSave = (e) => {
    if (e) e.preventDefault();

    if (!routine.wakeTime || !routine.bedTime) {
      setError('Please provide both wake-up time and bedtime.');
      return;
    }

    const saveRes = saveSavedRoutine(routine);
    if (!saveRes.success) {
      setError(saveRes.error || 'Failed to save routine.');
      return;
    }

    if (onSave) onSave(routine);
    onClose();
  };

  const updateWorkHours = (field, val) => {
    setRoutine((prev) => ({
      ...prev,
      workHours: {
        ...(prev.workHours || { enabled: true, start: '09:00', end: '17:00', label: 'College / Classes' }),
        [field]: val,
      },
    }));
  };

  const updateMeal = (idx, field, val) => {
    setRoutine((prev) => {
      const nextMeals = [...(prev.meals || [])];
      nextMeals[idx] = { ...nextMeals[idx], [field]: val };
      return { ...prev, meals: nextMeals };
    });
  };

  const addMeal = () => {
    setRoutine((prev) => ({
      ...prev,
      meals: [
        ...(prev.meals || []),
        { id: generateId('meal'), name: 'Snack / Tea', start: '16:30', end: '17:00' },
      ],
    }));
  };

  const removeMeal = (idx) => {
    setRoutine((prev) => ({
      ...prev,
      meals: prev.meals.filter((_, i) => i !== idx),
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚙️ Regular Daily Routine"
      maxWidth="560px"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} style={{ fontWeight: 700 }}>
            💾 Save Routine
          </Button>
        </>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: 0 }}>
          Set your regular daily commitments once. When creating daily plans, this routine is reused automatically so you don't have to fill it in every time.
        </p>

        {error && (
          <div
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-danger-bg)',
              border: '1px solid var(--color-danger-border)',
              color: 'var(--color-danger-text)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
            }}
          >
            {error}
          </div>
        )}

        {/* 1. Wake & Sleep Times */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, margin: '0 0 var(--space-3)' }}>
            🌅 Sleep & Waking Hours
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <TimePicker
              id="routine-wake-time"
              label="Wake-Up Time"
              value={routine.wakeTime}
              onChange={(val) => setRoutine((p) => ({ ...p, wakeTime: val }))}
              required={true}
            />
            <TimePicker
              id="routine-bed-time"
              label="Bedtime"
              value={routine.bedTime}
              onChange={(val) => setRoutine((p) => ({ ...p, bedTime: val }))}
              required={true}
            />
          </div>
        </div>

        {/* 2. College / Work Hours */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, margin: 0 }}>
              🎓 College / Work Hours
            </h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(routine.workHours?.enabled)}
                onChange={(e) => updateWorkHours('enabled', e.target.checked)}
              />
              Enable
            </label>
          </div>

          {routine.workHours?.enabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
              <Input
                id="routine-work-label"
                label="Label"
                placeholder="College / Classes or Office"
                value={routine.workHours?.label || ''}
                onChange={(e) => updateWorkHours('label', e.target.value)}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <TimePicker
                  id="routine-work-start"
                  label="Start Time"
                  value={routine.workHours?.start || '09:00'}
                  onChange={(val) => updateWorkHours('start', val)}
                />
                <TimePicker
                  id="routine-work-end"
                  label="End Time"
                  value={routine.workHours?.end || '17:00'}
                  onChange={(val) => updateWorkHours('end', val)}
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Meals */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, margin: 0 }}>
              🥗 Daily Meals
            </h3>
            <Button variant="ghost" size="sm" type="button" onClick={addMeal}>
              + Add Meal
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {(routine.meals || []).map((meal, idx) => (
              <div
                key={meal.id || idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1fr auto',
                  gap: 'var(--space-2)',
                  alignItems: 'end',
                }}
              >
                <Input
                  id={`meal-name-${idx}`}
                  label={idx === 0 ? 'Meal Name' : undefined}
                  value={meal.name}
                  onChange={(e) => updateMeal(idx, 'name', e.target.value)}
                />
                <TimePicker
                  id={`meal-start-${idx}`}
                  label={idx === 0 ? 'Start' : undefined}
                  value={meal.start}
                  onChange={(val) => updateMeal(idx, 'start', val)}
                />
                <TimePicker
                  id={`meal-end-${idx}`}
                  label={idx === 0 ? 'End' : undefined}
                  value={meal.end}
                  onChange={(val) => updateMeal(idx, 'end', val)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => removeMeal(idx)}
                  style={{ color: 'var(--color-danger)' }}
                  title="Remove meal"
                >
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
