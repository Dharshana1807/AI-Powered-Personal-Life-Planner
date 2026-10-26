import React, { useState, useEffect, useMemo } from 'react';
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
import DailyProgressSummary from '../components/dashboard/DailyProgressSummary.jsx';
import GoalProgressOverview from '../components/dashboard/GoalProgressOverview.jsx';
import UpcomingReminders from '../components/dashboard/UpcomingReminders.jsx';
import DatePicker from '../components/common/DatePicker.jsx';
import { toLocalISODate, formatLocalDateString, formatTime12h, formatDisplayDate } from '../utils/dateUtils.js';
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

  // Maintain "now" state and refresh every 60 seconds
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

  // Date Navigation Handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(toLocalISODate(d));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(toLocalISODate(d));
  };

  const handleGoToday = () => {
    setSelectedDate(todayDate);
  };

  // One-line summary computed live strictly from saved records
  const planSummaryLine = useMemo(() => {
    if (!currentPlan || !currentPlan.tasks || currentPlan.tasks.length === 0) {
      return 'No tasks scheduled yet for this date. Use + Add Task or Generate with Gemini to plan.';
    }
    const all = currentPlan.tasks;
    const scheduled = all.filter((t) => t.scheduledStart && t.scheduledEnd);
    const completed = all.filter((t) => t.status === 'completed');
    const totalPlannedMins = scheduled.reduce((acc, t) => acc + (Number(t.durationMinutes) || 0), 0);
    const hours = Math.floor(totalPlannedMins / 60);
    const mins = totalPlannedMins % 60;
    const timeStr = hours > 0 ? (mins > 0 ? `${hours}h ${mins}m` : `${hours}h`) : `${mins}m`;

    if (completed.length === all.length && all.length > 0) {
      return `🎉 All ${all.length} tasks completed for ${selectedDate} (${timeStr} planned). Excellent consistency!`;
    }

    const nextUpcoming = scheduled
      .filter((t) => t.status !== 'completed' && t.status !== 'skipped')
      .sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''))[0];

    const nextStr = nextUpcoming ? ` • Next: "${nextUpcoming.name}" at ${formatTime12h(nextUpcoming.scheduledStart)}` : '';

    return `${scheduled.length} task${scheduled.length === 1 ? '' : 's'} scheduled (${timeStr} planned) • ${completed.length} completed${nextStr}`;
  }, [currentPlan, selectedDate]);

  const handleStartPlan = () => {
    setIsFormOpen(true);
  };

  const handleFormComplete = () => {
    setIsFormOpen(false);
  };

  const handleFormCancel = () => {
    setIsFormOpen(false);
  };

  // Generate directly from Dashboard
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
    savePlan(selectedDate, updatedPlan, {
      recordVersion: true,
      action: 'Schedule Generated',
      author: 'User',
      summary: `Generated timetable with ${scheduleResult.scheduledTasks.length} tasks`,
    });
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
    savePlan(selectedDate, updatedPlan, {
      recordVersion: true,
      action: 'Schedule Regenerated',
      author: 'User',
      summary: `Regenerated timetable (${regeneratePreview.scheduledTasks.length} tasks)`,
    });
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

      {/* SECTION 1: HEADER & TOOLBAR */}
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
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted-text)', fontWeight: 600 }}>
              Today is {formatLocalDateString(todayDate)} &bull; Planning for:
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 800, color: 'var(--color-text)' }}>
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
            {username ? `Welcome, ${username}` : 'Adaptive AI Life Planner'}
          </h1>

          {/* One-line dynamic summary of the day's plan */}
          <div
            style={{
              marginTop: 'var(--space-1)',
              fontSize: 'var(--font-sm)',
              color: 'var(--color-muted-text)',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {planSummaryLine}
          </div>
        </div>

        {/* Toolbar: [Date Picker with Prev/Next] [Add Task] [AI ✦] [Regular Routine] [Edit Details] [Regenerate] */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {/* Date Navigator: [ ◀ ] [ Date Picker ] [ ▶ ] */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--color-surface)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={handlePrevDay}
              title="Previous day"
              aria-label="Previous day"
              style={{
                width: '32px',
                height: '34px',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ◀
            </button>

            <div style={{ width: '160px' }}>
              <DatePicker
                id="dashboard-date-picker"
                value={selectedDate}
                onChange={(newDate) => setSelectedDate(newDate)}
                style={{ marginBottom: 0 }}
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              title="Next day"
              aria-label="Next day"
              style={{
                width: '32px',
                height: '34px',
                border: 'none',
                backgroundColor: 'transparent',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--color-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ▶
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={handleGoToday}
                title="Jump to today"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'var(--color-primary-subtle)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  marginLeft: '2px',
                }}
              >
                Today
              </button>
            )}
          </div>

          {/* Add Task Button */}
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowAddTaskModal(true)}
            data-testid="add-task-header-btn"
            title="Add task directly to schedule"
          >
            + Add Task
          </Button>

          {/* AI ✦ shortcut — adjacent to Add Task */}
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/assistant';
            }}
            aria-label="Open AI Assistant"
            title="Open Gemini AI Assistant"
            data-testid="header-plan-with-ai-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              padding: 0,
              backgroundColor: 'var(--color-primary-subtle)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-lg)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all var(--transition-fast)',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-subtle)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span role="img" aria-hidden="true">✨</span>
          </button>

          {/* Regular Routine Button */}
          <Button
            variant="outline"
            size="md"
            onClick={() => setShowRoutineModal(true)}
            title="Set your regular daily routine commitments"
          >
            ⚙️ Regular Routine
          </Button>

          {/* Edit Day's Details */}
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

      {/* SECTION 2: TODAY'S SCHEDULE (PRIMARY FOCUS, DIRECTLY BELOW TOOLBAR) */}
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

          {/* Unscheduled Tasks Section if any */}
          {currentPlan.schedule?.unscheduled?.length > 0 && (
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
          )}
        </>
      ) : currentPlan && (currentPlan.status === 'details_saved' || currentPlan.status === 'ready_to_generate') ? (
        <Card padding="lg">
          <EmptyState
            icon="⚡"
            title="Details Saved - Ready to Generate Timetable"
            description="Your routine boundaries, fixed commitments, and task list are configured. Click below to generate your chronological timetable."
            action={
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={handleGenerateFromDashboard}>
                  ⚡ Generate My Daily Plan
                </Button>
                <Button variant="outline" onClick={() => (window.location.hash = '#/assistant')}>
                  ✨ Plan with Gemini Assistant
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <Card padding="lg">
          <EmptyState
            icon="📅"
            title={`No plan yet for ${formatDisplayDate(selectedDate)}`}
            description="Add tasks to your schedule or ask the AI assistant to tailor an adaptive timetable around your regular routine."
            action={
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="outline" onClick={() => setShowAddTaskModal(true)}>
                  + Add Task
                </Button>
                <Button variant="primary" onClick={() => (window.location.hash = '#/assistant')}>
                  ✨ Generate with Gemini
                </Button>
                <Button variant="outline" onClick={handleStartPlan}>
                  ⚡ Create Plan Manually
                </Button>
              </div>
            }
          />
        </Card>
      )}

      {/* SECTION 3: DAILY PROGRESS SUMMARY (COMPACT STAT CARDS UNDER SCHEDULE) */}
      <DailyProgressSummary plan={currentPlan} />

      {/* SECTION 4: GOAL PROGRESS OVERVIEW */}
      <GoalProgressOverview selectedDate={selectedDate} />

      {/* SECTION 5: NUTRITION & MEAL TRACKING SUMMARY */}
      <DietDashboardSummary selectedDate={selectedDate} />

      {/* SECTION 6: UPCOMING & SMART REMINDERS */}
      <UpcomingReminders selectedDate={selectedDate} now={now} />

      {/* MODALS */}
      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={showAddTaskModal}
        onClose={() => setShowAddTaskModal(false)}
        onAddTask={(taskData) => addTaskOp(selectedDate, taskData)}
      />

      {/* Missed Task Modal */}
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
