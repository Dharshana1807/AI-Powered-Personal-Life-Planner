import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateData,
  createInitialState,
  CURRENT_SCHEMA_VERSION,
  STORAGE_KEY,
} from '../client/src/utils/storage.js';
import { checkPlanIntegrity } from '../client/src/utils/taskOperations.js';

describe('Storage & Migration Utility Tests', () => {
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

  it('creates an empty initial state with schemaVersion 3', () => {
    const state = createInitialState();
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.schemaVersion).toBe(3);
    expect(state.plans).toEqual({});
  });

  it('migrates schemaVersion 1 data to schemaVersion 3 with no data loss, filling task.date from plan.date', () => {
    const v1Data = {
      schemaVersion: 1,
      plans: {
        '2026-10-12': {
          date: '2026-10-12',
          userType: 'student',
          wakeTime: '06:00',
          bedTime: '23:00',
          tasks: [
            {
              id: 'task-v1-1',
              // Notice: no date in v1
              name: 'Study Physics',
              category: 'Education',
              durationMinutes: 45,
              priority: 'High',
              status: 'pending',
              notes: 'Read chapter 4',
            },
            {
              id: 'task-v1-2',
              name: 'Workout',
              category: 'Fitness',
              durationMinutes: 60,
              priority: 'Medium',
              status: 'completed',
            },
          ],
        },
      },
    };

    const migrated = migrateData(v1Data);

    expect(migrated.schemaVersion).toBe(3);
    const plan = migrated.plans['2026-10-12'];
    expect(plan).toBeDefined();
    expect(plan.date).toBe('2026-10-12');
    expect(plan.tasks.length).toBe(2);

    // Verify task.date was filled from plan.date
    expect(plan.tasks[0].date).toBe('2026-10-12');
    expect(plan.tasks[0].name).toBe('Study Physics');
    expect(plan.tasks[0].notes).toBe('Read chapter 4');
    expect(plan.tasks[0].priority).toBe('High');
    expect(plan.tasks[0].deadlineDate).toBeNull();
    expect(plan.tasks[0].deadlineTime).toBeNull();

    expect(plan.tasks[1].date).toBe('2026-10-12');
    expect(plan.tasks[1].status).toBe('completed');

    // Integrity check reports valid with 0 errors
    const integrity = checkPlanIntegrity(plan);
    expect(integrity.valid).toBe(true);
    expect(integrity.errors).toEqual([]);
  });

  it('migrates schemaVersion 2 data to schemaVersion 3 safely with blocks and tasks intact', () => {
    const v2Data = {
      schemaVersion: 2,
      plans: {
        '2026-10-15': {
          date: '2026-10-15',
          userType: 'both',
          wakeTime: '07:00',
          bedTime: '23:00',
          tasks: [
            {
              id: 'task-v2-1',
              name: 'Math Homework',
              durationMinutes: 60,
              priority: 'High',
              category: 'Education',
              status: 'pending',
              scheduledStart: '08:00',
              scheduledEnd: '09:00',
              deadlineDate: '2026-10-15',
              deadlineTime: '18:00',
            },
          ],
          schedule: {
            blocks: [
              {
                id: 'block-1',
                type: 'task',
                taskId: 'task-v2-1',
                start: '08:00',
                end: '09:00',
              },
            ],
            unscheduled: [],
          },
        },
      },
    };

    const migrated = migrateData(v2Data);

    expect(migrated.schemaVersion).toBe(3);
    const plan = migrated.plans['2026-10-15'];
    expect(plan).toBeDefined();
    expect(plan.tasks[0].date).toBe('2026-10-15');
    expect(plan.tasks[0].scheduledStart).toBe('08:00');
    expect(plan.tasks[0].deadlineTime).toBe('18:00');
    expect(plan.schedule.blocks.length).toBe(1);

    const integrity = checkPlanIntegrity(plan);
    expect(integrity.valid).toBe(true);
    expect(integrity.errors).toEqual([]);
  });

  it('handles null, undefined, and corrupt inputs safely', () => {
    expect(migrateData(null).plans).toEqual({});
    expect(migrateData(undefined).plans).toEqual({});
    expect(migrateData('not an object').plans).toEqual({});
  });

  it('ensures separate dates are independent and isolated', () => {
    const state = createInitialState();
    state.plans['2026-10-12'] = {
      date: '2026-10-12',
      userType: 'student',
      wakeTime: '06:00',
    };
    state.plans['2026-10-13'] = {
      date: '2026-10-13',
      userType: 'professional',
      wakeTime: '08:00',
    };

    // Modifying date A does not affect date B
    state.plans['2026-10-12'].wakeTime = '07:00';
    expect(state.plans['2026-10-13'].wakeTime).toBe('08:00');
    expect(state.plans['2026-10-12'].userType).toBe('student');
    expect(state.plans['2026-10-13'].userType).toBe('professional');
  });

  describe('Journal Storage Tests', () => {
    it('saves and loads journal entries in newest-first order', async () => {
      const {
        loadJournalEntries,
        saveJournalEntries,
        getJournalEntryByDate,
        deleteJournalEntry,
      } = await import('../client/src/utils/storage.js');

      expect(loadJournalEntries()).toEqual([]);

      const entry1 = {
        id: 'j1',
        date: '2026-10-18',
        title: 'Sunday Reflection',
        content: 'Felt very energized.',
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      };

      const entry2 = {
        id: 'j2',
        date: '2026-10-20',
        title: 'Tuesday Milestone',
        content: 'Finished AI Planner feature.',
        createdAt: '2026-10-20T12:00:00Z',
        updatedAt: '2026-10-20T12:00:00Z',
      };

      const res = saveJournalEntries([entry1, entry2]);
      expect(res.success).toBe(true);

      const loaded = loadJournalEntries();
      expect(loaded.length).toBe(2);
      // Newest date first
      expect(loaded[0].date).toBe('2026-10-20');
      expect(loaded[1].date).toBe('2026-10-18');

      // Find by date
      const found = getJournalEntryByDate('2026-10-20');
      expect(found).toBeDefined();
      expect(found.title).toBe('Tuesday Milestone');

      // Delete by ID
      const delRes = deleteJournalEntry('j1');
      expect(delRes.success).toBe(true);

      const remaining = loadJournalEntries();
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('j2');
    });
  });
});

