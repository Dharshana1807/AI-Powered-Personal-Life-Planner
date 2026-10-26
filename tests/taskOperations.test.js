import { describe, it, expect } from 'vitest';
import {
  addTask,
  editTask,
  deleteTask,
  setTaskStatus,
  rescheduleTask,
  moveTaskToDate,
  shortenTask,
  isTaskOverdue,
  checkPlanIntegrity,
} from '../client/src/utils/taskOperations.js';

describe('Pure Task Operations Module Tests', () => {
  const createBaseStore = () => ({
    schemaVersion: 3,
    plans: {
      '2026-10-12': {
        schemaVersion: 3,
        date: '2026-10-12',
        userType: 'both',
        wakeTime: '06:00',
        bedTime: '23:00',
        workHours: null,
        travelMinutes: 0,
        meals: [
          { name: 'Lunch', start: '12:00', end: '13:00' },
        ],
        commitments: [],
        freeSlots: [],
        priorities: '',
        specialCircumstances: '',
        tasks: [
          {
            id: 'task-1',
            date: '2026-10-12',
            name: 'Task 1',
            durationMinutes: 60,
            priority: 'High',
            category: 'Education',
            status: 'pending',
            scheduledStart: '08:00',
            scheduledEnd: '09:00',
            updatedAt: '2026-10-12T06:00:00.000Z',
            completedAt: null,
            skippedAt: null,
          },
        ],
        status: 'scheduled',
        schedule: {
          blocks: [
            { id: 'meal-1', type: 'meal', title: 'Lunch', start: '12:00', end: '13:00' },
            { id: 'block-1', type: 'task', taskId: 'task-1', start: '08:00', end: '09:00' },
          ],
          unscheduled: [],
        },
      },
    },
  });

  describe('Pure immutability & atomic execution', () => {
    it('does not mutate original store on addTask', () => {
      const store = createBaseStore();
      const storeSnapshot = JSON.stringify(store);

      const result = addTask(store, '2026-10-12', {
        name: 'New Task',
        durationMinutes: 45,
      });

      expect(result.ok).toBe(true);
      expect(JSON.stringify(store)).toBe(storeSnapshot);
      expect(result.store.plans['2026-10-12'].tasks.length).toBe(2);
    });

    it('returns original store unchanged on invalid addTask', () => {
      const store = createBaseStore();
      const result = addTask(store, '2026-10-12', {
        name: '',
        durationMinutes: -10,
      });

      expect(result.ok).toBe(false);
      expect(result.store).toBe(store);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Single in_progress rule & Status transitions', () => {
    it('prevents starting a second task if one is already in_progress', () => {
      const store = createBaseStore();
      // Add second task
      const addRes = addTask(store, '2026-10-12', { name: 'Task 2', durationMinutes: 30 });
      const task2Id = addRes.task.id;

      // Start task-1
      const start1 = setTaskStatus(addRes.store, '2026-10-12', 'task-1', 'in_progress');
      expect(start1.ok).toBe(true);

      // Attempt to start task 2 without pauseExisting option
      const start2 = setTaskStatus(start1.store, '2026-10-12', task2Id, 'in_progress');
      expect(start2.ok).toBe(false);
      expect(start2.conflictInProgressTaskId).toBe('task-1');
      expect(start2.errors[0]).toContain('already in progress');

      // With pauseExisting: true, pauses task-1 and starts task 2
      const start2WithPause = setTaskStatus(start1.store, '2026-10-12', task2Id, 'in_progress', {
        pauseExisting: true,
      });
      expect(start2WithPause.ok).toBe(true);
      const plan = start2WithPause.store.plans['2026-10-12'];
      expect(plan.tasks.find((t) => t.id === 'task-1').status).toBe('pending');
      expect(plan.tasks.find((t) => t.id === task2Id).status).toBe('in_progress');
    });

    it('records completedAt and skippedAt timestamps, and clears them on reopen', () => {
      const store = createBaseStore();
      const testIso = '2026-10-12T10:00:00.000Z';

      // Complete
      const completeRes = setTaskStatus(store, '2026-10-12', 'task-1', 'completed', { nowIso: testIso });
      expect(completeRes.ok).toBe(true);
      const completedTask = completeRes.store.plans['2026-10-12'].tasks.find((t) => t.id === 'task-1');
      expect(completedTask.status).toBe('completed');
      expect(completedTask.completedAt).toBe(testIso);

      // Reopen
      const reopenRes = setTaskStatus(completeRes.store, '2026-10-12', 'task-1', 'pending');
      expect(reopenRes.ok).toBe(true);
      const reopenedTask = reopenRes.store.plans['2026-10-12'].tasks.find((t) => t.id === 'task-1');
      expect(reopenedTask.status).toBe('pending');
      expect(reopenedTask.completedAt).toBeNull();
      expect(reopenedTask.skippedAt).toBeNull();
    });

    it('reopen restores original slot if conflict-free, but moves to unscheduled if original slot is now occupied', () => {
      const store = createBaseStore();
      // Complete task-1 (was 08:00 - 09:00)
      const completeRes = setTaskStatus(store, '2026-10-12', 'task-1', 'completed');

      // Another task takes 08:00 - 09:00
      let modifiedStore = completeRes.store;
      modifiedStore.plans['2026-10-12'].schedule.blocks.push({
        id: 'block-new',
        type: 'task',
        taskId: 'task-other',
        start: '08:00',
        end: '09:00',
      });
      modifiedStore.plans['2026-10-12'].tasks.push({
        id: 'task-other',
        date: '2026-10-12',
        name: 'Other Task',
        durationMinutes: 60,
        status: 'pending',
        scheduledStart: '08:00',
        scheduledEnd: '09:00',
      });

      // Now reopen task-1: original slot (08:00-09:00) is occupied
      const reopenConflict = setTaskStatus(modifiedStore, '2026-10-12', 'task-1', 'pending');
      expect(reopenConflict.ok).toBe(true);
      const plan = reopenConflict.store.plans['2026-10-12'];
      const task1 = plan.tasks.find((t) => t.id === 'task-1');
      expect(task1.scheduledStart).toBeNull();
      expect(plan.schedule.unscheduled.some((u) => u.taskId === 'task-1')).toBe(true);
    });
  });

  describe('Overdue detection pure function (isTaskOverdue)', () => {
    it('returns true when current relative time has passed scheduled end on today', () => {
      const plan = {
        date: '2026-10-12',
        wakeTime: '06:00',
        bedTime: '23:00',
      };
      const task = {
        status: 'pending',
        scheduledEnd: '14:00',
      };
      // Fixed "now": 14:30 on same date
      const fixedNow = {
        localDate: '2026-10-12',
        currentTime: '14:30',
      };

      expect(isTaskOverdue(task, plan, fixedNow)).toBe(true);
    });

    it('returns false when task is already completed or skipped', () => {
      const plan = { date: '2026-10-12', wakeTime: '06:00', bedTime: '23:00' };
      const taskCompleted = { status: 'completed', scheduledEnd: '14:00' };
      const taskSkipped = { status: 'skipped', scheduledEnd: '14:00' };
      const fixedNow = { localDate: '2026-10-12', currentTime: '15:00' };

      expect(isTaskOverdue(taskCompleted, plan, fixedNow)).toBe(false);
      expect(isTaskOverdue(taskSkipped, plan, fixedNow)).toBe(false);
    });

    it('returns false when plan date is not today', () => {
      const plan = { date: '2026-10-11', wakeTime: '06:00', bedTime: '23:00' };
      const task = { status: 'pending', scheduledEnd: '14:00' };
      const fixedNow = { localDate: '2026-10-12', currentTime: '15:00' };

      expect(isTaskOverdue(task, plan, fixedNow)).toBe(false);
    });

    it('returns false when current time is earlier than scheduled end', () => {
      const plan = { date: '2026-10-12', wakeTime: '06:00', bedTime: '23:00' };
      const task = { status: 'pending', scheduledEnd: '16:00' };
      const fixedNow = { localDate: '2026-10-12', currentTime: '14:00' };

      expect(isTaskOverdue(task, plan, fixedNow)).toBe(false);
    });
  });

  describe('Move task across dates', () => {
    it('atomically moves a task from one date to another', () => {
      const store = createBaseStore();
      const moveRes = moveTaskToDate(store, '2026-10-12', '2026-10-13', 'task-1');

      expect(moveRes.ok).toBe(true);
      const sourcePlan = moveRes.store.plans['2026-10-12'];
      const targetPlan = moveRes.store.plans['2026-10-13'];

      expect(sourcePlan.tasks.find((t) => t.id === 'task-1')).toBeUndefined();
      expect(sourcePlan.schedule.blocks.find((b) => b.taskId === 'task-1')).toBeUndefined();

      expect(targetPlan).toBeDefined();
      expect(targetPlan.tasks.length).toBe(1);
      expect(targetPlan.tasks[0].name).toBe('Task 1');
      expect(targetPlan.tasks[0].date).toBe('2026-10-13');
      expect(targetPlan.tasks[0].movedFrom).toEqual({ date: '2026-10-12', taskId: 'task-1' });
    });
  });

  describe('Delete task safety', () => {
    it('requires confirmation to delete completed task', () => {
      const store = createBaseStore();
      // Mark completed
      const compStore = setTaskStatus(store, '2026-10-12', 'task-1', 'completed').store;

      const delWithoutConfirm = deleteTask(compStore, '2026-10-12', 'task-1');
      expect(delWithoutConfirm.ok).toBe(false);
      expect(delWithoutConfirm.needsCompletedConfirmation).toBe(true);

      const delWithConfirm = deleteTask(compStore, '2026-10-12', 'task-1', {
        confirmDeleteCompleted: true,
      });
      expect(delWithConfirm.ok).toBe(true);
      expect(delWithConfirm.store.plans['2026-10-12'].tasks.length).toBe(0);
    });
  });

  describe('checkPlanIntegrity', () => {
    it('detects duplicate IDs and orphan blocks', () => {
      const corruptedPlan = {
        date: '2026-10-12',
        tasks: [
          { id: 'dup-1', date: '2026-10-12', name: 'Task A' },
          { id: 'dup-1', date: '2026-10-12', name: 'Task B' },
        ],
        schedule: {
          blocks: [
            { id: 'b-1', type: 'task', taskId: 'orphan-task', start: '08:00', end: '09:00' },
          ],
        },
      };

      const result = checkPlanIntegrity(corruptedPlan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate task ID'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Orphan block'))).toBe(true);
    });

    it('detects overlapping task blocks', () => {
      const plan = {
        date: '2026-10-12',
        tasks: [
          { id: 't1', date: '2026-10-12', name: 'A' },
          { id: 't2', date: '2026-10-12', name: 'B' },
        ],
        schedule: {
          blocks: [
            { id: 'b1', type: 'task', taskId: 't1', start: '09:00', end: '10:00' },
            { id: 'b2', type: 'task', taskId: 't2', start: '09:30', end: '10:30' },
          ],
        },
      };

      const result = checkPlanIntegrity(plan);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Overlapping task blocks'))).toBe(true);
    });
  });
});
