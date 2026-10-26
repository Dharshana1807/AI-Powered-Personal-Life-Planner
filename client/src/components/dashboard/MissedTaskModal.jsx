import React, { useState } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input, Select } from '../common/FormField.jsx';
import Alert from '../common/Alert.jsx';
import DatePicker from '../common/DatePicker.jsx';
import TimePicker from '../common/TimePicker.jsx';
import { timeToMinutes } from '../../../../shared/conflictEngine.js';
import { toRelativeMinutes } from '../../utils/scheduler.js';
import { toLocalISODate, format12Hour, formatTimeRange12h, formatDisplayDate } from '../../utils/dateUtils.js';

/**
 * Calculates remaining available free time vs remaining planned work for a plan.
 * Returns { remainingFreeMins, remainingPlannedMins, overloadMins, isOverloaded }
 */
export function calculateScheduleOverload(plan, now) {
  if (!plan || !now) {
    return { remainingFreeMins: 0, remainingPlannedMins: 0, overloadMins: 0, isOverloaded: false };
  }

  const wakeMin = timeToMinutes(plan.wakeTime || '06:00');
  let bedMin = timeToMinutes(plan.bedTime || '23:00');
  if (bedMin <= wakeMin) bedMin += 1440;
  const totalWakingDuration = bedMin - wakeMin;

  const nowRel = toRelativeMinutes(now.currentTime || '12:00', wakeMin, bedMin);
  if (isNaN(nowRel)) {
    return { remainingFreeMins: 0, remainingPlannedMins: 0, overloadMins: 0, isOverloaded: false };
  }

  // Waking minutes remaining after now
  const remainingWakingMins = Math.max(0, totalWakingDuration - Math.max(0, nowRel));

  // Remaining fixed routine commitments (meals, routine commitments, work)
  const fixedIntervals = [];

  if (plan.workHours?.start && plan.workHours?.end) {
    const wS = toRelativeMinutes(plan.workHours.start, wakeMin, bedMin);
    const wE = toRelativeMinutes(plan.workHours.end, wakeMin, bedMin);
    if (!isNaN(wS) && !isNaN(wE) && wE > wS) {
      const travelMins = Number(plan.travelMinutes) || 0;
      if (travelMins > 0) fixedIntervals.push([Math.max(0, wS - travelMins), wS]);
      fixedIntervals.push([wS, wE]);
      if (travelMins > 0) fixedIntervals.push([wE, Math.min(totalWakingDuration, wE + travelMins)]);
    }
  }

  for (const m of (plan.meals || [])) {
    const s = toRelativeMinutes(m.start, wakeMin, bedMin);
    const e = toRelativeMinutes(m.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e) && e > s) fixedIntervals.push([s, e]);
  }

  for (const c of (plan.commitments || [])) {
    const s = toRelativeMinutes(c.start, wakeMin, bedMin);
    const e = toRelativeMinutes(c.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e) && e > s) fixedIntervals.push([s, e]);
  }

  // Calculate fixed minutes after nowRel
  let fixedMinsAfterNow = 0;
  for (const [fStart, fEnd] of fixedIntervals) {
    if (fEnd > nowRel) {
      const activeStart = Math.max(nowRel, fStart);
      const activeEnd = Math.min(totalWakingDuration, fEnd);
      if (activeEnd > activeStart) {
        fixedMinsAfterNow += (activeEnd - activeStart);
      }
    }
  }

  const remainingFreeMins = Math.max(0, remainingWakingMins - fixedMinsAfterNow);

  // Remaining planned work (all pending or in_progress tasks)
  const activeTasks = (plan.tasks || []).filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );
  const remainingPlannedMins = activeTasks.reduce(
    (sum, t) => sum + (Number(t.durationMinutes) || 0),
    0
  );

  const overloadMins = Math.max(0, remainingPlannedMins - remainingFreeMins);

  return {
    remainingFreeMins,
    remainingPlannedMins,
    overloadMins,
    isOverloaded: overloadMins > 0,
  };
}

/**
 * MissedTaskModal handles ONE overdue/missed task at a time.
 * Provides explicit options:
 * - Reschedule (pick new time today)
 * - Shorten duration (shows proposed duration and asks confirmation)
 * - Move to another day (date picker)
 * - Skip task
 * - Keep pending
 * Displays an overload warning if remaining planned work exceeds remaining free time.
 */
export default function MissedTaskModal({
  isOpen,
  onClose,
  task,
  plan,
  now,
  onReschedule,
  onShorten,
  onMoveToDate,
  onSkip,
  onKeepPending,
}) {
  const [activeAction, setActiveAction] = useState(null); // null | 'reschedule' | 'shorten' | 'move'
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [proposedDuration, setProposedDuration] = useState(() => {
    if (!task) return 15;
    const half = Math.max(10, Math.round((Number(task.durationMinutes) || 30) / 2));
    return half;
  });
  const [targetDate, setTargetDate] = useState(() => {
    const today = now?.localDate || toLocalISODate();
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [actionError, setActionError] = useState(null);

  if (!isOpen || !task) return null;

  const overloadInfo = calculateScheduleOverload(plan, now);

  const handleConfirmReschedule = () => {
    if (!rescheduleStart || !rescheduleEnd) {
      setActionError('Both start and end times are required.');
      return;
    }
    onReschedule(task.id, rescheduleStart, rescheduleEnd);
    onClose();
  };

  const handleConfirmShorten = () => {
    const dur = parseInt(proposedDuration, 10);
    if (isNaN(dur) || dur <= 0) {
      setActionError('Duration must be a positive number of minutes.');
      return;
    }
    onShorten(task.id, dur);
    onClose();
  };

  const handleConfirmMove = () => {
    if (!targetDate || targetDate === plan.date) {
      setActionError('Please select a valid future date.');
      return;
    }
    onMoveToDate(plan.date, targetDate, task.id);
    onClose();
  };

  const handleConfirmSkip = () => {
    onSkip(task.id);
    onClose();
  };

  const handleConfirmKeepPending = () => {
    if (onKeepPending) {
      onKeepPending(task.id);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Resolve Missed Task: "${task.name}"`}
      maxWidth="560px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', width: '100%' }}>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={handleConfirmKeepPending}>
            Keep Pending
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {/* Overload Warning */}
        {overloadInfo.isOverloaded && (
          <Alert type="warning" title="Schedule Overload Warning">
            Remaining planned work ({overloadInfo.remainingPlannedMins} mins) exceeds remaining available free time ({overloadInfo.remainingFreeMins} mins) by{' '}
            <strong>{overloadInfo.overloadMins} minutes</strong>. Consider shortening tasks or moving some to another day.
          </Alert>
        )}

        {/* Task Details Summary */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 'var(--font-base)' }}>{task.name}</span>
            <span
              style={{
                fontSize: 'var(--font-xs)',
                fontWeight: 700,
                color: 'var(--color-danger)',
                backgroundColor: 'var(--color-danger-subtle)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Overdue
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
            Category: <strong>{task.category || 'Education'}</strong> &bull; Original Duration: <strong>{task.durationMinutes} mins</strong>
            {task.scheduledStart && (
              <> &bull; Was scheduled at: <strong>{formatTimeRange12h(task.scheduledStart, task.scheduledEnd)}</strong></>
            )}
          </div>
        </div>

        {actionError && <Alert type="error">{actionError}</Alert>}

        {/* Action Selector */}
        {!activeAction && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: 0 }}>
              Choose how you would like to handle this missed task:
            </p>

            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setActiveAction('reschedule');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: 'var(--font-sm)' }}>⏱ Reschedule Today</strong>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                Pick a new time slot to complete this task later today.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActionError(null);
                const half = Math.max(10, Math.round((Number(task.durationMinutes) || 30) / 2));
                setProposedDuration(half);
                setActiveAction('shorten');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: 'var(--font-sm)' }}>✂️ Shorten Duration</strong>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                Reduce the planned time so it fits easily into the remaining schedule.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setActiveAction('move');
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: 'var(--font-sm)' }}>📅 Move to Another Day</strong>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                Transfer this task to tomorrow or a future date.
              </span>
            </button>

            <button
              type="button"
              onClick={handleConfirmSkip}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <strong style={{ fontSize: 'var(--font-sm)' }}>⏭ Skip Task</strong>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                Mark this task as skipped for today without deleting it.
              </span>
            </button>
          </div>
        )}

        {/* Reschedule Option Panel */}
        {activeAction === 'reschedule' && (
          <div
            style={{
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 'var(--font-sm)' }}>Reschedule Task</strong>
              <Button variant="ghost" size="sm" onClick={() => setActiveAction(null)}>
                Back
              </Button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <TimePicker
                id="reschedule-new-start"
                label="New Start Time"
                value={rescheduleStart}
                onChange={(val) => setRescheduleStart(val)}
              />
              <TimePicker
                id="reschedule-new-end"
                label="New End Time"
                value={rescheduleEnd}
                onChange={(val) => setRescheduleEnd(val)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setActiveAction(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmReschedule}>
                Confirm Reschedule
              </Button>
            </div>
          </div>
        )}

        {/* Shorten Option Panel */}
        {activeAction === 'shorten' && (
          <div
            style={{
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 'var(--font-sm)' }}>Shorten Task Duration</strong>
              <Button variant="ghost" size="sm" onClick={() => setActiveAction(null)}>
                Back
              </Button>
            </div>

            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', margin: 0 }}>
              Original duration was <strong>{task.durationMinutes} minutes</strong>. Please confirm the proposed new duration:
            </p>

            <Input
              id="proposed-duration-field"
              type="number"
              label="Proposed New Duration (minutes)"
              value={proposedDuration}
              onChange={(e) => setProposedDuration(e.target.value)}
              min="5"
              step="5"
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setActiveAction(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmShorten}>
                Confirm New Duration ({proposedDuration}m)
              </Button>
            </div>
          </div>
        )}

        {/* Move to Another Day Option Panel */}
        {activeAction === 'move' && (
          <div
            style={{
              padding: 'var(--space-4)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 'var(--font-sm)' }}>Move Task to Another Day</strong>
              <Button variant="ghost" size="sm" onClick={() => setActiveAction(null)}>
                Back
              </Button>
            </div>

            <DatePicker
              id="move-target-date-field"
              label="Select Target Date"
              value={targetDate}
              onChange={(val) => setTargetDate(val)}
              minDate={now?.localDate || toLocalISODate()}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" size="sm" onClick={() => setActiveAction(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleConfirmMove}>
                Move Task to {formatDisplayDate(targetDate)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
