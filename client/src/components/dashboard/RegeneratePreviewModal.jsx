import React from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import { formatTime12h, formatTimeRange12h } from '../../utils/dateUtils.js';

export default function RegeneratePreviewModal({
  isOpen,
  onClose,
  currentPlan,
  previewResult,
  onApply,
}) {
  if (!isOpen || !previewResult) return null;

  const currentTasks = currentPlan?.tasks || [];
  const nextTasks = previewResult.scheduledTasks || [];
  const unscheduled = previewResult.unscheduledTasks || [];

  // Categorize differences
  const moved = [];
  const unchanged = [];

  for (const nextT of nextTasks) {
    const orig = currentTasks.find((t) => t.id === nextT.id);
    if (!orig) continue;

    if (orig.scheduledStart !== nextT.scheduledStart || orig.scheduledEnd !== nextT.scheduledEnd) {
      const oldRange = (orig.scheduledStart && orig.scheduledEnd)
        ? formatTimeRange12h(orig.scheduledStart, orig.scheduledEnd)
        : (orig.scheduledStart ? formatTime12h(orig.scheduledStart) : 'Unscheduled');
      const newRange = (nextT.scheduledStart && nextT.scheduledEnd)
        ? formatTimeRange12h(nextT.scheduledStart, nextT.scheduledEnd)
        : (nextT.scheduledStart ? formatTime12h(nextT.scheduledStart) : 'Unscheduled');

      moved.push({
        task: nextT,
        oldRange,
        newRange,
      });
    } else {
      unchanged.push(nextT);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Regenerate Plan Preview"
      maxWidth="680px"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Keep Current Schedule
          </Button>
          <Button variant="primary" onClick={onApply}>
            Apply New Schedule
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)' }}>
          Review proposed timetable changes below. Completed, skipped, and in-progress tasks are locked and will never be moved.
        </p>

        {/* Moved Tasks */}
        {moved.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--color-secondary-accent)', marginBottom: 'var(--space-2)' }}>
              Moved Tasks ({moved.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {moved.map(({ task, oldStart, oldEnd, newStart, newEnd }) => (
                <div
                  key={task.id}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-secondary-subtle)',
                    border: '1px solid var(--color-secondary)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 'var(--font-sm)',
                  }}
                >
                  <div>
                    <strong>{task.name}</strong>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                      Was: {oldRange} &rarr; <strong>Now: {newRange}</strong>
                    </div>
                  </div>
                  <Badge type="priority" value={task.priority} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Newly Unscheduled */}
        {unscheduled.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--color-danger)', marginBottom: 'var(--space-2)' }}>
              Could Not Fit ({unscheduled.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {unscheduled.map((u, i) => (
                <div
                  key={i}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-danger-bg)',
                    border: '1px solid var(--color-danger-border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-sm)',
                  }}
                >
                  <strong>{u.name}</strong> ({u.durationMinutes}m)
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-danger-text)', marginTop: '2px' }}>
                    {u.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unchanged / Locked Tasks */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--color-text)', marginBottom: 'var(--space-2)' }}>
            Unchanged / Locked Tasks ({unchanged.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {unchanged.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-surface-hover)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 'var(--font-xs)',
                }}
              >
                <span>{t.name} ({formatTimeRange12h(t.scheduledStart, t.scheduledEnd)})</span>
                <Badge type="status" value={t.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
