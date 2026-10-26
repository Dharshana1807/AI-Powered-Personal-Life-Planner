import { describe, it, expect } from 'vitest';
import { generateSchedule, toRelativeMinutes, fromRelativeMinutes, calculateFreeWindows } from '../client/src/utils/scheduler.js';

describe('Deterministic Scheduler Engine', () => {
  const basePlan = {
    date: '2026-10-12',
    userType: 'student',
    wakeTime: '06:00',
    bedTime: '23:00',
    workHours: null,
    travelMinutes: 0,
    meals: [
      { id: 'meal-1', name: 'Breakfast', start: '07:30', end: '08:00' },
      { id: 'meal-2', name: 'Lunch', start: '13:00', end: '13:45' },
      { id: 'meal-3', name: 'Dinner', start: '20:00', end: '20:45' },
    ],
    commitments: [],
    freeSlots: [],
    tasks: [],
  };

  it('schedules tasks cleanly in a normal day without overlaps', () => {
    const plan = {
      ...basePlan,
      tasks: [
        { id: 't1', name: 'Task A', durationMinutes: 60, priority: 'High', status: 'pending' },
        { id: 't2', name: 'Task B', durationMinutes: 45, priority: 'Medium', status: 'pending' },
      ],
    };

    const result = generateSchedule(plan);

    expect(result.scheduledTasks.length).toBe(2);
    expect(result.unscheduledTasks.length).toBe(0);

    const task1 = result.scheduledTasks.find((t) => t.id === 't1');
    const task2 = result.scheduledTasks.find((t) => t.id === 't2');

    expect(task1.scheduledStart).toBe('06:00');
    expect(task1.scheduledEnd).toBe('07:00');

    // After breakfast (07:30 - 08:00) or during free slot:
    // Notice Task A is 60m (06:00-07:00). A 10m break can fit in 07:00-07:10.
    // Breakfast starts at 07:30. Task B is 45m: cannot fit in 07:00-07:30 (only 30m free).
    // So Task B is placed right after breakfast at 08:00!
    expect(task2.scheduledStart).toBe('08:00');
    expect(task2.scheduledEnd).toBe('08:45');
  });

  it('handles overnight bedtimes and schedules tasks after midnight', () => {
    const overnightPlan = {
      ...basePlan,
      wakeTime: '06:00',
      bedTime: '01:00', // Next day morning (19 hours total)
      tasks: [
        {
          id: 'night-owl',
          name: 'Midnight Study',
          durationMinutes: 30,
          preferredTime: '00:15',
          priority: 'High',
          status: 'pending',
        },
      ],
    };

    const result = generateSchedule(overnightPlan);
    expect(result.scheduledTasks.length).toBe(1);
    const nightTask = result.scheduledTasks[0];
    expect(nightTask.scheduledStart).toBe('00:15');
    expect(nightTask.scheduledEnd).toBe('00:45');
  });

  it('places a task at preferredTime when the slot is available', () => {
    const plan = {
      ...basePlan,
      tasks: [
        {
          id: 'pref-task',
          name: 'Workout',
          durationMinutes: 45,
          preferredTime: '16:00',
          priority: 'Medium',
          status: 'pending',
        },
      ],
    };

    const result = generateSchedule(plan);
    const task = result.scheduledTasks.find((t) => t.id === 'pref-task');
    expect(task.scheduledStart).toBe('16:00');
    expect(task.scheduledEnd).toBe('16:45');
  });

  it('falls back to earliest available window when preferredTime is unavailable', () => {
    const plan = {
      ...basePlan,
      commitments: [{ id: 'comm-1', name: 'Busy Call', start: '15:30', end: '16:30' }],
      tasks: [
        {
          id: 'conflict-pref',
          name: 'Workout',
          durationMinutes: 45,
          preferredTime: '16:00', // Collides with Busy Call
          priority: 'Medium',
          status: 'pending',
        },
      ],
    };

    const result = generateSchedule(plan);
    const task = result.scheduledTasks.find((t) => t.id === 'conflict-pref');
    expect(task.scheduledStart).not.toBe('16:00');
    expect(result.warnings.some((w) => w.includes('Could not use preferred time'))).toBe(true);
  });

  it('respects same-day deadlines and places urgent tasks first', () => {
    const plan = {
      ...basePlan,
      tasks: [
        { id: 'low-task', name: 'Low Priority No Deadline', durationMinutes: 60, priority: 'Low', status: 'pending' },
        { id: 'urgent-task', name: 'Due at 10 AM', durationMinutes: 60, priority: 'Medium', deadlineTime: '10:00', status: 'pending' },
      ],
    };

    const result = generateSchedule(plan);
    const urgent = result.scheduledTasks.find((t) => t.id === 'urgent-task');
    expect(urgent.scheduledStart).toBe('06:00');
    expect(urgent.scheduledEnd).toBe('07:00');
  });

  it('sends task to unscheduledTasks when deadline cannot be met', () => {
    const plan = {
      ...basePlan,
      commitments: [{ id: 'meeting', name: 'Morning Meeting', start: '06:00', end: '08:30' }],
      tasks: [
        {
          id: 'impossible-deadline',
          name: 'Assignment',
          durationMinutes: 60,
          deadlineTime: '07:00', // Impossible because morning meeting blocks 06:00-08:30
          priority: 'High',
          status: 'pending',
        },
      ],
    };

    const result = generateSchedule(plan);
    expect(result.unscheduledTasks.length).toBe(1);
    expect(result.unscheduledTasks[0].reason).toContain('Cannot finish before deadline');
  });

  it('places High priority tasks before Low priority tasks', () => {
    const plan = {
      ...basePlan,
      tasks: [
        { id: 'low-p', name: 'Low Task', durationMinutes: 60, priority: 'Low', status: 'pending' },
        { id: 'high-p', name: 'High Task', durationMinutes: 60, priority: 'High', status: 'pending' },
      ],
    };

    const result = generateSchedule(plan);
    const highTask = result.scheduledTasks.find((t) => t.id === 'high-p');
    const lowTask = result.scheduledTasks.find((t) => t.id === 'low-p');

    // High priority must be scheduled earlier
    expect(highTask.scheduledStart).toBe('06:00');
    expect(lowTask.scheduledStart).not.toBe('06:00');
  });

  it('handles overfilled days gracefully without forcing overlaps', () => {
    // Only 2 hours free (06:00 to 08:00) before a long meeting
    const plan = {
      ...basePlan,
      meals: [],
      commitments: [{ id: 'block-all', name: 'Full Day Event', start: '08:00', end: '23:00' }],
      tasks: [
        { id: 't1', name: 'Fits', durationMinutes: 60, priority: 'High', status: 'pending' },
        { id: 't2', name: 'Also Fits', durationMinutes: 60, priority: 'High', status: 'pending' },
        { id: 't3', name: 'Does Not Fit', durationMinutes: 60, priority: 'High', status: 'pending' },
      ],
    };

    const result = generateSchedule(plan);
    expect(result.scheduledTasks.length).toBe(2);
    expect(result.unscheduledTasks.length).toBe(1);
    expect(result.unscheduledTasks[0].taskId).toBe('t3');
  });

  it('inserts breaks into leftover time without pushing tasks out', () => {
    // 06:00 - 08:00 is free (120 mins). Task A is 60m (06:00-07:00). Task B is 50m (07:00-07:50).
    // Break for Task A is 10m. Task B must be placed FIRST (07:00-07:50).
    // Then break is inserted into leftover time if available. A break must never cause a task to move!
    const plan = {
      ...basePlan,
      meals: [],
      commitments: [{ id: 'comm-1', name: 'Block', start: '08:00', end: '23:00' }],
      tasks: [
        { id: 't1', name: 'Long Task 60m', durationMinutes: 60, priority: 'High', status: 'pending' },
        { id: 't2', name: 'Task 50m', durationMinutes: 50, priority: 'High', status: 'pending' },
      ],
    };

    const result = generateSchedule(plan);
    // Both tasks must fit!
    expect(result.scheduledTasks.length).toBe(2);
    expect(result.unscheduledTasks.length).toBe(0);
  });

  it('ensures determinism: identical input produces identical output', () => {
    const plan = {
      ...basePlan,
      tasks: [
        { id: 't1', name: 'Alpha', durationMinutes: 45, priority: 'High', status: 'pending' },
        { id: 't2', name: 'Beta', durationMinutes: 30, priority: 'Medium', status: 'pending' },
        { id: 't3', name: 'Gamma', durationMinutes: 60, priority: 'Low', status: 'pending' },
      ],
    };

    const run1 = generateSchedule(plan);
    const run2 = generateSchedule(plan);

    expect(run1.scheduledTasks).toEqual(run2.scheduledTasks);
    expect(run1.unscheduledTasks).toEqual(run2.unscheduledTasks);
  });

  it('locks completed, skipped, and in_progress tasks during regeneration', () => {
    const plan = {
      ...basePlan,
      tasks: [
        {
          id: 'locked-done',
          name: 'Already Completed',
          durationMinutes: 60,
          scheduledStart: '10:00',
          scheduledEnd: '11:00',
          priority: 'Low',
          status: 'completed',
        },
        {
          id: 'new-high',
          name: 'Urgent High Task',
          durationMinutes: 60,
          priority: 'High',
          status: 'pending',
        },
      ],
    };

    const result = generateSchedule(plan, { isRegeneration: true });
    const completedTask = result.scheduledTasks.find((t) => t.id === 'locked-done');
    expect(completedTask.scheduledStart).toBe('10:00');
    expect(completedTask.scheduledEnd).toBe('11:00');
  });

  it('verifies single source of truth: task blocks store only { id, type: "task", taskId, start, end }', () => {
    const plan = {
      ...basePlan,
      tasks: [
        { id: 'sample-task', name: 'Read Book', category: 'Personal', durationMinutes: 30, priority: 'Medium', status: 'pending' },
      ],
    };

    const result = generateSchedule(plan);
    const taskBlock = result.scheduledBlocks.find((b) => b.type === 'task');

    expect(taskBlock).toBeDefined();
    expect(taskBlock.taskId).toBe('sample-task');
    expect(taskBlock.start).toBeDefined();
    expect(taskBlock.end).toBeDefined();
    // Must NOT duplicate name, priority, or status on the block
    expect(taskBlock.title).toBeUndefined();
    expect(taskBlock.name).toBeUndefined();
    expect(taskBlock.priority).toBeUndefined();
    expect(taskBlock.status).toBeUndefined();
  });

  describe('FIX PASS Tests', () => {
    // 1. Sleep rendering: test bed 21:00, 23:00, 00:30, and 01:00 with wake 06:00 and 07:00
    const wakeBedPairs = [
      { wake: '06:00', bed: '21:00', isOvernight: false },
      { wake: '07:00', bed: '21:00', isOvernight: false },
      { wake: '06:00', bed: '23:00', isOvernight: false },
      { wake: '07:00', bed: '23:00', isOvernight: false },
      { wake: '06:00', bed: '00:30', isOvernight: true },
      { wake: '07:00', bed: '00:30', isOvernight: true },
      { wake: '06:00', bed: '01:00', isOvernight: true },
      { wake: '07:00', bed: '01:00', isOvernight: true },
    ];

    wakeBedPairs.forEach(({ wake, bed, isOvernight }) => {
      it(`renders non-overlapping sleep with wake ${wake} and bed ${bed}`, () => {
        const plan = {
          date: '2026-10-12',
          wakeTime: wake,
          bedTime: bed,
          tasks: [{ id: 't1', name: 'Task', durationMinutes: 60, status: 'pending' }],
        };

        const result = generateSchedule(plan);
        const sleepBlocks = result.scheduledBlocks.filter((b) => b.type === 'sleep');

        if (isOvernight) {
          // Exactly single part: bedtime to wake time
          expect(sleepBlocks.length).toBe(1);
          expect(sleepBlocks[0].start).toBe(bed);
          expect(sleepBlocks[0].end).toBe(wake);
        } else {
          // Exactly two non-overlapping parts: midnight to wake, and bedtime to midnight (24:00)
          expect(sleepBlocks.length).toBe(2);
          const morningSleep = sleepBlocks.find((b) => b.id.includes('morning'));
          const nightSleep = sleepBlocks.find((b) => b.id.includes('night'));

          expect(morningSleep).toBeDefined();
          expect(morningSleep.start).toBe('00:00');
          expect(morningSleep.end).toBe(wake);

          expect(nightSleep).toBeDefined();
          expect(nightSleep.start).toBe(bed);
          expect(nightSleep.end).toBe('24:00');
        }

        // Assert NO two blocks overlap anywhere on the timeline
        const wakeMin = Number(wake.split(':')[0]) * 60 + Number(wake.split(':')[1]);
        let bedMin = Number(bed.split(':')[0]) * 60 + Number(bed.split(':')[1]);
        if (bedMin <= wakeMin) bedMin += 1440;

        for (let i = 0; i < result.scheduledBlocks.length; i++) {
          const bA = result.scheduledBlocks[i];
          const sA_clock = Number(bA.start.split(':')[0]) * 60 + Number(bA.start.split(':')[1]);
          const eA_clock = bA.end === '24:00' ? 1440 : Number(bA.end.split(':')[0]) * 60 + Number(bA.end.split(':')[1]);
          expect(eA_clock).toBeGreaterThan(sA_clock); // Clock end is strictly after clock start

          const sA = toRelativeMinutes(bA.start, wakeMin, bedMin);
          const eA = bA.end === '24:00' ? 1440 - wakeMin : (isOvernight && bA.type === 'sleep' ? 1440 : toRelativeMinutes(bA.end, wakeMin, bedMin));

          for (let j = i + 1; j < result.scheduledBlocks.length; j++) {
            const bB = result.scheduledBlocks[j];
            const sB = toRelativeMinutes(bB.start, wakeMin, bedMin);
            const eB = bB.end === '24:00' ? 1440 - wakeMin : (isOvernight && bB.type === 'sleep' ? 1440 : toRelativeMinutes(bB.end, wakeMin, bedMin));

            const overlaps = Math.max(sA, sB) < Math.min(eA, eB);
            expect(overlaps).toBe(false);
          }
        }
      });
    });

    // 2. Travel time: test travelMinutes = 30 giving 08:30-09:00 and 17:00-17:30 for work 09:00-17:00
    it('schedules travelMinutes = 30 giving 08:30-09:00 and 17:00-17:30 for work 09:00-17:00', () => {
      const plan = {
        date: '2026-10-12',
        wakeTime: '07:00',
        bedTime: '23:00',
        workHours: { start: '09:00', end: '17:00' },
        travelMinutes: 30,
        tasks: [{ id: 't1', name: 'Task', durationMinutes: 30, status: 'pending' }],
      };

      const result = generateSchedule(plan);

      const travelBefore = result.scheduledBlocks.find((b) => b.type === 'travel' && b.id.includes('before'));
      const workBlock = result.scheduledBlocks.find((b) => b.type === 'work');
      const travelAfter = result.scheduledBlocks.find((b) => b.type === 'travel' && b.id.includes('after'));

      expect(travelBefore).toBeDefined();
      expect(travelBefore.start).toBe('08:30');
      expect(travelBefore.end).toBe('09:00');

      expect(workBlock).toBeDefined();
      expect(workBlock.start).toBe('09:00');
      expect(workBlock.end).toBe('17:00');

      expect(travelAfter).toBeDefined();
      expect(travelAfter.start).toBe('17:00');
      expect(travelAfter.end).toBe('17:30');
    });

    // 3. Generate must require at least one task
    it('requires at least one task to generate a plan and returns clear error', () => {
      const plan = {
        date: '2026-10-12',
        wakeTime: '07:00',
        bedTime: '23:00',
        tasks: [],
      };

      const result = generateSchedule(plan);
      expect(result.scheduledBlocks).toEqual([]);
      expect(result.warnings).toContain('Add at least one task to generate a plan.');
    });

    // 5. calculateFreeWindows helper test
    it('calculates available free windows between fixed items accurately', () => {
      const plan = {
        date: '2026-10-12',
        wakeTime: '07:00',
        bedTime: '23:00',
        workHours: { start: '09:00', end: '17:00' },
        travelMinutes: 0,
        tasks: [],
      };

      const free = calculateFreeWindows(plan);
      expect(free.length).toBeGreaterThan(0);
      const morningFree = free.find((f) => f.start === '07:00');
      expect(morningFree).toBeDefined();
      expect(morningFree.end).toBe('09:00');
      expect(morningFree.durationMinutes).toBe(120);
      expect(morningFree.title).toBe('Free: 07:00 - 09:00 (120 min)');
    });
  });
});
