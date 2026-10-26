import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Timetable from '../client/src/components/dashboard/Timetable.jsx';

describe('Timetable Component - Past Dates and History Rules', () => {
  const fixedNow = {
    localDate: '2026-10-12',
    currentTime: '15:00',
  };

  it('renders overdue uncompleted tasks on past dates as read-only history with ONLY Skip and Move available', () => {
    const pastPlan = {
      date: '2026-10-10', // Past date relative to 2026-10-12
      wakeTime: '06:00',
      bedTime: '23:00',
      tasks: [
        {
          id: 'past-task-1',
          date: '2026-10-10',
          name: 'Old Math Homework',
          category: 'Education',
          durationMinutes: 60,
          priority: 'High',
          status: 'pending',
          scheduledStart: '10:00',
          scheduledEnd: '11:00',
        },
      ],
      schedule: {
        blocks: [
          {
            id: 'block-past-1',
            type: 'task',
            taskId: 'past-task-1',
            start: '10:00',
            end: '11:00',
          },
        ],
        unscheduled: [],
      },
    };

    const html = renderToString(
      React.createElement(Timetable, {
        plan: pastPlan,
        now: fixedNow,
        onUpdateTaskStatus: () => {},
        onRescheduleTask: () => {},
        onEditTaskDetails: () => {},
        onDeleteTask: () => {},
        onMoveTaskToDate: () => {},
        onOpenMissedModal: () => {},
      })
    );

    // Assert Past Date indicator and badge are present
    expect(html).toContain('Past Date (Read-Only History)');
    expect(html).toContain('Past Due (History)');

    // ONLY "Skip" and "Move to another day" are available
    expect(html).toContain('Skip');
    expect(html).toContain('Move to another day');

    // Action buttons that modify current execution must NOT be present
    expect(html).not.toContain('▶ Start');
    expect(html).not.toContain('✓ Complete');
    expect(html).not.toContain('⏱ Move');
  });

  it('renders full task action controls on today when plan date is current', () => {
    const todayPlan = {
      date: '2026-10-12', // Today
      wakeTime: '06:00',
      bedTime: '23:00',
      tasks: [
        {
          id: 'today-task-1',
          date: '2026-10-12',
          name: 'Chemistry Lab',
          category: 'Education',
          durationMinutes: 45,
          priority: 'High',
          status: 'pending',
          scheduledStart: '16:00',
          scheduledEnd: '16:45',
        },
      ],
      schedule: {
        blocks: [
          {
            id: 'block-today-1',
            type: 'task',
            taskId: 'today-task-1',
            start: '16:00',
            end: '16:45',
          },
        ],
        unscheduled: [],
      },
    };

    const html = renderToString(
      React.createElement(Timetable, {
        plan: todayPlan,
        now: fixedNow,
        onUpdateTaskStatus: () => {},
        onRescheduleTask: () => {},
        onEditTaskDetails: () => {},
        onDeleteTask: () => {},
        onMoveTaskToDate: () => {},
        onOpenMissedModal: () => {},
      })
    );

    // Does NOT show past date banner
    expect(html).not.toContain('Past Date (Read-Only History)');
    // Shows standard start and move buttons
    expect(html).toContain('▶ Start');
    expect(html).toContain('⏱ Move');
  });

  it('separates tasks into To Do and Done sections with circular checkboxes and 12-hour times', () => {
    const splitPlan = {
      date: '2026-10-12',
      wakeTime: '06:00',
      bedTime: '23:00',
      tasks: [
        {
          id: 'todo-1',
          date: '2026-10-12',
          name: 'Morning Workout',
          category: 'Fitness',
          durationMinutes: 45,
          priority: 'High',
          status: 'pending',
          scheduledStart: '07:00',
          scheduledEnd: '07:45',
        },
        {
          id: 'done-1',
          date: '2026-10-12',
          name: 'Read Research Paper',
          category: 'Education',
          durationMinutes: 30,
          priority: 'Medium',
          status: 'completed',
          scheduledStart: '09:00',
          scheduledEnd: '09:30',
        },
      ],
      schedule: {
        blocks: [
          {
            id: 'block-1',
            type: 'task',
            taskId: 'todo-1',
            start: '07:00',
            end: '07:45',
          },
          {
            id: 'block-2',
            type: 'task',
            taskId: 'done-1',
            start: '09:00',
            end: '09:30',
          },
        ],
        unscheduled: [],
      },
    };

    const html = renderToString(
      React.createElement(Timetable, {
        plan: splitPlan,
        now: fixedNow,
        onUpdateTaskStatus: () => {},
        onRescheduleTask: () => {},
        onEditTaskDetails: () => {},
        onDeleteTask: () => {},
        onMoveTaskToDate: () => {},
        onOpenMissedModal: () => {},
      })
    );

    // Section headers
    expect(html).toContain('To Do');
    expect(html).toContain('Done');

    // To Do task has empty circle (role="checkbox" aria-checked="false")
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('todo-circle-todo-1');
    expect(html).toContain('Morning Workout');

    // Done task has ticked circle (role="checkbox" aria-checked="true" with ✓)
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('done-circle-done-1');
    expect(html).toContain('✓');
    expect(html).toContain('Read Research Paper');

    // Display times in 12-hour format
    expect(html).toContain('7:00 AM');
    expect(html).toContain('9:00 AM');
    expect(html).not.toContain('07:00 - 07:45');
    expect(html).not.toContain('09:00 - 09:30');
  });

  it('hides To Do and Done sections on Dashboard when showTodoDone={false} while displaying Daily Schedule header with Add Task and Plan with AI icon', () => {
    const splitPlan = {
      date: '2026-10-12',
      wakeTime: '06:00',
      bedTime: '23:00',
      tasks: [
        {
          id: 'todo-1',
          date: '2026-10-12',
          name: 'Morning Workout',
          category: 'Fitness',
          durationMinutes: 45,
          priority: 'High',
          status: 'pending',
          scheduledStart: '07:00',
          scheduledEnd: '07:45',
        },
        {
          id: 'done-1',
          date: '2026-10-12',
          name: 'Read Research Paper',
          category: 'Education',
          durationMinutes: 30,
          priority: 'Medium',
          status: 'completed',
          scheduledStart: '09:00',
          scheduledEnd: '09:30',
        },
      ],
      schedule: {
        blocks: [
          {
            id: 'block-1',
            type: 'task',
            taskId: 'todo-1',
            start: '07:00',
            end: '07:45',
          },
          {
            id: 'block-2',
            type: 'task',
            taskId: 'done-1',
            start: '09:00',
            end: '09:30',
          },
        ],
        unscheduled: [],
      },
    };

    const html = renderToString(
      React.createElement(Timetable, {
        plan: splitPlan,
        now: fixedNow,
        showTodoDone: false,
        onOpenAddTask: () => {},
        onOpenAIAssistant: () => {},
        onUpdateTaskStatus: () => {},
        onRescheduleTask: () => {},
        onEditTaskDetails: () => {},
        onDeleteTask: () => {},
        onMoveTaskToDate: () => {},
        onOpenMissedModal: () => {},
      })
    );

    // To Do and Done sections must NOT be rendered
    expect(html).not.toContain('dashboard-todo-section');
    expect(html).not.toContain('dashboard-done-section');

    // Daily Schedule header and subtitle
    expect(html).toContain('Daily Schedule');
    expect(html).toContain('Manage your tasks for today');

    // Add Task and Plan with AI buttons
    expect(html).toContain('+ Add Task');
    expect(html).toContain('Plan with AI');
    expect(html).toContain('plan-with-ai-btn');
    expect(html).toContain('✨');

    // Timeline and task information remains visible and active
    expect(html).toContain('Morning Workout');
    expect(html).toContain('Read Research Paper');
    expect(html).toContain('7:00 AM');
    expect(html).toContain('9:00 AM');
  });

  it('groups Daily Timeline into Day-Part sections, displays day-part badges, and hides empty day-parts', () => {
    const multiPeriodPlan = {
      date: '2026-10-12',
      wakeTime: '05:00',
      bedTime: '23:30',
      tasks: [
        {
          id: 'morning-task',
          date: '2026-10-12',
          name: 'Morning Routine & Yoga',
          durationMinutes: 60,
          status: 'pending',
          scheduledStart: '06:00',
          scheduledEnd: '07:00',
        },
        {
          id: 'boundary-task',
          date: '2026-10-12',
          name: 'Project Coding Sprint',
          durationMinutes: 90,
          status: 'pending',
          scheduledStart: '16:30', // Starts in Afternoon (12:00 - 16:59), ends in Evening (18:00)
          scheduledEnd: '18:00',
        },
        {
          id: 'night-task',
          date: '2026-10-12',
          name: 'Night Journaling & Reflection',
          durationMinutes: 30,
          status: 'pending',
          scheduledStart: '21:30',
          scheduledEnd: '22:00',
        },
      ],
      schedule: {
        blocks: [
          {
            id: 'block-morning',
            type: 'task',
            taskId: 'morning-task',
            start: '06:00',
            end: '07:00',
          },
          {
            id: 'free-slot-morning',
            type: 'free',
            start: '07:00',
            end: '09:00',
            durationMinutes: 120,
          },
          {
            id: 'block-boundary',
            type: 'task',
            taskId: 'boundary-task',
            start: '16:30',
            end: '18:00',
          },
          {
            id: 'block-night',
            type: 'task',
            taskId: 'night-task',
            start: '21:30',
            end: '22:00',
          },
        ],
        unscheduled: [],
      },
    };

    const html = renderToString(
      React.createElement(Timetable, {
        plan: multiPeriodPlan,
        now: fixedNow,
        onUpdateTaskStatus: () => {},
        onRescheduleTask: () => {},
        onEditTaskDetails: () => {},
        onDeleteTask: () => {},
        onMoveTaskToDate: () => {},
        onOpenMissedModal: () => {},
      })
    );

    // 1. Day-Part section headings present for populated sections
    expect(html).toContain('Morning');
    expect(html).toContain('Afternoon');
    expect(html).toContain('Night');

    // 2. Evening section is empty (all blocks are Morning, Afternoon, or Night), so "Evening" section heading MUST be hidden
    expect(html).not.toContain('day-part-heading-evening');

    // 3. Free slots display required 12-hour format
    expect(html).toContain('Free: 7:00 AM - 9:00 AM (120 min)');

    // 4. Boundary crossing: 16:30 - 18:00 is labeled by start time (16:30 -> Afternoon)
    expect(html).toContain('badge-afternoon');
    expect(html).toContain('4:30 PM - 6:00 PM');

    // 5. Day-part badges on blocks
    expect(html).toContain('badge-morning');
    expect(html).toContain('badge-night');
  });
});

