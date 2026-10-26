import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Modal from '../components/common/Modal.jsx';
import DatePicker from '../components/common/DatePicker.jsx';
import TimePicker from '../components/common/TimePicker.jsx';
import { usePlanner } from '../context/PlannerContext.jsx';
import {
  loadGoalChecklists,
  saveGoalChecklists,
  addGoalChecklistItem,
  toggleGoalChecklistItem,
  deleteGoalChecklistItem,
} from '../utils/storage.js';
import { toLocalISODate } from '../utils/dateUtils.js';

export default function GoalTracking({ activeSubTab = 'fitness', onSubTabChange }) {
  const { addTaskOp } = usePlanner();

  // Categories: Diet, Fitness, Career, Education
  const categories = [
    { id: 'diet', label: 'Diet', icon: '🥗', placeholder: 'e.g. Drink 2.5L water, Eat a salad, No sugar today' },
    { id: 'fitness', label: 'Fitness', icon: '🏃', placeholder: 'e.g. 30 min morning run, 50 pushups, Evening stretch' },
    { id: 'career', label: 'Career', icon: '💼', placeholder: 'e.g. Update resume, Connect with mentor, Practice interview questions' },
    { id: 'education', label: 'Education', icon: '🎓', placeholder: 'e.g. Read chapter 4, Complete lab report, Review physics formulas' },
  ];

  // Active category
  const [currentCatId, setCurrentCatId] = useState(() => {
    const valid = categories.some((c) => c.id === (activeSubTab || '').toLowerCase());
    return valid ? activeSubTab.toLowerCase() : 'fitness';
  });

  // Checklists data from local storage
  const [checklists, setChecklists] = useState(() => loadGoalChecklists());
  // Single required field: Task Name
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [formError, setFormError] = useState(null);

  // Optional "Add to Daily Plan" modal state
  const [scheduleTask, setScheduleTask] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(() => toLocalISODate());
  const [scheduleDuration, setScheduleDuration] = useState('30');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState(null);

  // Sync tab with external prop if provided
  useEffect(() => {
    if (activeSubTab && activeSubTab.toLowerCase() !== currentCatId) {
      setCurrentCatId(activeSubTab.toLowerCase());
    }
  }, [activeSubTab]);

  // Reload checklists when component mounts
  useEffect(() => {
    setChecklists(loadGoalChecklists());
  }, []);

  const currentCat = categories.find((c) => c.id === currentCatId) || categories[0];
  const currentTasks = checklists[currentCatId] || [];

  const activeTasks = currentTasks.filter((t) => !t.completed);
  const completedTasks = currentTasks.filter((t) => t.completed);

  // Switch category
  const handleSelectCategory = (catId) => {
    setCurrentCatId(catId);
    setNewTaskTitle('');
    setFormError(null);
    if (onSubTabChange) {
      onSubTabChange(catId);
    }
  };

  // Add Task handler: ONLY requires task title!
  const handleAddTask = (e) => {
    if (e) e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) {
      setFormError('Please enter a task name.');
      return;
    }

    const res = addGoalChecklistItem(currentCatId, trimmed);
    if (res.success) {
      setChecklists(res.checklists);
      setNewTaskTitle('');
      setFormError(null);
    }
  };

  // Tick / Untick circular checkbox
  const handleToggleTask = (task) => {
    const res = toggleGoalChecklistItem(currentCatId, task.id);
    if (res.success) {
      setChecklists(res.checklists);
    }
  };

  // Delete task
  const handleDeleteTask = (task) => {
    const res = deleteGoalChecklistItem(currentCatId, task.id);
    if (res.success) {
      setChecklists(res.checklists);
    }
  };

  // Optional: Schedule checklist item onto Timed Daily Plan
  const handleOpenScheduleModal = (task) => {
    setScheduleTask(task);
    setScheduleDate(toLocalISODate());
    setScheduleDuration('30');
    setScheduleTime('');
    setScheduleSuccess(null);
  };

  const handleConfirmSchedule = (e) => {
    if (e) e.preventDefault();
    if (!scheduleTask) return;

    const dur = parseInt(scheduleDuration, 10) || 30;
    const taskData = {
      name: scheduleTask.title,
      category: currentCat.label,
      durationMinutes: dur,
      preferredTime: scheduleTime || null,
      priority: 'Medium',
      isFlexible: true,
    };

    addTaskOp(scheduleDate, taskData);
    setScheduleSuccess(`Added "${scheduleTask.title}" to Daily Plan for ${scheduleDate}!`);
    setTimeout(() => {
      setScheduleTask(null);
      setScheduleSuccess(null);
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Page Header */}
      <div>
        <h1
          style={{
            fontSize: 'var(--font-3xl)',
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Goal Tracking Checklists
        </h1>
        <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted-text)', marginTop: 'var(--space-1)' }}>
          Simple checklists for your key goals. Keep track of daily habits and achievements separately from timed scheduling.
        </p>

        {/* Four Category Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-4)',
            flexWrap: 'wrap',
          }}
        >
          {categories.map((cat) => {
            const isActive = currentCatId === cat.id;
            const count = (checklists[cat.id] || []).filter((t) => !t.completed).length;

            return (
              <button
                key={cat.id}
                type="button"
                id={`goal-tab-${cat.id}`}
                onClick={() => handleSelectCategory(cat.id)}
                style={{
                  minHeight: 'var(--touch-target-min)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--color-primary-hover)' : 'var(--color-border)',
                  backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: 'var(--color-text)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'var(--font-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      backgroundColor: isActive ? '#000000' : 'var(--color-border)',
                      color: isActive ? '#FFFFFF' : 'var(--color-text)',
                      borderRadius: 'var(--radius-full)',
                      padding: '1px 6px',
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Category Card */}
      <Card padding="lg" highlight="yellow">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span>{currentCat.icon}</span>
              <span>{currentCat.label} Checklist</span>
            </h2>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', margin: '4px 0 0' }}>
              Add habits and milestones. Tick the circle to complete.
            </p>
          </div>

          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', fontWeight: 600 }}>
            {completedTasks.length} of {currentTasks.length} completed
          </div>
        </div>

        {/* Minimal Add Task Form: ONLY Title Required! */}
        <form
          onSubmit={handleAddTask}
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-6)',
            alignItems: 'stretch',
          }}
        >
          <div style={{ flex: 1 }}>
            <input
              type="text"
              id="goal-task-input"
              value={newTaskTitle}
              onChange={(e) => {
                setNewTaskTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder={currentCat.placeholder}
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--font-base)',
                borderRadius: 'var(--radius-md)',
                border: formError ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-border-focus)')}
              onBlur={(e) => (e.target.style.borderColor = formError ? 'var(--color-danger)' : 'var(--color-border)')}
            />
            {formError && (
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-danger)', marginTop: '4px' }}>
                {formError}
              </div>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            id="goal-task-submit-btn"
            style={{ fontWeight: 700, whiteSpace: 'nowrap', padding: '0 var(--space-5)' }}
          >
            + Add Task
          </Button>
        </form>

        {/* 1. Active Tasks Section */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h3
            style={{
              fontSize: 'var(--font-sm)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--color-muted-text)',
              marginBottom: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            <span>Active Checklist</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-primary-subtle)',
                border: '1px solid var(--color-primary)',
                color: 'var(--color-text)',
                fontWeight: 700,
              }}
            >
              {activeTasks.length}
            </span>
          </h3>

          {activeTasks.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-5)',
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                color: 'var(--color-muted-text)',
                fontSize: 'var(--font-sm)',
              }}
            >
              No active {currentCat.label} tasks. Type a task name above and click <strong>+ Add Task</strong>!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {activeTasks.map((task) => (
                <div
                  key={task.id}
                  data-testid={`goal-task-${task.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    gap: 'var(--space-3)',
                    transition: 'border-color var(--transition-fast)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                    {/* Circular Checkbox (Empty circle for active tasks) */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked="false"
                      aria-label={`Mark "${task.title}" as complete`}
                      data-testid={`toggle-goal-${task.id}`}
                      onClick={() => handleToggleTask(task)}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-border-hover)',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        padding: 0,
                        transition: 'all var(--transition-fast)',
                      }}
                      title="Click circle to complete"
                    />

                    <span
                      style={{
                        fontSize: 'var(--font-base)',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        wordBreak: 'break-word',
                      }}
                    >
                      {task.title}
                    </span>
                  </div>

                  {/* Actions: Optional Schedule in Day Plan & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenScheduleModal(task)}
                      title="Schedule this checklist task into your Daily Timetable"
                      style={{ fontSize: 'var(--font-xs)', padding: 'var(--space-1) var(--space-3)' }}
                    >
                      📅 Add to Plan
                    </Button>
                    <button
                      type="button"
                      aria-label={`Delete "${task.title}"`}
                      onClick={() => handleDeleteTask(task)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-muted-text)',
                        cursor: 'pointer',
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-sm)',
                      }}
                      title="Delete task"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Completed Tasks Section */}
        {completedTasks.length > 0 && (
          <div>
            <h3
              style={{
                fontSize: 'var(--font-sm)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--color-muted-text)',
                marginBottom: 'var(--space-3)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span>Completed</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 7px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-border)',
                  color: 'var(--color-success-text)',
                  fontWeight: 700,
                }}
              >
                {completedTasks.length}
              </span>
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  data-testid={`goal-task-completed-${task.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: 'var(--color-surface-hover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    gap: 'var(--space-3)',
                    opacity: 0.85,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                    {/* Ticked Circular Checkbox */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked="true"
                      aria-label={`Mark "${task.title}" as incomplete`}
                      data-testid={`untoggle-goal-${task.id}`}
                      onClick={() => handleToggleTask(task)}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        border: '2px solid var(--color-success)',
                        backgroundColor: 'var(--color-success)',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        padding: 0,
                        fontSize: '12px',
                        fontWeight: 900,
                        transition: 'all var(--transition-fast)',
                      }}
                      title="Click circle to uncheck and move back to Active"
                    >
                      ✓
                    </button>

                    <span
                      style={{
                        fontSize: 'var(--font-base)',
                        fontWeight: 600,
                        color: 'var(--color-muted-text)',
                        textDecoration: 'line-through',
                        wordBreak: 'break-word',
                      }}
                    >
                      {task.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label={`Delete "${task.title}"`}
                    onClick={() => handleDeleteTask(task)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-muted-text)',
                      cursor: 'pointer',
                      padding: 'var(--space-1) var(--space-2)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-sm)',
                    }}
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Optional Modal: Schedule Checklist Item on Daily Timetable */}
      {scheduleTask && (
        <Modal
          isOpen={Boolean(scheduleTask)}
          onClose={() => setScheduleTask(null)}
          title={`📅 Schedule on Daily Plan`}
          maxWidth="460px"
          footer={
            <>
              <Button variant="outline" onClick={() => setScheduleTask(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmSchedule} style={{ fontWeight: 700 }}>
                Add to Timetable
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)', margin: 0 }}>
              Schedule <strong>"{scheduleTask.title}"</strong> as a timed activity on your daily timetable:
            </p>

            {scheduleSuccess && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-success-bg)',
                  border: '1px solid var(--color-success-border)',
                  color: 'var(--color-success-text)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                }}
              >
                ✓ {scheduleSuccess}
              </div>
            )}

            <div>
              <DatePicker
                id="schedule-task-date"
                label="Target Plan Date"
                value={scheduleDate}
                onChange={(d) => setScheduleDate(d)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-xs)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
                  Duration (mins)
                </label>
                <select
                  value={scheduleDuration}
                  onChange={(e) => setScheduleDuration(e.target.value)}
                  style={{
                    width: '100%',
                    minHeight: 'var(--touch-target-min)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <option value="15">15 mins</option>
                  <option value="30">30 mins</option>
                  <option value="45">45 mins</option>
                  <option value="60">60 mins (1 hr)</option>
                  <option value="90">90 mins</option>
                </select>
              </div>

              <div>
                <TimePicker
                  id="schedule-task-time"
                  label="Preferred Time (Optional)"
                  value={scheduleTime}
                  onChange={(t) => setScheduleTime(t)}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
