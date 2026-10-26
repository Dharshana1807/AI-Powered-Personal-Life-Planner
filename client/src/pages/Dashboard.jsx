import React, { useState, useEffect } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import Badge from '../components/common/Badge.jsx';
import EmptyState from '../components/common/EmptyState.jsx';
import Alert from '../components/common/Alert.jsx';
import DailyPlanForm from '../components/dashboard/DailyPlanForm.jsx';
import Timetable from '../components/dashboard/Timetable.jsx';
import UnscheduledTasksList from '../components/dashboard/UnscheduledTasksList.jsx';
import RegeneratePreviewModal from '../components/dashboard/RegeneratePreviewModal.jsx';
import AddTaskModal from '../components/dashboard/AddTaskModal.jsx';
import MissedTaskModal, { calculateScheduleOverload } from '../components/dashboard/MissedTaskModal.jsx';
import RoutineSetupModal from '../components/dashboard/RoutineSetupModal.jsx';
import DietDashboardSummary from '../components/dashboard/DietDashboardSummary.jsx';
import DatePicker from '../components/common/DatePicker.jsx';
import { toLocalISODate, formatLocalDateString, formatTime12h } from '../utils/dateUtils.js';
import { generateSchedule } from '../utils/scheduler.js';
import { isTaskOverdue } from '../utils/taskOperations.js';
import { usePlanner } from '../context/PlannerContext.jsx';

export default function Dashboard() {
  const {
    selectedDate,
    setSelectedDate,
    getPlan,
    savePlan,
    storageError,
    clearStorageError,
    addTaskOp,
    editTaskOp,
    deleteTaskOp,
    setTaskStatusOp,
    rescheduleTaskOp,
    moveTaskToDateOp,
    shortenTaskOp,
  } = usePlanner();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [regeneratePreview, setRegeneratePreview] = useState(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [missedModalTask, setMissedModalTask] = useState(null);
  const [notification, setNotification] = useState(null);
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('adaptive_planner_username') || '';
    } catch {
      return '';
    }
  });

  // Maintain "now" state and refresh every 60 seconds without page refresh per requirement #4
  const [now, setNow] = useState(() => {
    const d = new Date();
    return {
      localDate: toLocalISODate(d),
      currentTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setNow({
        localDate: toLocalISODate(d),
        currentTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      });
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const currentPlan = getPlan(selectedDate);
  const todayDate = now.localDate || toLocalISODate();
  const isToday = selectedDate === todayDate;

  // Overdue tasks for today's plan
  const overdueTasks = (isToday && currentPlan)
    ? (currentPlan.tasks || []).filter((t) => isTaskOverdue(t, currentPlan, now))
    : [];

  const overloadInfo = (isToday && currentPlan)
    ? calculateScheduleOverload(currentPlan, now)
    : { isOverloaded: false, overloadMins: 0, remainingFreeMins: 0, remainingPlannedMins: 0 };

  // Plan status translation
  const getStatusBadge = () => {
    if (!currentPlan || currentPlan.status === 'no_plan') {
      return <Badge type="status" value="pending" label="No Plan Yet" />;
    }
    if (currentPlan.status === 'scheduled') {
      return <Badge type="status" value="completed" label="Schedule Active" />;
    }
    if (currentPlan.status === 'ready_to_generate') {
      return <Badge type="status" value="rescheduled" label="Ready to Generate" />;
    }
    if (currentPlan.status === 'details_saved') {
      return <Badge type="status" value="pending" label="Details Saved" />;
    }
    return <Badge type="status" value="pending" label={currentPlan.status} />;
  };

  const handleStartPlan = () => {
    setIsFormOpen(true);
  };

  const handleFormComplete = () => {
    setIsFormOpen(false);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
  };

  // Generate directly from Dashboard if details were previously saved without schedule
  const handleGenerateFromDashboard = () => {
    if (!currentPlan) return;
    if (!currentPlan.tasks || currentPlan.tasks.length === 0) {
      setNotification({
        type: 'error',
        title: 'Cannot Generate Plan',
        message: 'Add at least one task to generate a plan.',
      });
      return;
    }
    const scheduleResult = generateSchedule(currentPlan);
    const updatedPlan = {
      ...currentPlan,
      schedule: {
        generatedAt: new Date().toISOString(),
        blocks: scheduleResult.scheduledBlocks,
        unscheduled: scheduleResult.unscheduledTasks,
      },
      tasks: scheduleResult.scheduledTasks,
      status: 'scheduled',
    };
    savePlan(selectedDate, updatedPlan);
    setNotification({
      type: 'success',
      title: 'Schedule Generated',
      message: `Your chronological schedule for ${selectedDate} is now active.`,
    });
  };

  // Regenerate with Preview
  const handleOpenRegenerate = () => {
    if (!currentPlan) return;
    const previewResult = generateSchedule(currentPlan, { isRegeneration: true });
    setRegeneratePreview(previewResult);
    setShowRegenerateModal(true);
  };

  const handleApplyRegeneratedSchedule = () => {
    if (!currentPlan || !regeneratePreview) return;
    const updatedPlan = {
      ...currentPlan,
      schedule: {
        generatedAt: new Date().toISOString(),
        blocks: regeneratePreview.scheduledBlocks,
        unscheduled: regeneratePreview.unscheduledTasks,
      },
      tasks: regeneratePreview.scheduledTasks,
      status: 'scheduled',
    };
    savePlan(selectedDate, updatedPlan);
    setShowRegenerateModal(false);
    setRegeneratePreview(null);
    setNotification({
      type: 'success',
      title: 'Schedule Regenerated',
      message: 'Updated timetable applied. Locked and completed tasks were kept in place.',
    });
  };

  if (isFormOpen) {
    return (
      <div style={{ paddingBottom: 'var(--space-8)' }}>
        <DailyPlanForm
          initialDate={selectedDate}
          onComplete={handleFormComplete}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  const hasScheduledTimetable = currentPlan && currentPlan.status === 'scheduled' && currentPlan.schedule;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Notifications */}
      {storageError && (
        <Alert type="error" title="Storage Notice" onClose={clearStorageError}>
          {storageError}
        </Alert>
      )}

      {notification && (
        <Alert
          type={notification.type}
          title={notification.title}
          onClose={() => setNotification(null)}
        >
          {notification.message}
        </Alert>
      )}

      {/* OVERDUE TASKS BANNER (Today Only) */}
      {isToday && overdueTasks.length > 0 && (
        <div
          data-testid="overdue-banner"
          style={{
            padding: 'var(--space-4) var(--space-5)',
            backgroundColor: 'var(--color-danger-subtle)',
            border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <strong style={{ fontSize: 'var(--font-base)', color: 'var(--color-danger)' }}>
                You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''} today
              </strong>
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text)' }}>
              Task "{overdueTasks[0].name}" was scheduled to finish by {formatTime12h(overdueTasks[0].scheduledEnd)}.
              {overloadInfo.isOverloaded && (
                <span style={{ fontWeight: 700, color: 'var(--color-danger)', marginLeft: '6px' }}>
                  ⚠️ Schedule overload: remaining work exceeds free time by {overloadInfo.overloadMins} minutes.
                </span>
              )}
            </div>
          </div>

          <Button
            variant="danger"
            size="md"
            onClick={() => setMissedModalTask(overdueTasks[0])}
            data-testid="resolve-overdue-banner-btn"
            style={{ fontWeight: 800 }}
          >
            ⚡ Resolve Missed Task
          </Button>
        </div>
      )}

      {/* Page Header with Welcome & Date Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              {formatLocalDateString(selectedDate)}
            </span>
            {getStatusBadge()}
          </div>
          <h1
            style={{
              fontSize: 'var(--font-3xl)',
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {username ? `Welcome, ${username}` : 'Daily Schedule Dashboard'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            <p style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted-text)', margin: 0 }}>
              {username ? `${username}'s plan for today` : 'Your plan for today'}
            </p>
            <a
              href="#/welcome"
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--color-muted-text)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              title="Switch user / Go to welcome page"
            >
              (Switch user)
            </a>
          </div>
        </div>

        {/* Date Selector & Primary Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <label
              htmlFor="dashboard-date-picker"
              style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--color-muted-text)' }}
            >
              PLAN DATE:
            </label>
            <div style={{ width: '180px' }}>
              <DatePicker
                id="dashboard-date-picker"
                value={selectedDate}
                onChange={(newDate) => setSelectedDate(newDate)}
                style={{ marginBottom: 0 }}
              />
            </div>
          </div>

          {/* Add Task & Plan with AI Button */}
          {hasScheduledTimetable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowAddTaskModal(true)}
                data-testid="add-task-header-btn"
                title="Add task directly to today's schedule"
              >
                + Add Task
              </Button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/assistant';
                }}
                aria-label="Plan with AI"
                title="Plan with AI"
                data-testid="header-plan-with-ai-btn"
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
          )}

          {/* Regular Routine Button */}
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowRoutineModal(true)}
            title="Set your regular daily routine commitments"
          >
            ⚙️ Regular Routine
          </Button>

          {currentPlan && currentPlan.status !== 'no_plan' ? (
            <Button variant="outline" size="md" onClick={handleStartPlan}>
              ✏️ Edit Day's Details
            </Button>
          ) : (
            <Button variant="primary" size="md" onClick={handleStartPlan}>
              ⚡ {isToday ? "Create Today's Plan" : `Create Plan for ${selectedDate}`}
            </Button>
          )}

          {/* Regenerate Plan button */}
          {hasScheduledTimetable && (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenRegenerate}
              title="Regenerate plan with preview"
            >
              🔄 Regenerate Plan
            </Button>
          )}
        </div>
      </div>

      {/* Browser Local Storage Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          padding: 'var(--space-2) var(--space-4)',
          backgroundColor: 'var(--color-secondary-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-secondary)',
          fontSize: 'var(--font-xs)',
          color: 'var(--color-text)',
        }}
      >
        <span>🔒</span>
        <span>
          <strong>Browser-Only Storage:</strong> Your plans are saved in this browser only and do not sync across devices.
        </span>
      </div>

      {/* Routine Notes Banner if priorities or special circumstances are present */}
      {(currentPlan?.priorities || currentPlan?.specialCircumstances) && (
        <Card highlight="yellow" padding="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {currentPlan.priorities && (
              <div style={{ fontSize: 'var(--font-sm)', color: 'var(--color-text)' }}>
                <strong>Today's Focus:</strong> {currentPlan.priorities}
              </div>
            )}
            {currentPlan.specialCircumstances && (
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)' }}>
                <strong>Special Circumstances:</strong> {currentPlan.specialCircumstances}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Daily Nutrition & Meal Tracking Summary */}
      <DietDashboardSummary selectedDate={selectedDate} />

      {/* Main View: Timetable or Empty State */}
      {hasScheduledTimetable ? (
        <>
          <Timetable
            plan={currentPlan}
            now={now}
            showTodoDone={false}
            onOpenAIAssistant={() => {
              window.location.hash = '#/assistant';
            }}
            onUpdateTaskStatus={(taskId, newStatus, opts) =>
              setTaskStatusOp(selectedDate, taskId, newStatus, opts)
            }
            onRescheduleTask={(taskId, newStart, newEnd, opts) =>
              rescheduleTaskOp(selectedDate, taskId, newStart, newEnd, opts)
            }
            onEditTaskDetails={(taskId, updates) =>
              editTaskOp(selectedDate, taskId, updates)
            }
            onDeleteTask={(taskId, opts) =>
              deleteTaskOp(selectedDate, taskId, opts)
            }
            onMoveTaskToDate={(fromDate, toDate, taskId) =>
              moveTaskToDateOp(fromDate, toDate, taskId)
            }
            onOpenMissedModal={(task) => setMissedModalTask(task)}
            onOpenAddTask={() => setShowAddTaskModal(true)}
          />

          {/* Unscheduled Tasks Section */}
          <UnscheduledTasksList
            unscheduledTasks={currentPlan.schedule.unscheduled}
            onShortenAndRetry={(taskId, newDuration) =>
              shortenTaskOp(selectedDate, taskId, newDuration)
            }
            onMoveToAnotherDay={(taskId, targetDate) =>
              moveTaskToDateOp(selectedDate, targetDate, taskId)
            }
            onEditTask={(taskId) => {
              const task = currentPlan.tasks?.find((t) => t.id === taskId);
              if (task) {
                handleStartPlan();
              }
            }}
          />
        </>
      ) : currentPlan && (currentPlan.status === 'details_saved' || currentPlan.status === 'ready_to_generate') ? (
        <Card padding="lg">
          <EmptyState
            icon="⚡"
            title="Details Saved - Ready to Generate Timetable"
            description="Your routine boundaries, fixed commitments, and task list are configured. Click below to generate your chronological timetable."
            action={
              <Button variant="primary" onClick={handleGenerateFromDashboard}>
                ⚡ Generate My Daily Plan
              </Button>
            }
          />
        </Card>
      ) : (
        <Card padding="lg">
          <EmptyState
            icon="📅"
            title="No plan yet for this date"
            description="Click below to set your waking hours, fixed commitments, meals, and tasks."
            action={
              <Button variant="primary" onClick={handleStartPlan}>
                ⚡ {isToday ? "Create Today's Plan" : `Create Plan for ${selectedDate}`}
              </Button>
            }
          />
        </Card>
      )}

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onAddTask={(taskData) => addTaskOp(selectedDate, taskData)}
      />

      {/* Missed Task Modal (Handles ONE overdue task at a time) */}
      {missedModalTask && (
        <MissedTaskModal
          isOpen={Boolean(missedModalTask)}
          onClose={() => setMissedModalTask(null)}
          task={missedModalTask}
          plan={currentPlan}
          now={now}
          onReschedule={(taskId, newStart, newEnd) =>
            rescheduleTaskOp(selectedDate, taskId, newStart, newEnd)
          }
          onShorten={(taskId, newDuration) =>
            shortenTaskOp(selectedDate, taskId, newDuration)
          }
          onMoveToDate={(fromDate, toDate, taskId) =>
            moveTaskToDateOp(fromDate, toDate, taskId)
          }
          onSkip={(taskId) =>
            setTaskStatusOp(selectedDate, taskId, 'skipped')
          }
          onKeepPending={() => setMissedModalTask(null)}
        />
      )}

      {/* Regenerate Preview Modal */}
      <RegeneratePreviewModal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        currentPlan={currentPlan}
        previewResult={regeneratePreview}
        onApply={handleApplyRegeneratedSchedule}
      />

      {/* Regular Routine Setup Modal */}
      {showRoutineModal && (
        <RoutineSetupModal
          isOpen={showRoutineModal}
          onClose={() => setShowRoutineModal(false)}
        />
      )}
    </div>
  );
}
