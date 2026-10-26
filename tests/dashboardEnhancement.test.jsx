import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Dashboard from '../client/src/pages/Dashboard.jsx';
import DailyProgressSummary from '../client/src/components/dashboard/DailyProgressSummary.jsx';
import GoalProgressOverview from '../client/src/components/dashboard/GoalProgressOverview.jsx';
import UpcomingReminders from '../client/src/components/dashboard/UpcomingReminders.jsx';
import Sidebar, { NAV_SECTIONS, NAV_ITEMS } from '../client/src/components/Sidebar.jsx';
import Settings from '../client/src/pages/Settings.jsx';
import ProgressReports from '../client/src/pages/ProgressReports.jsx';
import { PlannerProvider } from '../client/src/context/PlannerContext.jsx';
import {
  recordScheduleVersion,
  restoreScheduleVersion,
  loadScheduleVersions,
  getUpcomingReminders,
} from '../client/src/utils/storage.js';

describe('Professional Dashboard Enhancement Verification', () => {
  it('Sidebar exports organized NAV_SECTIONS with 4 required groups and yellow highlight support', () => {
    expect(NAV_SECTIONS.length).toBe(4);
    const titles = NAV_SECTIONS.map((s) => s.title);
    expect(titles).toEqual(['Overview', 'Personal Growth', 'Daily Wellness', 'Settings']);

    // Check Overview items
    expect(NAV_SECTIONS[0].items.map((i) => i.label)).toEqual(['Dashboard', 'Daily Planner', 'AI Assistant']);

    // Check Personal Growth items
    expect(NAV_SECTIONS[1].items.map((i) => i.label)).toEqual([
      'Goal Tracking',
      'Study Planner',
      'Career Planner',
      'Diet & Nutrition',
      'Fitness Planner',
    ]);

    // Check Daily Wellness items
    expect(NAV_SECTIONS[2].items.map((i) => i.label)).toEqual([
      'Habit Tracker',
      'Focus Mode',
      'Journal',
      'Progress Reports',
    ]);

    // Check Settings items
    expect(NAV_SECTIONS[3].items.map((i) => i.label)).toEqual([
      'Preferences',
      'Reminder Settings',
      'Planner Settings',
    ]);

    // Render Sidebar
    const html = renderToString(
      React.createElement(Sidebar, {
        activeTab: 'dashboard',
        isCollapsed: false,
      })
    );
    expect(html).toContain('Overview');
    expect(html).toContain('Personal Growth');
    expect(html).toContain('Daily Wellness');
    expect(html).toContain('Settings');
    expect(html).toContain('Dashboard');
    expect(html).toContain('Planner Settings');
  });

  it('renders DailyProgressSummary stat cards computed directly from plan data', () => {
    const testPlan = {
      date: '2026-10-26',
      tasks: [
        {
          id: 't-1',
          name: 'Operating Systems Revision',
          category: 'Education',
          durationMinutes: 60,
          scheduledStart: '09:00',
          scheduledEnd: '10:00',
          status: 'completed',
        },
        {
          id: 't-2',
          name: 'AWS Cloud Lab',
          category: 'Career',
          durationMinutes: 90,
          scheduledStart: '10:30',
          scheduledEnd: '12:00',
          status: 'pending',
        },
      ],
      schedule: {
        blocks: [],
        unscheduled: [{ id: 'u-1', name: 'Extra Reading', durationMinutes: 30 }],
      },
    };

    const html = renderToString(
      React.createElement(DailyProgressSummary, {
        plan: testPlan,
      })
    );

    // Assert scheduled, completed, planned time, unscheduled
    expect(html).toContain('Scheduled Tasks');
    expect(html).toContain('2'); // 2 scheduled
    expect(html).toContain('Completed Tasks');
    expect(html).toContain('1'); // 1 completed
    expect(html).toContain('Planned vs Spent Time');
    expect(html).toContain('2h 30m'); // 60 + 90 = 150m = 2h 30m planned
    expect(html).toContain('1h'); // 60m spent
    expect(html).toContain('Unscheduled Tasks');
    expect(html).toContain('1'); // 1 unscheduled
  });

  it('renders GoalProgressOverview with compact cards for Education, Career, Diet, Fitness', () => {
    const html = renderToString(
      React.createElement(GoalProgressOverview, {
        selectedDate: '2026-10-26',
      })
    );

    expect(html).toContain('GOAL PROGRESS OVERVIEW');
    expect(html).toContain('Education');
    expect(html).toContain('Career');
    expect(html).toContain('Diet &amp; Nutrition');
    expect(html).toContain('Fitness');
    expect(html).toContain('#/goals/education');
    expect(html).toContain('#/goals/career');
    expect(html).toContain('#/goals/diet');
    expect(html).toContain('#/goals/fitness');
  });

  it('renders UpcomingReminders with quiet hours and reminder lead time information', () => {
    const html = renderToString(
      React.createElement(UpcomingReminders, {
        selectedDate: '2026-10-26',
        now: { localDate: '2026-10-26', currentTime: '14:00' },
      })
    );

    expect(html).toContain('UPCOMING &amp; SMART REMINDERS');
    expect(html).toContain('Lead Time:');
    expect(html).toContain('#/settings/reminders');
  });

  it('supports schedule version recording and non-destructive restoration', () => {
    const initialPlan = {
      date: '2026-10-26',
      wakeTime: '06:00',
      bedTime: '23:00',
      status: 'scheduled',
      tasks: [
        {
          id: 'task-a',
          name: 'Core System Programming',
          category: 'Education',
          durationMinutes: 60,
          scheduledStart: '08:00',
          scheduledEnd: '09:00',
          status: 'pending',
        },
      ],
      schedule: { blocks: [], unscheduled: [] },
    };

    // 1. Record snapshot
    const entry = recordScheduleVersion({
      date: '2026-10-26',
      author: 'User',
      action: 'Manual Edit',
      summary: 'Added Core System Programming',
      plan: initialPlan,
    });

    expect(entry).not.toBeNull();
    expect(entry.id).toBeDefined();

    // 2. Existing plan where task-a was subsequently completed
    const currentPlans = {
      '2026-10-26': {
        ...initialPlan,
        tasks: [
          {
            ...initialPlan.tasks[0],
            status: 'completed',
            completedAt: '2026-10-26T09:00:00.000Z',
          },
        ],
      },
    };

    // 3. Restore snapshot
    const restoreResult = restoreScheduleVersion(entry.id, currentPlans);
    expect(restoreResult.success).toBe(true);
    expect(restoreResult.targetDate).toBe('2026-10-26');

    // Rule: Restore must NOT erase completed task status or history!
    const restoredTask = restoreResult.restoredPlan.tasks.find((t) => t.id === 'task-a');
    expect(restoredTask.status).toBe('completed');
    expect(restoredTask.completedAt).toBe('2026-10-26T09:00:00.000Z');
  });

  it('renders Settings with Preferences, Reminder Settings, and Planner Settings subtabs', () => {
    const html = renderToString(
      React.createElement(
        PlannerProvider,
        null,
        React.createElement(Settings, {
          activeSubTab: 'reminders',
        })
      )
    );

    expect(html).toContain('Preferences');
    expect(html).toContain('Reminder Settings');
    expect(html).toContain('Planner Settings');
    expect(html).toContain('Quiet Hours Configuration');
    expect(html).toContain('Smart Reminder Categories');
    expect(html).toContain('Truth in Notification Support');
  });

  it('renders ProgressReports with honest weekly and monthly analytics', () => {
    const html = renderToString(React.createElement(ProgressReports));

    expect(html).toContain('Progress Reports &amp; Analytics');
    expect(html).toContain('Honest Data Accounting');
    expect(html).toContain('Last 7 Days');
    expect(html).toContain('Last 30 Days');
    expect(html).toContain('Schedule Completion');
    expect(html).toContain('Planned vs Actually Spent Time');
  });
});
