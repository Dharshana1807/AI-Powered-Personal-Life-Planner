import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAgainstFixedCommitments,
  findAvailableFreeSlots,
  buildProposalChangesSummary,
  processChatRequest,
} from '../server/chatService.js';
import {
  savePlanForDate,
  getPlanForDate,
  loadStoredState,
} from '../client/src/utils/storage.js';
import { generateSchedule } from '../client/src/utils/scheduler.js';
import { extractTimeFromText } from '../client/src/utils/dateUtils.js';

describe('Chatbot Intent Detection, Conflict Validation & Schedule Adaptation', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    global.window = {
      localStorage: {
        getItem: (k) => mockStore[k] || null,
        setItem: (k, v) => {
          mockStore[k] = String(v);
        },
        removeItem: (k) => {
          delete mockStore[k];
        },
        clear: () => {
          mockStore = {};
        },
      },
    };
  });

  const basePlan = {
    date: '2026-10-20',
    userType: 'student',
    wakeTime: '07:00',
    bedTime: '23:00',
    workHours: {
      start: '09:00',
      end: '17:00',
      label: 'College / Classes',
    },
    travelMinutes: 0,
    meals: [
      { id: 'm1', name: 'Breakfast', start: '08:00', end: '08:30' },
      { id: 'm2', name: 'Lunch', start: '13:00', end: '13:45' },
      { id: 'm3', name: 'Dinner', start: '20:00', end: '20:45' },
    ],
    commitments: [],
    tasks: [
      {
        id: 't-completed',
        name: 'Morning Reading',
        durationMinutes: 30,
        status: 'completed',
        scheduledStart: '07:30',
        scheduledEnd: '08:00',
        completedAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 't-pending',
        name: 'DSA Practice',
        durationMinutes: 60,
        status: 'pending',
        scheduledStart: '17:30',
        scheduledEnd: '18:30',
      },
    ],
  };

  describe('Deterministic Conflict Validation Engine', () => {
    it('detects and rejects overlap with fixed College / Work hours', () => {
      // 10:00 - 11:30 is during 09:00 - 17:00 College
      const check = validateAgainstFixedCommitments('10:00', '11:30', basePlan);
      expect(check.hasConflict).toBe(true);
      expect(check.message).toContain('College / Classes');
      expect(check.message).toContain('09:00');
    });

    it('detects and rejects overlap with Sleep hours / outside waking bounds', () => {
      // 02:00 - 03:00 is during 23:00 - 07:00 sleep
      const check = validateAgainstFixedCommitments('02:00', '03:00', basePlan);
      expect(check.hasConflict).toBe(true);
      expect(check.message).toContain('waking hours');
    });

    it('detects and rejects overlap with fixed Meals', () => {
      // 20:15 - 20:45 is during 20:00 - 20:45 Dinner (outside college hours)
      const check = validateAgainstFixedCommitments('20:15', '20:45', basePlan);
      expect(check.hasConflict).toBe(true);
      expect(check.message).toContain('Dinner');
    });

    it('detects and rejects overlap with locked completed tasks', () => {
      // 07:35 - 07:55 overlaps Morning Reading (07:30 - 08:00) before Breakfast (08:00)
      const check = validateAgainstFixedCommitments('07:35', '07:55', basePlan);
      expect(check.hasConflict).toBe(true);
      expect(check.message).toContain('Morning Reading');
    });

    it('approves conflict-free free slots', () => {
      // 18:45 - 19:45 is free of college, meals, sleep, and completed tasks
      const check = validateAgainstFixedCommitments('18:45', '19:45', basePlan);
      expect(check.hasConflict).toBe(false);
    });

    it('finds valid free slots after a reference time avoiding all fixed blocks', () => {
      const freeSlots = findAvailableFreeSlots(basePlan, '17:00', 45);
      expect(freeSlots.length).toBeGreaterThan(0);
      // All returned free slots must be at or after 17:00
      freeSlots.forEach((slot) => {
        expect(slot.start >= '17:00').toBe(true);
      });
    });
  });

  describe('Proposal Changes Summary Diffing', () => {
    it('accurately categorizes moved, added, unchanged, and unscheduled tasks', () => {
      const oldTasks = [
        { id: '1', name: 'Task A', scheduledStart: '10:00', scheduledEnd: '11:00' },
        { id: '2', name: 'Task B', scheduledStart: '14:00', scheduledEnd: '15:00' },
      ];
      const newTasks = [
        { id: '1', name: 'Task A', scheduledStart: '10:00', scheduledEnd: '11:00' }, // unchanged
        { id: '2', name: 'Task B', scheduledStart: '16:00', scheduledEnd: '17:00' }, // moved
        { id: '3', name: 'Task C', scheduledStart: '18:00', scheduledEnd: '19:00' }, // added
      ];
      const unscheduled = [
        { taskId: '4', name: 'Task D', reason: 'Not enough free time' },
      ];

      const summary = buildProposalChangesSummary(oldTasks, newTasks, unscheduled);
      expect(summary.unchanged.length).toBe(1);
      expect(summary.unchanged[0].id).toBe('1');
      expect(summary.moved.length).toBe(1);
      expect(summary.moved[0].oldStart).toBe('14:00');
      expect(summary.moved[0].newStart).toBe('16:00');
      expect(summary.added.length).toBe(1);
      expect(summary.added[0].task.id).toBe('3');
      expect(summary.unscheduled.length).toBe(1);
    });
  });

  describe('Plan Regeneration & Completed Task Preservation', () => {
    it('strictly preserves completed task times and statuses when regenerating a schedule', () => {
      const planWithCompleted = {
        ...basePlan,
        tasks: [
          {
            id: 'task-comp-1',
            name: 'Completed Workout',
            durationMinutes: 45,
            status: 'completed',
            scheduledStart: '07:00',
            scheduledEnd: '07:45',
            completedAt: '2026-10-20T07:45:00Z',
          },
          {
            id: 'task-comp-2',
            name: 'Completed Breakfast',
            durationMinutes: 30,
            status: 'completed',
            scheduledStart: '07:45',
            scheduledEnd: '08:15',
            completedAt: '2026-10-20T08:15:00Z',
          },
          {
            id: 'task-pend-1',
            name: 'Study Operating Systems',
            durationMinutes: 60,
            status: 'pending',
            scheduledStart: null,
            scheduledEnd: null,
          },
        ],
      };

      const result = generateSchedule(planWithCompleted, { isRegeneration: true });

      // Completed tasks must be present in scheduledTasks with EXACT same times
      const c1 = result.scheduledTasks.find((t) => t.id === 'task-comp-1');
      const c2 = result.scheduledTasks.find((t) => t.id === 'task-comp-2');
      expect(c1).toBeDefined();
      expect(c1.status).toBe('completed');
      expect(c1.scheduledStart).toBe('07:00');
      expect(c1.scheduledEnd).toBe('07:45');

      expect(c2).toBeDefined();
      expect(c2.status).toBe('completed');
      expect(c2.scheduledStart).toBe('07:45');
      expect(c2.scheduledEnd).toBe('08:15');

      // Pending task should be scheduled in an available slot outside college hours (after 17:00)
      const p1 = result.scheduledTasks.find((t) => t.id === 'task-pend-1');
      expect(p1).toBeDefined();
      expect(p1.scheduledStart).toBeDefined();
      expect(p1.scheduledStart >= '17:00').toBe(true);
    });
  });

  describe('Apply and Cancel Workflow', () => {
    it('applies a proposed plan, updating the stored plan and timetable immediately', () => {
      const initialPlan = {
        date: '2026-10-20',
        tasks: [{ id: 't1', name: 'Original Task', scheduledStart: '18:00', scheduledEnd: '19:00', status: 'pending' }],
        status: 'scheduled',
      };
      savePlanForDate('2026-10-20', initialPlan);

      expect(getPlanForDate('2026-10-20').tasks[0].name).toBe('Original Task');

      // Simulate applying an AI proposal
      const proposal = {
        date: '2026-10-20',
        tasks: [
          { id: 't1', name: 'Original Task (Moved)', scheduledStart: '19:00', scheduledEnd: '20:00', status: 'rescheduled' },
          { id: 't2', name: 'New Evening Walk', scheduledStart: '20:00', scheduledEnd: '20:30', status: 'pending' },
        ],
        status: 'scheduled',
      };

      savePlanForDate('2026-10-20', {
        ...getPlanForDate('2026-10-20'),
        tasks: proposal.tasks,
        status: 'scheduled',
      });

      const updated = getPlanForDate('2026-10-20');
      expect(updated.tasks.length).toBe(2);
      expect(updated.tasks[0].name).toBe('Original Task (Moved)');
      expect(updated.tasks[0].scheduledStart).toBe('19:00');
      expect(updated.tasks[1].name).toBe('New Evening Walk');
    });

    it('cancelling a proposal leaves the original schedule completely intact', () => {
      const originalPlan = {
        date: '2026-10-20',
        tasks: [{ id: 't1', name: 'Important Lecture', scheduledStart: '10:00', scheduledEnd: '11:00', status: 'pending' }],
        status: 'scheduled',
      };
      savePlanForDate('2026-10-20', originalPlan);

      // Dismissal action: does NOT call savePlanForDate
      const current = getPlanForDate('2026-10-20');
      expect(current.tasks.length).toBe(1);
      expect(current.tasks[0].name).toBe('Important Lecture');
      expect(current.tasks[0].scheduledStart).toBe('10:00');
    });
  });

  describe('Natural Language Chat Time Parsing', () => {
    it('correctly parses user requests like "Move English practice to 5 PM", "5pm", "17:00", and "5:30 in the evening"', () => {
      const t1 = extractTimeFromText('Move English practice to 5 PM');
      expect(t1).toBe('17:00');

      const t2 = extractTimeFromText('Move English practice to 5pm');
      expect(t2).toBe('17:00');

      const t3 = extractTimeFromText('Move English practice to 17:00');
      expect(t3).toBe('17:00');

      const t4 = extractTimeFromText('Move English practice to 5:30 in the evening');
      expect(t4).toBe('17:30');

      const t5 = extractTimeFromText('Wake me up at 6 in the morning');
      expect(t5).toBe('06:00');

      const t6 = extractTimeFromText('Schedule lunch at noon');
      expect(t6).toBe('12:00');

      const t7 = extractTimeFromText('Set bedtime at midnight');
      expect(t7).toBe('00:00');
    });
  });
});
