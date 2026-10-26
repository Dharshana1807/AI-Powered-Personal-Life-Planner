import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input, Select } from '../common/FormField.jsx';
import Alert from '../common/Alert.jsx';
import DatePicker from '../common/DatePicker.jsx';
import TimePicker from '../common/TimePicker.jsx';
import { addGoalChecklistItem, loadSavedRoutine } from '../../utils/storage.js';
import { formatTime12h, formatTimeRange12h } from '../../utils/dateUtils.js';

export default function AddTaskModal({
  isOpen,
  onClose,
  onAddTask,
}) {
  const [destination, setDestination] = useState('plan'); // 'plan' | 'goal'
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Education');
  const [durationMinutes, setDurationMinutes] = useState('45');
  const [priority, setPriority] = useState('Medium');
  const [preferredTime, setPreferredTime] = useState('');
  const [isFlexible, setIsFlexible] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [conflictWarning, setConflictWarning] = useState(null);

  // Check routine overlap when preferredTime changes
  useEffect(() => {
    if (!preferredTime) {
      setConflictWarning(null);
      return;
    }

    const routine = loadSavedRoutine();
    const [pH, pM] = preferredTime.split(':').map(Number);
    const pStart = pH * 60 + pM;
    const dur = parseInt(durationMinutes, 10) || 45;
    const pEnd = pStart + dur;

    // Check college / work
    if (routine.workHours?.enabled && routine.workHours?.start && routine.workHours?.end) {
      const [wSh, wSm] = routine.workHours.start.split(':').map(Number);
      const [wEh, wEm] = routine.workHours.end.split(':').map(Number);
      if (Math.max(pStart, wSh * 60 + wSm) < Math.min(pEnd, wEh * 60 + wEm)) {
        setConflictWarning({
          title: routine.workHours.label || 'College / Work',
          start: routine.workHours.start,
          end: routine.workHours.end,
        });
        return;
      }
    }

    // Check meals
    for (const m of routine.meals || []) {
      if (m.start && m.end) {
        const [mSh, mSm] = m.start.split(':').map(Number);
        const [mEh, mEm] = m.end.split(':').map(Number);
        if (Math.max(pStart, mSh * 60 + mSm) < Math.min(pEnd, mEh * 60 + mEm)) {
          setConflictWarning({
            title: m.name || 'Meal',
            start: m.start,
            end: m.end,
          });
          return;
        }
      }
    }

    setConflictWarning(null);
  }, [preferredTime, durationMinutes]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Task name is required.');
      return;
    }

    if (destination === 'goal') {
      // Add straight to Goal Tracking Checklist
      addGoalChecklistItem(category.toLowerCase(), name.trim());
      setName('');
      setError(null);
      onClose();
      return;
    }

    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur) || dur <= 0) {
      setError('Duration must be a positive number of minutes.');
      return;
    }

    onAddTask({
      name: name.trim(),
      category,
      durationMinutes: dur,
      priority,
      preferredTime: preferredTime || null,
      isFlexible,
      deadlineDate: deadlineDate || null,
      deadlineTime: deadlineTime || null,
      notes,
    });

    // Reset form
    setName('');
    setDurationMinutes('45');
    setPreferredTime('');
    setIsFlexible(false);
    setDeadlineDate('');
    setDeadlineTime('');
    setNotes('');
    setError(null);
    setConflictWarning(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Task"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} style={{ fontWeight: 700 }}>
            {destination === 'goal' ? '+ Add to Goal Checklist' : '+ Add Task to Plan'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert type="error">{error}</Alert>}

        {/* Destination choice */}
        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
            Where should this task go?
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={() => setDestination('plan')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                borderColor: destination === 'plan' ? 'var(--color-primary-hover)' : 'var(--color-border)',
                backgroundColor: destination === 'plan' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                fontWeight: destination === 'plan' ? 700 : 500,
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              📅 Timed Daily Plan
            </button>
            <button
              type="button"
              onClick={() => setDestination('goal')}
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid',
                borderColor: destination === 'goal' ? 'var(--color-primary-hover)' : 'var(--color-border)',
                backgroundColor: destination === 'goal' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                fontWeight: destination === 'goal' ? 700 : 500,
                fontSize: 'var(--font-sm)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              🎯 Goal Checklist
            </button>
          </div>
        </div>

        <Input
          id="new-task-name"
          label="Task Name"
          placeholder="e.g. Complete Chemistry Lab Report"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required={true}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            id="new-task-category"
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { value: 'Education', label: 'Education' },
              { value: 'Career', label: 'Career' },
              { value: 'Fitness', label: 'Fitness' },
              { value: 'Diet', label: 'Diet' },
              { value: 'Personal', label: 'Personal' },
            ]}
          />

          {destination === 'plan' && (
            <Select
              id="new-task-priority"
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              options={[
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
            />
          )}
        </div>

        {destination === 'plan' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input
                id="new-task-duration"
                type="number"
                label="Estimated Duration (minutes)"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                required={true}
              />

              <TimePicker
                id="new-task-preferred"
                label="Preferred Time (Optional)"
                placeholder="Select preferred time..."
                value={preferredTime}
                onChange={(val) => setPreferredTime(val)}
              />
            </div>

            {/* Flexible Task Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="checkbox"
                id="modal-task-flexible"
                checked={isFlexible}
                onChange={(e) => setIsFlexible(e.target.checked)}
              />
              <label htmlFor="modal-task-flexible" style={{ fontSize: 'var(--font-xs)', cursor: 'pointer' }}>
                <strong>Flexible Task:</strong> Can be scheduled during college/work breaks or meal periods.
              </label>
            </div>

            {/* Conflict Warning */}
            {conflictWarning && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-secondary-subtle)',
                  border: '1px solid var(--color-secondary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-text)',
                }}
              >
                <strong>⚠️ Notice:</strong> Preferred time ({formatTime12h(preferredTime)}) overlaps with <strong>{conflictWarning.title}</strong> ({formatTimeRange12h(conflictWarning.start, conflictWarning.end)}).
                {!isFlexible ? (
                  <div style={{ marginTop: '2px' }}>
                    Check "Flexible Task" above to allow it during this period, or leave Preferred Time blank.
                  </div>
                ) : (
                  <div style={{ marginTop: '2px', color: 'var(--color-success-text)' }}>
                    ✓ Marked flexible: allowed during this period.
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <DatePicker
                id="new-task-dead-date"
                label="Deadline Date (Optional)"
                placeholder="Select deadline date..."
                value={deadlineDate}
                onChange={(val) => setDeadlineDate(val)}
              />

              <TimePicker
                id="new-task-dead-time"
                label="Deadline Time (Optional)"
                placeholder="Select deadline time..."
                value={deadlineTime}
                onChange={(val) => setDeadlineTime(val)}
              />
            </div>

            <Input
              id="new-task-notes"
              label="Description / notes (Optional)"
              placeholder="e.g. Focus on Section 2 equations"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        )}
      </form>
    </Modal>
  );
}
