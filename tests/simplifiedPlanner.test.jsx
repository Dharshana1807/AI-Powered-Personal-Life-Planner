import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  loadSavedRoutine,
  saveSavedRoutine,
  hasSavedRoutine,
  getDefaultRoutine,
  loadGoalChecklists,
  saveGoalChecklists,
  addGoalChecklistItem,
  toggleGoalChecklistItem,
  deleteGoalChecklistItem,
} from '../client/src/utils/storage.js';
import { generateSchedule } from '../client/src/utils/scheduler.js';
import GoalTracking from '../client/src/pages/GoalTracking.jsx';
import { PlannerProvider } from '../client/src/context/PlannerContext.jsx';

describe('Simplified Planner - Saved Routine & Daily Plan Reuse', () => {
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

  it('allows users to save a regular routine and loads it automatically', () => {
    expect(hasSavedRoutine()).toBe(false);

    const customRoutine = {
      wakeTime: '06:30',
      bedTime: '22:30',
      workHours: {
        enabled: true,
        start: '09:00',
        end: '15:00',
        label: 'College Lectures',
      },
      meals: [
        { id: 'm1', name: 'Breakfast', start: '07:30', end: '08:00' },
        { id: 'm2', name: 'Lunch', start: '12:30', end: '13:15' },
        { id: 'm3', name: 'Dinner', start: '19:30', end: '20:15' },
      ],
      commitments: [],
    };

    const saveResult = saveSavedRoutine(customRoutine);
    expect(saveResult.success).toBe(true);
    expect(hasSavedRoutine()).toBe(true);

    const loaded = loadSavedRoutine();
    expect(loaded.wakeTime).toBe('06:30');
    expect(loaded.bedTime).toBe('22:30');
    expect(loaded.workHours.label).toBe('College Lectures');
    expect(loaded.workHours.start).toBe('09:00');
    expect(loaded.workHours.end).toBe('15:00');
    expect(loaded.meals.length).toBe(3);
  });

  it('reuses the saved routine when generating a daily plan without asking to re-enter details', () => {
    saveSavedRoutine({
      wakeTime: '06:00',
      bedTime: '23:00',
      workHours: {
        enabled: true,
        start: '08:30',
        end: '14:30',
        label: 'College Classes',
      },
      meals: [
        { id: 'm1', name: 'Lunch', start: '12:00', end: '12:45' },
      ],
      commitments: [],
    });

    const routine = loadSavedRoutine();

    // User only provides their tasks for today
    const dailyTasks = [
      {
        id: 'task-1',
        name: 'Math Problem Set',
        durationMinutes: 60,
        priority: 'High',
      },
    ];

    const planPayload = {
      date: '2026-10-21',
      wakeTime: routine.wakeTime,
      bedTime: routine.bedTime,
      workHours: routine.workHours,
      meals: routine.meals,
      commitments: routine.commitments,
      tasks: dailyTasks,
    };

    const schedule = generateSchedule(planPayload);

    // Verify timetable automatically contains routine blocks
    const workBlock = schedule.scheduledBlocks.find((b) => b.type === 'work');
    expect(workBlock).toBeDefined();
    expect(workBlock.start).toBe('08:30');
    expect(workBlock.end).toBe('14:30');

    // Verify task is scheduled around the routine
    expect(schedule.scheduledTasks.length).toBe(1);
    expect(schedule.scheduledTasks[0].name).toBe('Math Problem Set');
    expect(schedule.scheduledTasks[0].scheduledStart).toBeDefined();
  });

  it('allows flexible tasks during college hours and explains conflicts with alternatives', () => {
    const routine = {
      wakeTime: '07:00',
      bedTime: '23:00',
      workHours: {
        enabled: true,
        start: '09:00',
        end: '17:00',
        label: 'College Classes',
      },
      meals: [],
      commitments: [],
    };

    // Task marked as flexible during college hours
    const flexibleTask = {
      id: 'flex-1',
      name: 'Quick Library Revision',
      durationMinutes: 30,
      preferredTime: '11:00',
      isFlexible: true,
    };

    const planPayload = {
      date: '2026-10-21',
      wakeTime: routine.wakeTime,
      bedTime: routine.bedTime,
      workHours: routine.workHours,
      meals: routine.meals,
      commitments: routine.commitments,
      tasks: [flexibleTask],
    };

    const schedule = generateSchedule(planPayload);
    // Flexible task is placed at preferred time during college hours
    const scheduledTask = schedule.scheduledTasks.find((t) => t.id === 'flex-1');
    expect(scheduledTask).toBeDefined();
    expect(scheduledTask.scheduledStart).toBe('11:00');
  });
});

describe('Simplified Goal Tracking - Four Checklists', () => {
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

  const categories = ['diet', 'fitness', 'career', 'education'];

  categories.forEach((category) => {
    it(`supports title-only task creation, circular completion toggle, delete, and refresh for "${category}"`, () => {
      // 1. Initial state is empty for this category
      let checklists = loadGoalChecklists();
      expect(checklists[category]).toEqual([]);

      // 2. Add task requiring ONLY task title
      const addRes = addGoalChecklistItem(category, `${category} goal item`);
      expect(addRes.success).toBe(true);
      expect(addRes.item.title).toBe(`${category} goal item`);
      expect(addRes.item.completed).toBe(false);
      expect(addRes.item.id).toBeDefined();

      const taskId = addRes.item.id;

      // 3. Verify task is in active list
      checklists = loadGoalChecklists();
      expect(checklists[category].length).toBe(1);
      expect(checklists[category][0].completed).toBe(false);

      // 4. Tick circular checkbox: moves to completed list immediately
      const toggleRes1 = toggleGoalChecklistItem(category, taskId);
      expect(toggleRes1.success).toBe(true);
      expect(toggleRes1.item.completed).toBe(true);
      // ID is preserved
      expect(toggleRes1.item.id).toBe(taskId);

      // Verify persisted state after refresh
      let refreshed = loadGoalChecklists();
      expect(refreshed[category].length).toBe(1);
      expect(refreshed[category][0].completed).toBe(true);

      // 5. Untick circular checkbox: moves back to active list
      const toggleRes2 = toggleGoalChecklistItem(category, taskId);
      expect(toggleRes2.success).toBe(true);
      expect(toggleRes2.item.completed).toBe(false);
      expect(toggleRes2.item.id).toBe(taskId);

      refreshed = loadGoalChecklists();
      expect(refreshed[category][0].completed).toBe(false);

      // 6. Delete task
      const delRes = deleteGoalChecklistItem(category, taskId);
      expect(delRes.success).toBe(true);

      refreshed = loadGoalChecklists();
      expect(refreshed[category].length).toBe(0);
    });
  });

  it('keeps all four categories strictly independent so tasks do not appear in the wrong section', () => {
    addGoalChecklistItem('diet', 'Drink 3L water');
    addGoalChecklistItem('fitness', 'Morning 5km run');
    addGoalChecklistItem('career', 'Revise resume');
    addGoalChecklistItem('education', 'Read chapter 5');

    const checklists = loadGoalChecklists();

    expect(checklists.diet.map((t) => t.title)).toEqual(['Drink 3L water']);
    expect(checklists.fitness.map((t) => t.title)).toEqual(['Morning 5km run']);
    expect(checklists.career.map((t) => t.title)).toEqual(['Revise resume']);
    expect(checklists.education.map((t) => t.title)).toEqual(['Read chapter 5']);

    // Completing fitness does not alter diet, career, or education
    const fitnessId = checklists.fitness[0].id;
    toggleGoalChecklistItem('fitness', fitnessId);

    const updated = loadGoalChecklists();
    expect(updated.fitness[0].completed).toBe(true);
    expect(updated.diet[0].completed).toBe(false);
    expect(updated.career[0].completed).toBe(false);
    expect(updated.education[0].completed).toBe(false);
  });

  it('renders GoalTracking UI with category tabs, title-only input, and circular checkboxes', () => {
    addGoalChecklistItem('diet', 'Eat 2 servings of vegetables');

    const html = renderToString(
      React.createElement(
        PlannerProvider,
        null,
        React.createElement(GoalTracking, { activeSubTab: 'diet' })
      )
    );

    // Tab buttons
    expect(html).toContain('Diet');
    expect(html).toContain('Fitness');
    expect(html).toContain('Career');
    expect(html).toContain('Education');

    // Title only input
    expect(html).toContain('id="goal-task-input"');
    expect(html).toContain('+ Add Task');

    // Rendered task with circular checkbox
    expect(html).toContain('Eat 2 servings of vegetables');
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="false"');
  });
});
