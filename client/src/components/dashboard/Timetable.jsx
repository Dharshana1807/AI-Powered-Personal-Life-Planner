import React, { useState } from 'react';
import Card from '../common/Card.jsx';
import Button from '../common/Button.jsx';
import Badge from '../common/Badge.jsx';
import Modal from '../common/Modal.jsx';
import Alert from '../common/Alert.jsx';
import { Input } from '../common/FormField.jsx';
import DatePicker from '../common/DatePicker.jsx';
import RescheduleModal from './RescheduleModal.jsx';
import EditTaskModal from './EditTaskModal.jsx';
import { isTaskOverdue } from '../../utils/taskOperations.js';
import {
  toLocalISODate,
  formatTime12h,
  formatTimeRange12h,
  formatFreeSlot12h,
  getDayPart,
  DAY_PARTS_ORDER,
  formatDisplayDate,
} from '../../utils/dateUtils.js';
import { calculateFreeWindows, toRelativeMinutes } from '../../utils/scheduler.js';
import { timeToMinutes } from '../../../../shared/conflictEngine.js';

export default function Timetable({
  plan,
  now,
  onUpdateTaskStatus,
  onRescheduleTask,
  onEditTaskDetails,
  onDeleteTask,
  onMoveTaskToDate,
  onOpenMissedModal,
  onOpenAddTask,
  onOpenAIAssistant,
  showTodoDone = true,
}) {
  const handleOpenAI = onOpenAIAssistant || (() => {
    window.location.hash = '#/assistant';
  });
  const [rescheduleTask, setRescheduleTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [deletingTask, setDeletingTask] = useState(null);
  const [pausePromptTask, setPausePromptTask] = useState(null); // Task user wants to start while another is in_progress
  const [movingTask, setMovingTask] = useState(null);
  const [targetMoveDate, setTargetMoveDate] = useState(() => {
    const today = now?.localDate || toLocalISODate();
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const todayDate = now?.localDate || toLocalISODate();
  const planDate = plan?.date || todayDate;
  const isPastDate = planDate < todayDate;

  const schedule = plan?.schedule;
  const blocks = schedule?.blocks || [];
  const tasksMap = new Map((plan?.tasks || []).map((t) => [t.id, t]));

  // Calculate summary metrics
  const allTasks = plan?.tasks || [];
  const scheduledTasksList = allTasks.filter((t) => t.scheduledStart && t.scheduledEnd);
  const scheduledCount = scheduledTasksList.length;
  const unscheduledCount = (schedule?.unscheduled || []).length;
  const completedCount = allTasks.filter((t) => t.status === 'completed').length;
  const totalPlannedMinutes = scheduledTasksList.reduce(
    (acc, t) => acc + (Number(t.durationMinutes) || 0),
    0
  );

  // Split tasks into To Do (pending, in_progress, rescheduled) and Done (completed)
  const todoTasks = allTasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'rescheduled'
  );
  const doneTasks = allTasks.filter((t) => t.status === 'completed');

  // Check if any task is currently in_progress
  const currentInProgressTask = allTasks.find((t) => t.status === 'in_progress');

  const handleStartTaskClick = (task) => {
    if (currentInProgressTask && currentInProgressTask.id !== task.id) {
      // Prompt user to pause existing task
      setPausePromptTask(task);
    } else {
      onUpdateTaskStatus(task.id, 'in_progress');
    }
  };

  const handleConfirmPauseAndStart = () => {
    if (pausePromptTask) {
      onUpdateTaskStatus(pausePromptTask.id, 'in_progress', { pauseExisting: true });
      setPausePromptTask(null);
    }
  };

  const handleDeleteClick = (task) => {
    if (task.status === 'completed') {
      setDeletingTask(task);
    } else {
      onDeleteTask(task.id);
    }
  };

  const handleConfirmDeleteCompleted = () => {
    if (deletingTask) {
      onDeleteTask(deletingTask.id, { confirmDeleteCompleted: true });
      setDeletingTask(null);
    }
  };

  const handleConfirmMoveTask = () => {
    if (movingTask && targetMoveDate && targetMoveDate !== planDate) {
      onMoveTaskToDate(planDate, targetMoveDate, movingTask.id);
      setMovingTask(null);
    }
  };

  // Calculate free windows between fixed items and tasks using the exact scheduler helper
  const freeWindows = calculateFreeWindows(plan, { includeScheduledTasks: true });
  const wakeMin = timeToMinutes(plan?.wakeTime || '06:00');
  let bedMin = timeToMinutes(plan?.bedTime || '23:00');
  if (bedMin <= wakeMin) bedMin += 1440;

  const displayBlocks = [...blocks, ...freeWindows].sort((a, b) => {
    const relA = a.relStart !== undefined ? a.relStart : toRelativeMinutes(a.start, wakeMin, bedMin);
    const relB = b.relStart !== undefined ? b.relStart : toRelativeMinutes(b.start, wakeMin, bedMin);
    return relA - relB;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Past Date Banner */}
      {isPastDate && (
        <Alert type="info" title="Past Date (Read-Only History)">
          You are viewing a past plan from <strong>{planDate}</strong>. Overdue tasks are read-only history. You can mark them as skipped or move them to a future day.
        </Alert>
      )}

      {/* Summary Metrics Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Scheduled Tasks
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginTop: '2px' }}>
            {scheduledCount}
          </div>
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Completed
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginTop: '2px', color: 'var(--color-success)' }}>
            {completedCount}
          </div>
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Planned Time
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginTop: '2px' }}>
            {totalPlannedMinutes} mins
          </div>
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: unscheduledCount > 0 ? 'var(--color-secondary-subtle)' : 'var(--color-surface)',
            border: '1px solid',
            borderColor: unscheduledCount > 0 ? 'var(--color-secondary)' : 'var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: unscheduledCount > 0 ? 'var(--color-secondary-accent)' : 'var(--color-muted-text)', textTransform: 'uppercase' }}>
            Could Not Fit
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, marginTop: '2px' }}>
            {unscheduledCount}
          </div>
        </div>
      </div>

      {/* =====================================================
          REQUIREMENT 2: DASHBOARD — TO DO / DONE SECTIONS
          ===================================================== */}
      {showTodoDone && (
        <Card padding="none">
        <div style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                Tasks
              </h2>
              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px', margin: 0 }}>
                Tap the circle on any task to mark complete. Tapping a completed task returns it to To Do.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <span
                style={{
                  fontSize: 'var(--font-xs)',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-primary-hover)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                To Do: {todoTasks.length}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-xs)',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-success-bg)',
                  color: 'var(--color-success-text)',
                  border: '1px solid var(--color-success-border)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                Done: {doneTasks.length}
              </span>
            </div>
          </div>
        </div>

        {/* --- TO DO (UPPER SECTION) --- */}
        <div data-testid="dashboard-todo-section" style={{ padding: 'var(--space-4) var(--space-5)', borderBottom: '2px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text)' }}>
              To Do
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'var(--color-primary-subtle)',
                color: 'var(--color-text)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-primary)',
              }}
            >
              {todoTasks.length}
            </span>
          </div>

          {todoTasks.length === 0 ? (
            <div
              data-testid="todo-empty-state"
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                fontSize: 'var(--font-sm)',
                color: 'var(--color-muted-text)',
                border: '1px dashed var(--color-border)',
              }}
            >
              🎉 All caught up! No pending tasks in To Do.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {todoTasks.map((task) => {
                const isInProgress = task.status === 'in_progress';
                const isOverdueToday = !isPastDate && isTaskOverdue(task, plan, now);

                return (
                  <div
                    key={task.id}
                    data-testid={`todo-task-item-${task.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid',
                      borderColor: isInProgress ? 'var(--color-primary-hover)' : 'var(--color-border)',
                      backgroundColor: isInProgress
                        ? 'var(--color-primary-subtle)'
                        : isOverdueToday
                        ? 'var(--color-danger-subtle)'
                        : 'var(--color-surface)',
                      transition: 'background-color var(--transition-fast)',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: '220px' }}>
                      {/* Empty Circular Checkbox - Clicking immediately moves to Done */}
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked="false"
                        aria-label={`Mark "${task.name}" as complete`}
                        data-testid={`todo-circle-${task.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateTaskStatus(task.id, 'completed');
                        }}
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
                        title="Click circle to complete task"
                      />

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                            {task.name}
                          </span>
                          <Badge type="priority" value={task.priority} />
                          {task.scheduledStart && (
                            <Badge type="daypart" value={getDayPart(task.scheduledStart)} />
                          )}
                          {isInProgress && <Badge type="status" value="in_progress" label="In Progress" />}
                          {isOverdueToday && (
                            <span
                              style={{
                                fontSize: 'var(--font-xs)',
                                fontWeight: 700,
                                color: 'var(--color-danger)',
                                backgroundColor: 'var(--color-danger-subtle)',
                                border: '1px solid var(--color-danger)',
                                padding: '1px 6px',
                                borderRadius: 'var(--radius-sm)',
                              }}
                            >
                              ⚠️ Overdue
                            </span>
                          )}
                        </div>

                        {/* Relevant Time Info in 12-Hour Format */}
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                          <strong>{task.category}</strong>
                          {task.scheduledStart && task.scheduledEnd ? (
                            <> &bull; 🕒 {formatTimeRange12h(task.scheduledStart, task.scheduledEnd)} ({task.durationMinutes} mins)</>
                          ) : (
                            <> &bull; {task.durationMinutes} mins</>
                          )}
                          {task.notes && ` • "${task.notes}"`}
                        </div>
                      </div>
                    </div>

                    {/* Task Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      {!isPastDate && (
                        <>
                          {task.status !== 'in_progress' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartTaskClick(task)}
                              title="Start task"
                              data-testid={`todo-start-btn-${task.id}`}
                            >
                              ▶ Start
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => onUpdateTaskStatus(task.id, 'completed')}
                              title="Complete task"
                              data-testid={`todo-complete-btn-${task.id}`}
                            >
                              ✓ Complete
                            </Button>
                          )}

                          {task.scheduledStart && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRescheduleTask(task)}
                              title="Reschedule time"
                              data-testid={`todo-reschedule-btn-${task.id}`}
                            >
                              ⏱ Move
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingTask(task)}
                            title="Edit task"
                          >
                            ✏️
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- DONE (LOWER SECTION) --- */}
        <div data-testid="dashboard-done-section" style={{ padding: 'var(--space-4) var(--space-5)', backgroundColor: 'var(--color-surface-hover)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text)' }}>
              Done
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: 'var(--color-success-bg)',
                color: 'var(--color-success-text)',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-success-border)',
              }}
            >
              {doneTasks.length}
            </span>
          </div>

          {doneTasks.length === 0 ? (
            <div
              data-testid="done-empty-state"
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                fontSize: 'var(--font-sm)',
                color: 'var(--color-muted-text)',
                border: '1px dashed var(--color-border)',
              }}
            >
              No completed tasks yet. Tap the circle next to any task above when you finish it.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {doneTasks.map((task) => (
                <div
                  key={task.id}
                  data-testid={`done-task-item-${task.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-surface)',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: '220px' }}>
                    {/* Ticked Circular Checkbox - Unticking immediately moves back to To Do */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked="true"
                      aria-label={`Mark "${task.name}" as incomplete`}
                      data-testid={`done-circle-${task.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateTaskStatus(task.id, 'pending');
                      }}
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
                      title="Click circle to untick and move back to To Do"
                    >
                      ✓
                    </button>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 'var(--font-base)',
                            textDecoration: 'line-through',
                            color: 'var(--color-muted-text)',
                          }}
                        >
                          {task.name}
                        </span>
                        <Badge type="status" value="completed" label="Done" />
                        {task.scheduledStart && (
                          <Badge type="daypart" value={getDayPart(task.scheduledStart)} />
                        )}
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', fontWeight: 600 }}>
                          ✓ Completed
                        </span>
                      </div>

                      {/* Relevant Time Info in 12-Hour Format */}
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px' }}>
                        <strong>{task.category}</strong>
                        {task.scheduledStart && task.scheduledEnd ? (
                          <> &bull; 🕒 {formatTimeRange12h(task.scheduledStart, task.scheduledEnd)} ({task.durationMinutes} mins)</>
                        ) : (
                          <> &bull; {task.durationMinutes} mins</>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUpdateTaskStatus(task.id, 'pending')}
                      title="Move back to To Do"
                      data-testid={`reopen-task-btn-${task.id}`}
                    >
                      ↩ Reopen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(task)}
                      title="Delete completed task"
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
      )}

      {/* Chronological Timeline / Daily Schedule */}
      <Card padding="none">
        <div
          style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>
              Daily Schedule
            </h3>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', marginTop: '2px', margin: 0 }}>
              Manage your tasks for today
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              flexShrink: 0,
              flexWrap: 'nowrap',
            }}
          >
            {onOpenAddTask && (
              <Button
                variant="outline"
                size="md"
                onClick={onOpenAddTask}
                data-testid="schedule-add-task-btn"
                title="Add task directly to today's schedule"
              >
                + Add Task
              </Button>
            )}
            <button
              type="button"
              onClick={handleOpenAI}
              aria-label="Plan with AI"
              title="Plan with AI"
              data-testid="plan-with-ai-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                padding: 0,
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--font-lg)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all var(--transition-fast)',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-primary-subtle)';
                e.currentTarget.style.borderColor = 'var(--color-primary-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                e.currentTarget.style.borderColor = 'var(--color-border)';
                e.currentTarget.style.transform = 'none';
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-primary)';
                e.currentTarget.style.outlineOffset = '2px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none';
              }}
            >
              <span role="img" aria-hidden="true">✨</span>
            </button>
          </div>
        </div>

        {/* Empty state message when no tasks are scheduled per requirement #6 */}
        {scheduledCount === 0 && (
          <div
            data-testid="timeline-empty-message"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-secondary-subtle)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: 'var(--font-sm)',
              color: 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
            }}
          >
            <span>
              No tasks yet. Use <strong>+ Add Task</strong> to fill your free time.
            </span>
            {onOpenAddTask && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenAddTask}
                data-testid="empty-add-task-btn"
                style={{ fontWeight: 800 }}
              >
                + Add Task
              </Button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {DAY_PARTS_ORDER.map((part) => {
            const partBlocks = displayBlocks.filter((b) => getDayPart(b.start) === part.id);
            // Hide section heading when it has no rows per requirement #2
            if (partBlocks.length === 0) return null;

            return (
              <div key={part.id} data-testid={`timeline-section-${part.id.toLowerCase()}`}>
                {/* Day-Part Section Heading */}
                <div
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    backgroundColor: 'var(--color-surface-hover)',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: 'var(--font-xs)',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span>{part.icon}</span>
                    <span>{part.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-muted-text)', textTransform: 'none' }}>
                    {part.range}
                  </span>
                </div>

                {/* Day-Part Rows */}
                {partBlocks.map((block) => {
                  const dayPart = getDayPart(block.start);

                  // Task block: reads details directly from LIVE task record per requirement
                  if (block.type === 'task') {
                    const liveTask = tasksMap.get(block.taskId);
                    if (!liveTask) return null;

                    const isCompleted = liveTask.status === 'completed';
                    const isSkipped = liveTask.status === 'skipped';
                    const isInProgress = liveTask.status === 'in_progress';
                    const isOverdueToday = !isPastDate && isTaskOverdue(liveTask, plan, now);

                    return (
                      <div
                        key={block.id}
                        data-testid={`task-row-${liveTask.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'stretch',
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: isCompleted
                            ? 'var(--color-success-bg)'
                            : isSkipped
                            ? 'var(--color-surface-hover)'
                            : isInProgress
                            ? 'var(--color-primary-subtle)'
                            : isOverdueToday
                            ? 'var(--color-danger-subtle)'
                            : 'var(--color-surface)',
                          transition: 'background-color var(--transition-fast)',
                        }}
                      >
                        {/* Time Column with 12-Hour display and Day-Part Badge */}
                        <div
                          style={{
                            width: '145px',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRight: '1px solid var(--color-border)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'flex-start',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--font-xs)',
                            fontWeight: 700,
                            color: 'var(--color-text)',
                            flexShrink: 0,
                            gap: '2px',
                          }}
                        >
                          <span>{formatTime12h(block.start)}</span>
                          <span style={{ color: 'var(--color-muted-text)', fontWeight: 500, lineHeight: 1 }}>&darr;</span>
                          <span>{formatTime12h(block.end)}</span>
                          <div style={{ marginTop: '2px' }}>
                            <Badge type="daypart" value={dayPart} />
                          </div>
                        </div>

                        {/* Task Card Body */}
                        <div
                          style={{
                            flex: 1,
                            padding: 'var(--space-4)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 'var(--space-3)',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px', flexWrap: 'wrap' }}>
                              {/* Circular Checkbox */}
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isCompleted}
                                aria-label={`Mark "${liveTask.name}" as ${isCompleted ? 'incomplete' : 'complete'}`}
                                data-testid={`timeline-circle-${liveTask.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateTaskStatus(liveTask.id, isCompleted ? 'pending' : 'completed');
                                }}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  border: isCompleted ? '2px solid var(--color-success)' : '2px solid var(--color-border-hover)',
                                  backgroundColor: isCompleted ? 'var(--color-success)' : 'transparent',
                                  color: '#FFFFFF',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  padding: 0,
                                  fontSize: '11px',
                                  fontWeight: 900,
                                  transition: 'all var(--transition-fast)',
                                }}
                                title={isCompleted ? 'Click to mark incomplete' : 'Click to mark complete'}
                              >
                                {isCompleted ? '✓' : ''}
                              </button>

                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: 'var(--font-base)',
                                  textDecoration: isCompleted ? 'line-through' : isSkipped ? 'line-through' : 'none',
                                  color: isSkipped ? 'var(--color-muted-text)' : 'var(--color-text)',
                                }}
                              >
                                {liveTask.name}
                              </span>
                              <Badge type="priority" value={liveTask.priority} />
                              <Badge type="status" value={liveTask.status} />

                              {isOverdueToday && (
                                <span
                                  data-testid={`overdue-badge-${liveTask.id}`}
                                  style={{
                                    fontSize: 'var(--font-xs)',
                                    fontWeight: 700,
                                    color: 'var(--color-danger)',
                                    backgroundColor: 'var(--color-danger-subtle)',
                                    border: '1px solid var(--color-danger)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  ⚠️ Overdue
                                </span>
                              )}

                              {isPastDate && !isCompleted && !isSkipped && (
                                <span
                                  data-testid={`past-overdue-badge-${liveTask.id}`}
                                  style={{
                                    fontSize: 'var(--font-xs)',
                                    fontWeight: 700,
                                    color: 'var(--color-muted-text)',
                                    backgroundColor: 'var(--color-surface-hover)',
                                    border: '1px solid var(--color-border)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  Past Due (History)
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                              <strong>{liveTask.category}</strong> &bull; {liveTask.durationMinutes} mins
                              {liveTask.notes && ` • "${liveTask.notes}"`}
                            </div>
                          </div>

                          {/* Task Actions */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            {isPastDate ? (
                              <>
                                {!isCompleted && !isSkipped && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onUpdateTaskStatus(liveTask.id, 'skipped')}
                                      title="Mark task skipped"
                                      data-testid={`past-skip-btn-${liveTask.id}`}
                                    >
                                      Skip
                                    </Button>
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => setMovingTask(liveTask)}
                                      title="Move to another day"
                                      data-testid={`past-move-btn-${liveTask.id}`}
                                    >
                                      📅 Move to another day
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {isOverdueToday && onOpenMissedModal && (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => onOpenMissedModal(liveTask)}
                                    title="Resolve missed task"
                                    data-testid={`resolve-missed-btn-${liveTask.id}`}
                                    style={{ fontWeight: 800 }}
                                  >
                                    ⚡ Resolve Missed
                                  </Button>
                                )}

                                {!isCompleted && !isSkipped && (
                                  <>
                                    {liveTask.status !== 'in_progress' ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleStartTaskClick(liveTask)}
                                        title="Start task"
                                        data-testid={`start-task-btn-${liveTask.id}`}
                                      >
                                        ▶ Start
                                      </Button>
                                    ) : (
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => onUpdateTaskStatus(liveTask.id, 'completed')}
                                        title="Mark task completed"
                                        data-testid={`complete-task-btn-${liveTask.id}`}
                                      >
                                        ✓ Complete
                                      </Button>
                                    )}

                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => onUpdateTaskStatus(liveTask.id, 'completed')}
                                      title="Mark completed"
                                    >
                                      ✓
                                    </Button>

                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onUpdateTaskStatus(liveTask.id, 'skipped')}
                                      title="Skip task"
                                    >
                                      Skip
                                    </Button>
                                  </>
                                )}

                                {(isCompleted || isSkipped) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onUpdateTaskStatus(liveTask.id, 'pending')}
                                    title="Reopen task"
                                    data-testid={`reopen-task-btn-${liveTask.id}`}
                                  >
                                    Reopen
                                  </Button>
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRescheduleTask(liveTask)}
                                  title="Reschedule task time"
                                >
                                  ⏱ Move
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingTask(liveTask)}
                                  title="Edit task"
                                >
                                  ✏️
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(liveTask)}
                                  title="Delete task"
                                  data-testid={`delete-task-btn-${liveTask.id}`}
                                >
                                  🗑️
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Available Free Window row per requirement #1, #2, #5
                  if (block.type === 'free') {
                    return (
                      <div
                        key={block.id}
                        data-testid={`free-block-${block.start}-${block.end}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-secondary-subtle)',
                        }}
                      >
                        <div
                          style={{
                            width: '145px',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRight: '1px solid var(--color-border)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--font-xs)',
                            color: 'var(--color-muted-text)',
                            fontWeight: 600,
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                          }}
                        >
                          <span>{formatTimeRange12h(block.start, block.end)}</span>
                          <Badge type="daypart" value={dayPart} />
                        </div>
                        <div
                          style={{
                            padding: 'var(--space-3) var(--space-4)',
                            fontSize: 'var(--font-xs)',
                            color: 'var(--color-text)',
                            fontWeight: 600,
                          }}
                        >
                          {formatFreeSlot12h(block.start, block.end, block.durationMinutes)}
                        </div>
                      </div>
                    );
                  }

                  // Break block: rendered lightly
                  if (block.type === 'break') {
                    return (
                      <div
                        key={block.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface-hover)',
                        }}
                      >
                        <div
                          style={{
                            width: '145px',
                            padding: 'var(--space-3) var(--space-4)',
                            borderRight: '1px solid var(--color-border)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--font-xs)',
                            color: 'var(--color-muted-text)',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            gap: '4px',
                          }}
                        >
                          <span>{formatTimeRange12h(block.start, block.end)}</span>
                          <Badge type="daypart" value={dayPart} />
                        </div>
                        <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', fontStyle: 'italic' }}>
                          ☕ {block.title}
                        </div>
                      </div>
                    );
                  }

                  // Fixed blocks (Sleep, Work, Travel, Meal, Commitment)
                  const iconMap = {
                    sleep: '🌙',
                    work: '💼',
                    travel: '🚗',
                    meal: '🥗',
                    commitment: '📌',
                  };

                  return (
                    <div
                      key={block.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface-hover)',
                        opacity: 0.9,
                      }}
                    >
                      <div
                        style={{
                          width: '145px',
                          padding: 'var(--space-3) var(--space-4)',
                          borderRight: '1px solid var(--color-border)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--font-xs)',
                          fontWeight: 600,
                          color: 'var(--color-muted-text)',
                          flexShrink: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '4px',
                        }}
                      >
                        <span>{formatTimeRange12h(block.start, block.end)}</span>
                        <Badge type="daypart" value={dayPart} />
                      </div>
                      <div style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span>{iconMap[block.type] || '•'}</span>
                        <strong>{block.title}</strong>
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-subtle-text)' }}>(Fixed Routine)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reschedule Modal */}
      {rescheduleTask && (
        <RescheduleModal
          isOpen={Boolean(rescheduleTask)}
          onClose={() => setRescheduleTask(null)}
          task={rescheduleTask}
          plan={plan}
          onConfirmReschedule={onRescheduleTask}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <EditTaskModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          plan={plan}
          onSaveTask={onEditTaskDetails}
        />
      )}

      {/* Pause Existing in_progress Confirmation Modal */}
      {pausePromptTask && (
        <Modal
          isOpen={Boolean(pausePromptTask)}
          onClose={() => setPausePromptTask(null)}
          title="Pause Currently Active Task?"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" onClick={() => setPausePromptTask(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmPauseAndStart}>
                Pause & Start "{pausePromptTask.name}"
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
              Task <strong>"{currentInProgressTask?.name}"</strong> is currently in progress. Only one task can be in progress at a time.
            </p>
            <Alert type="info">
              Starting <strong>"{pausePromptTask.name}"</strong> will pause <strong>"{currentInProgressTask?.name}"</strong> and return it to pending status.
            </Alert>
          </div>
        </Modal>
      )}

      {/* Confirm Deleting Completed Task Modal */}
      {deletingTask && (
        <Modal
          isOpen={Boolean(deletingTask)}
          onClose={() => setDeletingTask(null)}
          title="Delete Completed Task?"
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" onClick={() => setDeletingTask(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDeleteCompleted}>
                Delete Completed Task
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
              Are you sure you want to delete <strong>"{deletingTask.name}"</strong>?
            </p>
            <Alert type="warning">
              Deleting a completed task removes it from your completed history and progress.
            </Alert>
          </div>
        </Modal>
      )}

      {/* Move Task to Another Day Modal */}
      {movingTask && (
        <Modal
          isOpen={Boolean(movingTask)}
          onClose={() => setMovingTask(null)}
          title={`Move Task: "${movingTask.name}"`}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <Button variant="outline" onClick={() => setMovingTask(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleConfirmMoveTask}>
                Move to {formatDisplayDate(targetMoveDate)}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)' }}>
              Transfer this task to another calendar day. It will be scheduled in that day's timetable.
            </p>
            <DatePicker
              id="timetable-move-date-field"
              label="Select Target Date"
              value={targetMoveDate}
              onChange={(val) => setTargetMoveDate(val)}
              minDate={todayDate}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
