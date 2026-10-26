import React, { useState } from 'react';
import Card from '../components/common/Card.jsx';
import Button from '../components/common/Button.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import DailyPlanForm from '../components/dashboard/DailyPlanForm.jsx';
import Timetable from '../components/dashboard/Timetable.jsx';
import AddTaskModal from '../components/dashboard/AddTaskModal.jsx';
import EditTaskModal from '../components/dashboard/EditTaskModal.jsx';
import RescheduleModal from '../components/dashboard/RescheduleModal.jsx';
import MissedTaskModal from '../components/dashboard/MissedTaskModal.jsx';
import DatePicker from '../components/common/DatePicker.jsx';
import { usePlanner } from '../context/PlannerContext.jsx';
import { toLocalISODate, formatDisplayDate } from '../utils/dateUtils.js';

export default function DailyPlanner() {
  const {
    selectedDate,
    setSelectedDate,
    getPlan,
    savePlan,
    addTaskOp,
    editTaskOp,
    deleteTaskOp,
    setTaskStatusOp,
    rescheduleTaskOp,
    moveTaskToDateOp,
  } = usePlanner();

  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [reschedulingTask, setReschedulingTask] = useState(null);
  const [missedTask, setMissedTask] = useState(null);

  const plan = getPlan(selectedDate);
  const now = {
    localDate: toLocalISODate(),
    currentTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
  };

  const suggestedPrompts = [
    'Create a timetable for today',
    'Move my afternoon study to 5 PM',
    'I finished my work early, reorganize remaining tasks',
    'Give me a 30-minute break after college',
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <PageHeader
        title="Daily Planner & Schedule"
        description="Build, view, and adapt your day's timetable. Protect your waking hours, fixed routine commitments, and meals."
        suggestedPrompts={suggestedPrompts}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <div style={{ width: '160px' }}>
              <DatePicker
                id="planner-date-select"
                value={selectedDate}
                onChange={(d) => setSelectedDate(d)}
              />
            </div>
            <Button variant="primary" onClick={() => setShowAddTaskModal(true)}>
              + Add Task
            </Button>
            <Button
              variant={isEditingPlan ? 'outline' : 'primary'}
              onClick={() => setIsEditingPlan(!isEditingPlan)}
            >
              {isEditingPlan ? 'Close Editor' : plan ? '⚡ Edit Plan' : '⚡ Create Plan'}
            </Button>
          </div>
        }
      />

      {isEditingPlan ? (
        <DailyPlanForm
          initialDate={selectedDate}
          onComplete={() => setIsEditingPlan(false)}
          onCancel={() => setIsEditingPlan(false)}
        />
      ) : plan ? (
        <Timetable
          plan={plan}
          now={now}
          onUpdateTaskStatus={setTaskStatusOp}
          onRescheduleTask={(taskId, start, end) => rescheduleTaskOp(taskId, start, end)}
          onEditTaskDetails={(task) => setEditingTask(task)}
          onDeleteTask={deleteTaskOp}
          onMoveTaskToDate={moveTaskToDateOp}
          onOpenMissedModal={(task) => setMissedTask(task)}
        />
      ) : (
        <Card padding="lg" style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
          <div style={{ fontSize: '42px', marginBottom: 'var(--space-3)' }}>📅</div>
          <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 800, margin: '0 0 var(--space-2)' }}>
            No Plan Created for {formatDisplayDate(selectedDate)}
          </h2>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--color-muted-text)', maxWidth: '520px', margin: '0 auto var(--space-5)', lineHeight: 1.5 }}>
            You haven't scheduled any timetable for this day yet. Generate an adaptive schedule around your regular routine or add tasks manually.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={() => setIsEditingPlan(true)}>
              ⚡ Create Today's Timetable
            </Button>
            <Button variant="outline" size="lg" onClick={() => (window.location.hash = '#/assistant')}>
              🤖 Ask AI Assistant to Plan
            </Button>
          </div>
        </Card>
      )}

      {/* Modals */}
      {showAddTaskModal && (
        <AddTaskModal
          isOpen={showAddTaskModal}
          onClose={() => setShowAddTaskModal(false)}
          plan={plan}
          onAddTask={(taskData) => {
            addTaskOp(taskData);
            setShowAddTaskModal(false);
          }}
        />
      )}

      {editingTask && (
        <EditTaskModal
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          plan={plan}
          onSaveTask={(id, updates) => {
            editTaskOp(id, updates);
            setEditingTask(null);
          }}
        />
      )}

      {reschedulingTask && (
        <RescheduleModal
          isOpen={Boolean(reschedulingTask)}
          onClose={() => setReschedulingTask(null)}
          task={reschedulingTask}
          plan={plan}
          onConfirmReschedule={(id, s, e) => {
            rescheduleTaskOp(id, s, e);
            setReschedulingTask(null);
          }}
        />
      )}

      {missedTask && (
        <MissedTaskModal
          isOpen={Boolean(missedTask)}
          onClose={() => setMissedTask(null)}
          task={missedTask}
          plan={plan}
          now={now}
          onReschedule={(id, s, e) => {
            rescheduleTaskOp(id, s, e);
            setMissedTask(null);
          }}
          onShorten={(id, mins) => {
            // shorten logic
            setMissedTask(null);
          }}
          onMoveToDate={(id, newDate) => {
            moveTaskToDateOp(id, newDate);
            setMissedTask(null);
          }}
          onSkip={(id) => {
            setTaskStatusOp(id, 'skipped');
            setMissedTask(null);
          }}
        />
      )}
    </div>
  );
}
