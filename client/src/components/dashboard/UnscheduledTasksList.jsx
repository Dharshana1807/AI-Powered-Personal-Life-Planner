import React, { useState } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import Modal from '../common/Modal.jsx';
import { Input, Label } from '../common/FormField.jsx';
import DatePicker from '../common/DatePicker.jsx';
import { toLocalISODate, formatDisplayDate } from '../../utils/dateUtils.js';

export default function UnscheduledTasksList({
  unscheduledTasks = [],
  onShortenAndRetry,
  onMoveToAnotherDay,
  onEditTask,
}) {
  const [selectedTask, setSelectedTask] = useState(null);
  const [shortenModalOpen, setShortenModalOpen] = useState(false);
  const [proposedDuration, setProposedDuration] = useState('');

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [targetMoveDate, setTargetMoveDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalISODate(tomorrow);
  });

  if (!unscheduledTasks || unscheduledTasks.length === 0) {
    return null;
  }

  const handleOpenShorten = (task) => {
    setSelectedTask(task);
    // Suggest 50% or 30 mins
    const currentDur = Number(task.durationMinutes) || 60;
    const half = Math.max(15, Math.floor(currentDur / 2));
    setProposedDuration(String(half));
    setShortenModalOpen(true);
  };

  const handleConfirmShorten = () => {
    const dur = parseInt(proposedDuration, 10);
    if (!isNaN(dur) && dur > 0 && selectedTask) {
      onShortenAndRetry(selectedTask.taskId, dur);
      setShortenModalOpen(false);
      setSelectedTask(null);
    }
  };

  const handleOpenMove = (task) => {
    setSelectedTask(task);
    setMoveModalOpen(true);
  };

  const handleConfirmMove = () => {
    if (selectedTask && targetMoveDate) {
      onMoveToAnotherDay(selectedTask.taskId, targetMoveDate);
      setMoveModalOpen(false);
      setSelectedTask(null);
    }
  };

  return (
    <div style={{ marginTop: 'var(--space-6)' }}>
      <Card highlight="orange" padding="lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: '18px' }} aria-hidden="true">⚠️</span>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, color: 'var(--color-text)' }}>
            Tasks That Could Not Fit ({unscheduledTasks.length})
          </h3>
        </div>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', marginBottom: 'var(--space-4)' }}>
          These tasks exceeded today's available free windows or deadline constraints. No overlaps were forced.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {unscheduledTasks.map((item, idx) => (
            <div
              key={item.taskId || idx}
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-secondary-hover)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 'var(--space-3)',
              }}
            >
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <strong style={{ fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                    {item.name}
                  </strong>
                  <Badge type="priority" value="high" label={`${item.durationMinutes}m`} />
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-danger)', marginTop: '4px' }}>
                  <strong>Reason:</strong> {item.reason}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                  <strong>Suggestion:</strong> {item.suggestion}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenShorten(item)}
                >
                  ✂️ Shorten & Retry
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenMove(item)}
                >
                  📅 Move to Another Day
                </Button>
                {onEditTask && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditTask(item.taskId)}
                  >
                    ✏️ Edit
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Shorten and Retry Confirmation Modal */}
      <Modal
        isOpen={shortenModalOpen}
        onClose={() => setShortenModalOpen(false)}
        title="Shorten Task & Retry Scheduling"
        footer={
          <>
            <Button variant="outline" onClick={() => setShortenModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmShorten}>
              Confirm New Duration & Retry
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', marginBottom: 'var(--space-4)' }}>
          Propose a shorter duration for <strong>"{selectedTask?.name}"</strong>. Duration will only be modified upon your confirmation.
        </p>
        <Input
          id="proposed-duration"
          type="number"
          label="New Estimated Duration (minutes)"
          value={proposedDuration}
          onChange={(e) => setProposedDuration(e.target.value)}
          required={true}
        />
      </Modal>

      {/* Move to Another Day Modal */}
      <Modal
        isOpen={moveModalOpen}
        onClose={() => setMoveModalOpen(false)}
        title="Move Task to Another Day"
        footer={
          <>
            <Button variant="outline" onClick={() => setMoveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmMove}>
              Confirm Copy to Date
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', marginBottom: 'var(--space-4)' }}>
          Choose a target date to move <strong>"{selectedTask?.name}"</strong> to:
        </p>
        <DatePicker
          id="target-move-date"
          label="Target Date"
          value={targetMoveDate}
          onChange={(val) => setTargetMoveDate(val)}
          required={true}
        />
      </Modal>
    </div>
  );
}
