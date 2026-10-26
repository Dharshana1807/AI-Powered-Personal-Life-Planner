import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal.jsx';
import Button from '../common/Button.jsx';
import { Input, Select } from '../common/FormField.jsx';
import Alert from '../common/Alert.jsx';
import DatePicker from '../common/DatePicker.jsx';
import TimePicker from '../common/TimePicker.jsx';
import {
  timeToMinutes,
  minutesToTime,
  isWithinWakeHours,
  checkIntervalConflict,
} from '../../../../shared/conflictEngine.js';
import {
  isValidTimeHHMM,
  isValidDateYYYYMMDD,
} from '../../utils/validation.js';
import { formatTimeRange12h } from '../../utils/dateUtils.js';

export default function EditTaskModal({
  isOpen,
  onClose,
  task,
  plan,
  onSaveTask,
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Education');
  const [priority, setPriority] = useState('Medium');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [conflictWarning, setConflictWarning] = useState(null);

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setCategory(task.category || 'Education');
      setPriority(task.priority || 'Medium');
      setDurationMinutes(String(task.durationMinutes || 30));
      setStartTime(task.scheduledStart || '');
      setEndTime(task.scheduledEnd || '');
      setDeadlineDate(task.deadlineDate || '');
      setDeadlineTime(task.deadlineTime || '');
      setNotes(task.notes || '');
      setFieldErrors({});
      setConflictWarning(null);
    }
  }, [task, isOpen]);

  if (!task || !isOpen) return null;

  const isCompletedOrSkipped = task.status === 'completed' || task.status === 'skipped';

  // Calculate duration between start and end (supporting overnight)
  const calculateDurationFromTimes = (sStr, eStr) => {
    const s = timeToMinutes(sStr);
    const e = timeToMinutes(eStr);
    if (isNaN(s) || isNaN(e)) return null;
    let diff = e - s;
    if (diff <= 0) diff += 1440; // Overnight wrap
    return diff;
  };

  // Consistent start / end / duration handlers
  const handleDurationChange = (val) => {
    setDurationMinutes(val);
    setFieldErrors((prev) => ({ ...prev, duration: null }));
    const dur = parseInt(val, 10);
    if (!isNaN(dur) && dur > 0 && isValidTimeHHMM(startTime)) {
      const s = timeToMinutes(startTime);
      const e = (s + dur) % 1440;
      setEndTime(minutesToTime(e));
    }
  };

  const handleStartTimeChange = (val) => {
    setStartTime(val);
    setFieldErrors((prev) => ({ ...prev, startTime: null }));
    const dur = parseInt(durationMinutes, 10);
    if (isValidTimeHHMM(val) && !isNaN(dur) && dur > 0) {
      const s = timeToMinutes(val);
      const e = (s + dur) % 1440;
      setEndTime(minutesToTime(e));
    }
  };

  const handleEndTimeChange = (val) => {
    setEndTime(val);
    setFieldErrors((prev) => ({ ...prev, endTime: null }));
    if (isValidTimeHHMM(startTime) && isValidTimeHHMM(val)) {
      const diff = calculateDurationFromTimes(startTime, val);
      if (diff !== null && diff > 0) {
        setDurationMinutes(String(diff));
      }
    }
  };

  const validate = () => {
    const errors = {};
    setConflictWarning(null);

    // Task name
    if (!name.trim()) {
      errors.name = 'Task name is required.';
    }

    // Duration
    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur) || dur <= 0 || !Number.isInteger(dur)) {
      errors.duration = 'Duration must be a positive whole number of minutes.';
    }

    // Start / End consistency
    if (startTime) {
      if (!isValidTimeHHMM(startTime)) {
        errors.startTime = 'Start time must be in HH:mm format (e.g. 09:30).';
      }
    }
    if (endTime) {
      if (!isValidTimeHHMM(endTime)) {
        errors.endTime = 'End time must be in HH:mm format (e.g. 10:30).';
      }
    }

    if (startTime && !endTime && !errors.startTime) {
      errors.endTime = 'End time is required when start time is provided.';
    } else if (!startTime && endTime && !errors.endTime) {
      errors.startTime = 'Start time is required when end time is provided.';
    }

    // Deadlines
    if (deadlineDate && !isValidDateYYYYMMDD(deadlineDate)) {
      errors.deadlineDate = 'Deadline date must be in YYYY-MM-DD format.';
    }
    if (deadlineTime && !isValidTimeHHMM(deadlineTime)) {
      errors.deadlineTime = 'Deadline time must be in HH:mm format (e.g. 17:00).';
    }

    // Check waking hours & conflicts if start/end provided and plan is available
    if (startTime && endTime && !errors.startTime && !errors.endTime && plan) {
      if (plan.wakeTime && plan.bedTime) {
        if (!isWithinWakeHours(startTime, endTime, plan.wakeTime, plan.bedTime)) {
          errors.startTime = `Time (${formatTimeRange12h(startTime, endTime)}) falls outside waking hours (${formatTimeRange12h(plan.wakeTime, plan.bedTime)}).`;
        }
      }

      // Fixed commitments conflict
      const fixedItems = [
        ...(plan.meals || []).map((m) => ({ startTime: m.start, endTime: m.end, title: m.name || 'Meal' })),
        ...(plan.commitments || []).map((c) => ({ startTime: c.start, endTime: c.end, title: c.name || 'Commitment' })),
      ];
      if (plan.workHours?.start && plan.workHours?.end) {
        fixedItems.push({ startTime: plan.workHours.start, endTime: plan.workHours.end, title: 'College / Work' });
      }

      const fixedConflict = checkIntervalConflict({ startTime, endTime }, fixedItems);
      if (fixedConflict.hasConflict) {
        const item = fixedConflict.conflictingItem;
        const timeStr = item?.startTime && item?.endTime ? ` (${formatTimeRange12h(item.startTime, item.endTime)})` : '';
        errors.startTime = `Conflicts with fixed routine: ${item?.title || 'routine'}${timeStr}`;
      }

      // Check soft conflicts with other tasks
      const otherTasks = (plan.tasks || [])
        .filter((t) => t.id !== task.id && t.scheduledStart && t.scheduledEnd)
        .map((t) => ({ id: t.id, startTime: t.scheduledStart, endTime: t.scheduledEnd, title: t.name }));

      const taskConflict = checkIntervalConflict({ startTime, endTime, id: task.id }, otherTasks, task.id);
      if (taskConflict.hasConflict) {
        const item = taskConflict.conflictingItem;
        const timeStr = item?.startTime && item?.endTime ? ` (${formatTimeRange12h(item.startTime, item.endTime)})` : '';
        setConflictWarning(`Soft Conflict: overlaps with "${item?.title || 'task'}"${timeStr}.`);
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const dur = parseInt(durationMinutes, 10);

    onSaveTask(task.id, {
      name: name.trim(),
      category,
      priority,
      durationMinutes: dur,
      scheduledStart: startTime ? startTime.trim() : null,
      scheduledEnd: endTime ? endTime.trim() : null,
      deadlineDate: deadlineDate ? deadlineDate.trim() : null,
      deadlineTime: deadlineTime ? deadlineTime.trim() : null,
      notes: notes.trim(),
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Task: ${task.name}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Save Changes
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {isCompletedOrSkipped && (
          <Alert type="info">
            Note: This task is currently marked as <strong>{task.status}</strong>. Editing its details will preserve its status.
          </Alert>
        )}

        {conflictWarning && (
          <Alert type="warning">
            {conflictWarning}
          </Alert>
        )}

        <Input
          id="edit-task-name-field"
          label="Task Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setFieldErrors((prev) => ({ ...prev, name: null }));
          }}
          error={fieldErrors.name}
          required={true}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Select
            id="edit-task-category-field"
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

          <Select
            id="edit-task-priority-field"
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={[
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />
        </div>

        {/* Start, End, and Duration with consistent recalculations & inline errors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <TimePicker
            id="edit-task-start-time"
            label="Start Time"
            value={startTime}
            onChange={(val) => handleStartTimeChange(val)}
            error={fieldErrors.startTime}
          />

          <TimePicker
            id="edit-task-end-time"
            label="End Time"
            value={endTime}
            onChange={(val) => handleEndTimeChange(val)}
            error={fieldErrors.endTime}
          />

          <Input
            id="edit-task-duration-field"
            type="number"
            label="Duration (mins)"
            value={durationMinutes}
            onChange={(e) => handleDurationChange(e.target.value)}
            error={fieldErrors.duration}
            required={true}
            min="1"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <DatePicker
            id="edit-task-dead-date-field"
            label="Deadline Date (Optional)"
            value={deadlineDate}
            onChange={(val) => {
              setDeadlineDate(val);
              setFieldErrors((prev) => ({ ...prev, deadlineDate: null }));
            }}
            error={fieldErrors.deadlineDate}
          />

          <TimePicker
            id="edit-task-dead-time-field"
            label="Deadline Time (Optional)"
            value={deadlineTime}
            onChange={(val) => {
              setDeadlineTime(val);
              setFieldErrors((prev) => ({ ...prev, deadlineTime: null }));
            }}
            error={fieldErrors.deadlineTime}
          />
        </div>

        <Input
          id="edit-task-notes-field"
          label="Description / notes"
          placeholder="e.g. Reference chapter notes and diagrams"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </form>
    </Modal>
  );
}
