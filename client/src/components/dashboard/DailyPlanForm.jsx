import React, { useState, useEffect } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import { Input, Select } from '../common/FormField.jsx';
import Badge from '../common/Badge.jsx';
import Modal from '../common/Modal.jsx';
import Alert from '../common/Alert.jsx';
import DatePicker from '../common/DatePicker.jsx';
import TimePicker from '../common/TimePicker.jsx';
import RoutineSetupModal from './RoutineSetupModal.jsx';
import { toLocalISODate, generateId, format12Hour, formatTimeRange12h, formatDisplayDate } from '../../utils/dateUtils.js';
import { generateSchedule } from '../../utils/scheduler.js';
import { usePlanner } from '../../context/PlannerContext.jsx';
import { loadSavedRoutine, saveSavedRoutine, addGoalChecklistItem } from '../../utils/storage.js';

export default function DailyPlanForm({ initialDate, onComplete, onCancel }) {
  const { getPlan, savePlan, clearDraft } = usePlanner();

  const targetDate = initialDate || toLocalISODate();

  // Load saved routine (wake time, bed time, college/work, meals)
  const [routine, setRoutine] = useState(() => loadSavedRoutine());
  const [showRoutineModal, setShowRoutineModal] = useState(false);

  // Form State
  const [planDate, setPlanDate] = useState(targetDate);
  const [tasks, setTasks] = useState(() => {
    const existing = getPlan(targetDate);
    return existing && Array.isArray(existing.tasks) ? existing.tasks : [];
  });

  // Task Input State
  const [taskName, setTaskName] = useState('');
  const [taskDuration, setTaskDuration] = useState('30');
  const [taskDestination, setTaskDestination] = useState('plan'); // 'plan' | 'goal'
  const [goalCategory, setGoalCategory] = useState('fitness');
  const [preferredTime, setPreferredTime] = useState('');
  const [isFlexible, setIsFlexible] = useState(false);
  const [priority, setPriority] = useState('Medium');
  const [taskError, setTaskError] = useState(null);

  // Notice/Warning for conflicts with routine
  const [conflictWarning, setConflictWarning] = useState(null);

  // Overwrite modal
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState(null);

  // Check conflicts when preferredTime changes
  useEffect(() => {
    if (!preferredTime) {
      setConflictWarning(null);
      return;
    }

    // Check if preferredTime overlaps with college/work or meals
    const prefHour = parseInt(preferredTime.split(':')[0], 10);
    const prefMin = parseInt(preferredTime.split(':')[1], 10);
    const prefTotal = prefHour * 60 + prefMin;
    const dur = parseInt(taskDuration, 10) || 30;
    const prefEnd = prefTotal + dur;

    // Check work
    if (routine.workHours?.enabled && routine.workHours?.start && routine.workHours?.end) {
      const [wSh, wSm] = routine.workHours.start.split(':').map(Number);
      const [wEh, wEm] = routine.workHours.end.split(':').map(Number);
      const wStart = wSh * 60 + wSm;
      const wEnd = wEh * 60 + wEm;

      if (Math.max(prefTotal, wStart) < Math.min(prefEnd, wEnd)) {
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
        const mStart = mSh * 60 + mSm;
        const mEnd = mEh * 60 + mEm;

        if (Math.max(prefTotal, mStart) < Math.min(prefEnd, mEnd)) {
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
  }, [preferredTime, taskDuration, routine]);

  // Handle Plan Date Change
  const handleDateChange = (newDate) => {
    if (newDate === planDate) return;
    const existing = getPlan(newDate);
    if (existing && existing.status === 'scheduled') {
      setPendingDateChange(newDate);
      setShowOverwriteModal(true);
    } else {
      setPlanDate(newDate);
      if (existing && Array.isArray(existing.tasks)) {
        setTasks(existing.tasks);
      }
    }
  };

  // Add Task to List or to Goal Checklist
  const handleAddTask = (e) => {
    if (e) e.preventDefault();
    const trimmed = taskName.trim();
    if (!trimmed) {
      setTaskError('Please enter a task name.');
      return;
    }

    const dur = parseInt(taskDuration, 10);
    if (isNaN(dur) || dur <= 0) {
      setTaskError('Please provide a valid duration in minutes.');
      return;
    }

    if (taskDestination === 'goal') {
      // Add directly to Goal Tracking Checklist!
      addGoalChecklistItem(goalCategory, trimmed);
      setTaskName('');
      setTaskError(null);
      alert(`Added "${trimmed}" to your ${goalCategory.toUpperCase()} Goal Checklist!`);
      return;
    }

    // Add to daily plan tasks
    const newTask = {
      id: generateId('task'),
      date: planDate,
      name: trimmed,
      category: goalCategory ? goalCategory.charAt(0).toUpperCase() + goalCategory.slice(1) : 'Education',
      durationMinutes: dur,
      priority,
      preferredTime: preferredTime || null,
      isFlexible,
      status: 'pending',
      notes: '',
    };

    setTasks((prev) => [...prev, newTask]);
    setTaskName('');
    setPreferredTime('');
    setIsFlexible(false);
    setTaskError(null);
    setConflictWarning(null);
  };

  const handleRemoveTask = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Generate & Save Daily Schedule
  const handleGenerateSchedule = () => {
    // Build schedule payload using the reused saved routine
    const planPayload = {
      date: planDate,
      userType: routine.userType || 'student',
      wakeTime: routine.wakeTime || '07:00',
      bedTime: routine.bedTime || '23:00',
      workHours: routine.workHours?.enabled ? routine.workHours : null,
      travelMinutes: routine.travel?.enabled ? 30 : 0,
      meals: routine.meals || [],
      commitments: routine.commitments || [],
      freeSlots: [],
      tasks,
    };

    const scheduleResult = generateSchedule(planPayload);

    planPayload.schedule = {
      generatedAt: new Date().toISOString(),
      blocks: scheduleResult.scheduledBlocks,
      unscheduled: scheduleResult.unscheduledTasks,
    };
    planPayload.tasks = scheduleResult.scheduledTasks;
    planPayload.status = 'scheduled';

    const success = savePlan(planDate, planPayload);
    if (success) {
      clearDraft();
      if (onComplete) onComplete(planPayload);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-3xl)', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
            {targetDate === planDate ? "Today's Daily Plan" : `Plan for ${formatDisplayDate(planDate)}`}
          </h1>
          <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted-text)', marginTop: 'var(--space-1)' }}>
            Reusing your regular routine. Add your tasks and generate your chronological timetable.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ width: '180px' }}>
            <DatePicker
              id="plan-date-picker"
              label="Plan Date"
              value={planDate}
              onChange={handleDateChange}
            />
          </div>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>

      {/* Routine Banner (Reused automatically) */}
      <Card padding="md" highlight="yellow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-xl)' }}>⚙️</span>
            <div>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                Reusing Your Saved Regular Routine
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: '2px' }}>
                <span>🌅 Wake: <strong>{format12Hour(routine.wakeTime)}</strong></span>
                <span>🌙 Sleep: <strong>{format12Hour(routine.bedTime)}</strong></span>
                {routine.workHours?.enabled && (
                  <span>💼 {routine.workHours.label || 'College / Work'}: <strong>{formatTimeRange12h(routine.workHours.start, routine.workHours.end)}</strong></span>
                )}
                <span>🥗 Meals: <strong>{(routine.meals || []).length} scheduled</strong></span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoutineModal(true)}
            style={{ fontWeight: 600 }}
          >
            Edit Regular Routine
          </Button>
        </div>
      </Card>

      {/* Task Creation & List */}
      <Card padding="lg">
        <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, margin: '0 0 var(--space-4)', color: 'var(--color-text)' }}>
          Add Daily Tasks
        </h2>

        {/* Task Form */}
        <form
          onSubmit={handleAddTask}
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-5)',
          }}
        >
          {taskError && (
            <div style={{ padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)' }}>
              {taskError}
            </div>
          )}

          {/* Task Name & Destination Choice */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                Task Name <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                type="text"
                value={taskName}
                onChange={(e) => {
                  setTaskName(e.target.value);
                  if (taskError) setTaskError(null);
                }}
                placeholder="e.g. Study Physics Chapter 3 or Team Meeting"
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-sm)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                Where should this task go?
              </label>
              <select
                value={taskDestination}
                onChange={(e) => setTaskDestination(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-sm)',
                }}
              >
                <option value="plan">📅 Timed Daily Plan (Scheduled)</option>
                <option value="goal">🎯 Goal Tracking Checklist</option>
              </select>
            </div>
          </div>

          {/* If Goal Checklist chosen */}
          {taskDestination === 'goal' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 700 }}>Checklist Category:</label>
              <select
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface)',
                  fontSize: 'var(--font-sm)',
                }}
              >
                <option value="diet">🥗 Diet</option>
                <option value="fitness">🏃 Fitness</option>
                <option value="career">💼 Career</option>
                <option value="education">🎓 Education</option>
              </select>
            </div>
          ) : (
            /* If Timed Daily Plan chosen */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                    Duration (Minutes)
                  </label>
                  <select
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    <option value="15">15 mins</option>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">60 mins (1 hr)</option>
                    <option value="90">90 mins</option>
                    <option value="120">120 mins (2 hrs)</option>
                  </select>
                </div>

                <div>
                  <TimePicker
                    id="new-task-pref-time"
                    label="Preferred Time (Optional)"
                    value={preferredTime}
                    onChange={(val) => setPreferredTime(val)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      fontSize: 'var(--font-sm)',
                    }}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>

              {/* Flexible Task during college/meals toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <input
                  type="checkbox"
                  id="task-flexible-toggle"
                  checked={isFlexible}
                  onChange={(e) => setIsFlexible(e.target.checked)}
                />
                <label htmlFor="task-flexible-toggle" style={{ fontSize: 'var(--font-xs)', cursor: 'pointer', color: 'var(--color-text)' }}>
                  <strong>Flexible Task:</strong> Can be scheduled during college/work breaks or meal periods if needed.
                </label>
              </div>

              {/* Conflict explanation & alternative suggestion */}
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
                  <strong>⚠️ Schedule Notice:</strong> Preferred time ({format12Hour(preferredTime)}) overlaps with <strong>{conflictWarning.title}</strong> ({formatTimeRange12h(conflictWarning.start, conflictWarning.end)}).
                  {!isFlexible ? (
                    <div style={{ marginTop: '4px' }}>
                      Check <strong>"Flexible Task"</strong> above to allow it during this period, or leave Preferred Time blank to automatically place it in free time.
                    </div>
                  ) : (
                    <div style={{ marginTop: '4px', color: 'var(--color-success-text)' }}>
                      ✓ Marked as flexible: will be permitted during this block.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" style={{ fontWeight: 700 }}>
              + Add Task
            </Button>
          </div>
        </form>

        {/* List of Tasks for Today */}
        <div>
          <h3 style={{ fontSize: 'var(--font-sm)', fontWeight: 700, margin: '0 0 var(--space-3)' }}>
            Tasks for This Plan ({tasks.length})
          </h3>

          {tasks.length === 0 ? (
            <div style={{ padding: 'var(--space-4)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--color-muted-text)', fontSize: 'var(--font-sm)' }}>
              No tasks added yet. Add tasks above, or click Generate below to build your schedule around your routine.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
              {tasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', display: 'flex', gap: 'var(--space-2)', marginTop: '2px' }}>
                      <span>⏱ {t.durationMinutes} mins</span>
                      {t.preferredTime && <span>🕒 Prefers {format12Hour(t.preferredTime)}</span>}
                      {t.isFlexible && <span style={{ color: 'var(--color-info)' }}>(Flexible)</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Badge type="priority" value={t.priority} />
                    <button
                      type="button"
                      onClick={() => handleRemoveTask(t.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontSize: 'var(--font-sm)' }}
                      title="Remove task"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Action */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleGenerateSchedule}
            style={{ fontWeight: 800, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          >
            ⚡ Generate My Daily Schedule
          </Button>
        </div>
      </Card>

      {/* Routine Setup Modal */}
      {showRoutineModal && (
        <RoutineSetupModal
          isOpen={showRoutineModal}
          onClose={() => setShowRoutineModal(false)}
          onSave={(updatedRoutine) => setRoutine(updatedRoutine)}
        />
      )}

      {/* Overwrite Confirmation Modal */}
      {showOverwriteModal && (
        <Modal
          isOpen={showOverwriteModal}
          onClose={() => setShowOverwriteModal(false)}
          title="Plan Already Exists for this Date"
          maxWidth="460px"
          footer={
            <>
              <Button variant="outline" onClick={() => setShowOverwriteModal(false)}>
                Keep Current Date
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setPlanDate(pendingDateChange);
                  const existing = getPlan(pendingDateChange);
                  if (existing && Array.isArray(existing.tasks)) {
                    setTasks(existing.tasks);
                  }
                  setShowOverwriteModal(false);
                }}
              >
                Open & Edit Plan
              </Button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text)', lineHeight: 1.5 }}>
            A daily plan already exists for <strong>{formatDisplayDate(pendingDateChange)}</strong>. Would you like to switch to this date and edit it?
          </p>
        </Modal>
      )}
    </div>
  );
}
