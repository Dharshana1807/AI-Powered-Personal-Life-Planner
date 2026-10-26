import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input, Label } from '../common/FormField.jsx';
import Alert from '../common/Alert.jsx';
import TimePicker from '../common/TimePicker.jsx';
import { format12Hour, formatTimeRange12h } from '../../utils/dateUtils.js';
import {
  timeToMinutes,
  minutesToTime,
  isWithinWakeHours,
  checkIntervalConflict,
} from '../../../../shared/conflictEngine.js';

export default function RescheduleModal({
  isOpen,
  onClose,
  task,
  plan,
  onConfirmReschedule,
}) {
  const [newStartTime, setNewStartTime] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [softWarning, setSoftWarning] = useState(null);
  const [allowSoftConflict, setAllowSoftConflict] = useState(false);

  useEffect(() => {
    if (task) {
      setNewStartTime(task.scheduledStart || '');
      setValidationError(null);
      setSoftWarning(null);
      setAllowSoftConflict(false);
    }
  }, [task, isOpen]);

  if (!task || !isOpen) return null;

  const duration = Number(task.durationMinutes) || 30;

  // Compute calculated end time
  const getEndTime = (startStr) => {
    const s = timeToMinutes(startStr);
    if (isNaN(s)) return '';
    return minutesToTime(s + duration);
  };

  const currentEndTime = getEndTime(newStartTime);

  // Validate proposed new time
  const handleValidateAndSubmit = () => {
    setValidationError(null);
    setSoftWarning(null);

    const s = timeToMinutes(newStartTime);
    if (isNaN(s)) {
      setValidationError('Please enter a valid start time in HH:mm format.');
      return;
    }
    const e = s + duration;
    const endStr = minutesToTime(e);

    // 1. Boundary Check: Waking hours
    if (plan.wakeTime && plan.bedTime) {
      if (!isWithinWakeHours(newStartTime, endStr, plan.wakeTime, plan.bedTime)) {
        setValidationError(`Proposed time (${formatTimeRange12h(newStartTime, endStr)}) falls outside waking hours (${formatTimeRange12h(plan.wakeTime, plan.bedTime)}) or overlaps sleep.`);
        return;
      }
    }

    // 2. Hard Conflicts: Fixed Routine Commitments
    const fixedItems = [
      ...(plan.meals || []).map((m) => ({ ...m, title: m.name || 'Meal' })),
      ...(plan.commitments || []).map((c) => ({ ...c, title: c.name || 'Commitment' })),
    ];
    if (plan.workHours?.start && plan.workHours?.end) {
      fixedItems.push({
        start: plan.workHours.start,
        end: plan.workHours.end,
        title: 'College / Work Hours',
      });
    }

    const fixedCheck = checkIntervalConflict(
      { startTime: newStartTime, endTime: endStr },
      fixedItems.map((item) => ({ ...item, startTime: item.start, endTime: item.end }))
    );

    if (fixedCheck.hasConflict) {
      const item = fixedCheck.conflictingItem;
      const timeStr = item?.startTime && item?.endTime ? ` (${formatTimeRange12h(item.startTime, item.endTime)})` : '';
      setValidationError(`Hard Conflict: Overlaps with fixed routine "${item?.title || 'routine'}"${timeStr}. Fixed commitments cannot be overlapped.`);
      return;
    }

    // 3. Soft Conflicts: Other Tasks
    const otherTasks = (plan.tasks || [])
      .filter((t) => t.id !== task.id && t.scheduledStart && t.scheduledEnd)
      .map((t) => ({
        id: t.id,
        startTime: t.scheduledStart,
        endTime: t.scheduledEnd,
        title: t.name,
      }));

    const taskCheck = checkIntervalConflict(
      { startTime: newStartTime, endTime: endStr, id: task.id },
      otherTasks,
      task.id
    );

    if (taskCheck.hasConflict && !allowSoftConflict) {
      const item = taskCheck.conflictingItem;
      const timeStr = item?.startTime && item?.endTime ? ` (${formatTimeRange12h(item.startTime, item.endTime)})` : '';
      setSoftWarning(`Soft Conflict: Overlaps with "${item?.title || 'task'}"${timeStr}. You can adjust the time or check the box below to proceed.`);
      return;
    }

    // Success: apply reschedule
    onConfirmReschedule(task.id, newStartTime, endStr);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reschedule "${task.name}"`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleValidateAndSubmit}>
            Confirm Reschedule
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)' }}>
          Current duration: <strong>{duration} minutes</strong>. Moving this task will update its status to <em>rescheduled</em>.
        </p>

        {validationError && (
          <Alert type="error" title="Cannot Schedule at this Time">
            {validationError}
          </Alert>
        )}

        {softWarning && (
          <Alert type="info" title="Task Overlap Warning">
            <div>{softWarning}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={allowSoftConflict}
                onChange={(e) => setAllowSoftConflict(e.target.checked)}
              />
              <span>Confirm this time anyway</span>
            </label>
          </Alert>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <TimePicker
            id="reschedule-start"
            label="New Start Time"
            value={newStartTime}
            onChange={(val) => {
              setNewStartTime(val);
              setValidationError(null);
              setSoftWarning(null);
            }}
            required={true}
          />
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Label htmlFor="reschedule-end">Calculated End Time</Label>
            <div
              id="reschedule-end"
              style={{
                minHeight: 'var(--touch-target-min)',
                padding: 'var(--space-2) var(--space-3)',
                backgroundColor: 'var(--color-surface-hover)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-base)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                boxSizing: 'border-box',
              }}
            >
              {format12Hour(currentEndTime) || '—'}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
