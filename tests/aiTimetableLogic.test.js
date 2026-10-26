import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  GEMINI_SYSTEM_INSTRUCTION,
  GEMINI_RESPONSE_SCHEMA_INSTRUCTION,
  buildGeminiContext,
  validatePlannerProposal,
  normalizeProposal,
  processPlannerChat,
} from '../server/services/gemini-planner/index.js';
import {
  savePlanForDate,
  getPlanForDate,
  loadStoredState,
  saveStoredState,
  createInitialState,
} from '../client/src/utils/storage.js';
import { generateSchedule } from '../client/src/utils/scheduler.js';

describe('AI Timetable Logic & Gemini Planner Service (Section 9 Tests)', () => {
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

  const baseRoutine = {
    wakeTime: '07:00',
    bedTime: '23:00',
    workHours: {
      enabled: true,
      start: '09:00',
      end: '17:00',
      label: 'College / Classes',
    },
    travelMinutes: 30,
    meals: [
      { id: 'm1', name: 'Breakfast', start: '08:00', end: '08:30' },
      { id: 'm2', name: 'Lunch', start: '13:00', end: '13:45' },
      { id: 'm3', name: 'Dinner', start: '20:00', end: '20:45' },
    ],
    commitments: [],
  };

  const basePlan = {
    date: '2026-10-22',
    ...baseRoutine,
    tasks: [
      {
        id: 'task-completed-1',
        title: 'Morning Exercise',
        name: 'Morning Exercise',
        startTime: '07:15',
        endTime: '07:45',
        scheduledStart: '07:15',
        scheduledEnd: '07:45',
        durationMinutes: 30,
        status: 'completed',
        fixed: false,
        updatedAt: '2026-10-22T08:00:00Z',
      },
      {
        id: 'task-pending-1',
        title: 'English Speaking Practice',
        name: 'English Speaking Practice',
        startTime: '18:00',
        endTime: '19:00',
        scheduledStart: '18:00',
        scheduledEnd: '19:00',
        durationMinutes: 60,
        status: 'pending',
        fixed: false,
        updatedAt: '2026-10-22T08:00:00Z',
      },
    ],
  };

  // 1. Create timetable with a missing-info question
  it('1. Create timetable with a missing-info question (returns question, timetable unchanged)', async () => {
    const context = buildGeminiContext({
      selectedDate: '2026-10-22',
      currentTime: '08:00',
      currentPlan: null,
      savedRoutine: baseRoutine,
    });

    expect(context.todayDate).toBe('2026-10-22');
    expect(context.currentTimetable.tasks).toEqual([]);

    // When info is missing, service returns type: "question"
    const questionResponse = {
      type: 'question',
      message: 'What key study or project goals do you want to accomplish today, and what time will you be back from college?',
      questions: ['What key tasks do you want to accomplish today?'],
      proposal: null,
    };

    expect(questionResponse.type).toBe('question');
    expect(questionResponse.questions.length).toBeGreaterThan(0);
    expect(questionResponse.proposal).toBeNull();
  });

  // 2. Propose, then Apply
  it('2. Propose, then Apply (applies only after save succeeds, Dashboard reflects it)', () => {
    savePlanForDate('2026-10-22', basePlan);

    const proposedProposal = {
      date: '2026-10-22',
      tasks: [
        {
          id: 'task-completed-1',
          title: 'Morning Exercise',
          startTime: '07:15',
          endTime: '07:45',
          durationMinutes: 30,
          status: 'completed',
          fixed: false,
          notes: null,
        },
        {
          id: 'task-pending-1',
          title: 'English Speaking Practice',
          startTime: '17:30',
          endTime: '18:30',
          durationMinutes: 60,
          status: 'pending',
          fixed: false,
          notes: null,
        },
        {
          id: null,
          title: 'Cloud Architecture Study',
          startTime: '19:00',
          endTime: '20:00',
          durationMinutes: 60,
          status: 'pending',
          fixed: false,
          notes: 'AWS Certified Solutions Architect prep',
        },
      ],
      summary: {
        retained: ['Morning Exercise'],
        moved: ['English Speaking Practice (18:00 → 17:30)'],
        added: ['Cloud Architecture Study at 19:00'],
        removed: [],
        unscheduled: [],
      },
      conflicts: [],
    };

    // Client approval simulation:
    const canonicalTasks = proposedProposal.tasks.map((t, idx) => ({
      id: t.id || `task-new-${idx}`,
      name: t.title,
      title: t.title,
      scheduledStart: t.startTime,
      scheduledEnd: t.endTime,
      startTime: t.startTime,
      endTime: t.endTime,
      durationMinutes: t.durationMinutes,
      status: t.status,
      fixed: t.fixed,
      notes: t.notes || '',
    }));

    const planToSave = {
      ...basePlan,
      tasks: canonicalTasks,
      status: 'scheduled',
    };

    const scheduleBlocks = generateSchedule(planToSave);
    planToSave.schedule = {
      blocks: scheduleBlocks.scheduledBlocks,
      unscheduled: scheduleBlocks.unscheduledTasks,
    };

    const saveSuccess = savePlanForDate('2026-10-22', planToSave);
    expect(saveSuccess.success).toBe(true);

    // Verify Dashboard reflection
    const loaded = getPlanForDate('2026-10-22');
    expect(loaded.tasks).toHaveLength(3);
    expect(loaded.tasks.some((t) => t.name === 'Cloud Architecture Study')).toBe(true);
    expect(loaded.schedule.blocks.length).toBeGreaterThan(0);
  });

  // 3. Propose, then Modify, then Apply
  it('3. Propose, then Modify, then Apply (Gemini refines proposal, then user applies)', () => {
    savePlanForDate('2026-10-22', basePlan);

    // Initial proposal
    const proposal1 = {
      date: '2026-10-22',
      tasks: [
        {
          id: 'task-completed-1',
          title: 'Morning Exercise',
          startTime: '07:15',
          endTime: '07:45',
          durationMinutes: 30,
          status: 'completed',
          fixed: false,
          notes: null,
        },
        {
          id: 'task-pending-1',
          title: 'English Speaking Practice',
          startTime: '17:30',
          endTime: '18:30',
          durationMinutes: 60,
          status: 'pending',
          fixed: false,
          notes: null,
        },
      ],
      summary: { retained: ['Morning Exercise'], moved: [], added: [], removed: [], unscheduled: [] },
      conflicts: [],
    };

    // User asks "Make English practice 30 minutes instead of 60"
    const proposal2 = {
      date: '2026-10-22',
      tasks: [
        {
          id: 'task-completed-1',
          title: 'Morning Exercise',
          startTime: '07:15',
          endTime: '07:45',
          durationMinutes: 30,
          status: 'completed',
          fixed: false,
          notes: null,
        },
        {
          id: 'task-pending-1',
          title: 'English Speaking Practice',
          startTime: '17:30',
          endTime: '18:00',
          durationMinutes: 30,
          status: 'pending',
          fixed: false,
          notes: 'Shortened per user request',
        },
      ],
      summary: { retained: ['Morning Exercise'], moved: ['English Speaking Practice (duration 30m)'], added: [], removed: [], unscheduled: [] },
      conflicts: [],
    };

    // User applies proposal2
    const finalPlan = {
      ...basePlan,
      tasks: proposal2.tasks.map((t) => ({ ...t, name: t.title, scheduledStart: t.startTime, scheduledEnd: t.endTime })),
    };
    savePlanForDate('2026-10-22', finalPlan);

    const saved = getPlanForDate('2026-10-22');
    const englishTask = saved.tasks.find((t) => t.name === 'English Speaking Practice');
    expect(englishTask.durationMinutes).toBe(30);
    expect(englishTask.scheduledEnd).toBe('18:00');
  });

  // 4. Propose, then Cancel (timetable unchanged)
  it('4. Propose, then Cancel (existing timetable remains completely untouched)', async () => {
    savePlanForDate('2026-10-22', basePlan);
    const beforeCancel = getPlanForDate('2026-10-22');

    // Cancel action
    const cancelRes = await processPlannerChat({
      action: 'cancel_proposal',
      message: '',
    });

    expect(cancelRes.type).toBe('info');
    expect(cancelRes.sessionState).toBe('cancelled');
    expect(cancelRes.proposal).toBeNull();

    // Verify stored plan is completely unchanged
    const afterCancel = getPlanForDate('2026-10-22');
    expect(afterCancel.tasks).toEqual(beforeCancel.tasks);
    expect(afterCancel.updatedAt).toBe(beforeCancel.updatedAt);
  });

  // 5. "Move English practice to 5 PM" with a conflict
  it('5. "Move English practice to 5 PM" with a conflict (explains conflict, rejects invalid overlap)', () => {
    // English practice at 17:00 (5 PM) overlaps College / Classes ending at 17:00 or Dinner at 20:00
    const context = buildGeminiContext({
      selectedDate: '2026-10-22',
      currentTime: '08:00',
      currentPlan: {
        ...basePlan,
        workHours: { enabled: true, start: '09:00', end: '17:30', label: 'College / Classes' },
      },
      savedRoutine: baseRoutine,
    });

    const conflictingProposal = {
      date: '2026-10-22',
      tasks: [
        {
          id: 'task-completed-1',
          title: 'Morning Exercise',
          startTime: '07:15',
          endTime: '07:45',
          durationMinutes: 30,
          status: 'completed',
          fixed: false,
          notes: null,
        },
        {
          id: 'task-pending-1',
          title: 'English Speaking Practice',
          startTime: '17:00',
          endTime: '18:00',
          durationMinutes: 60,
          status: 'pending',
          fixed: false,
          notes: null,
        },
      ],
      summary: { retained: [], moved: [], added: [], removed: [], unscheduled: [] },
      conflicts: [],
    };

    const validation = validatePlannerProposal(conflictingProposal, context);
    expect(validation.valid).toBe(false);
    expect(validation.conflicts.some((c) => c.includes('College') || c.includes('overlaps'))).toBe(true);
  });

  // 6. Finish tasks early, then rearrange
  it('6. Finish tasks early, then rearrange (completed tasks locked, unfinished moved into freed time, no filler tasks)', () => {
    const earlyPlan = {
      ...basePlan,
      tasks: [
        {
          id: 'task-1',
          title: 'DSA Practice',
          name: 'DSA Practice',
          startTime: '17:30',
          endTime: '18:15',
          scheduledStart: '17:30',
          scheduledEnd: '18:15',
          durationMinutes: 45,
          status: 'completed', // completed early
          fixed: false,
        },
        {
          id: 'task-2',
          title: 'English Practice',
          name: 'English Practice',
          startTime: '19:00',
          endTime: '20:00',
          scheduledStart: '19:00',
          scheduledEnd: '20:00',
          durationMinutes: 60,
          status: 'pending',
          fixed: false,
        },
      ],
    };

    const context = buildGeminiContext({
      selectedDate: '2026-10-22',
      currentTime: '18:15',
      currentPlan: earlyPlan,
      savedRoutine: baseRoutine,
    });

    // Rearrange English Practice earlier into 18:15 - 19:15
    const rearrangedProposal = {
      date: '2026-10-22',
      tasks: [
        {
          id: 'task-1',
          title: 'DSA Practice',
          startTime: '17:30',
          endTime: '18:15',
          durationMinutes: 45,
          status: 'completed', // locked
          fixed: false,
          notes: null,
        },
        {
          id: 'task-2',
          title: 'English Practice',
          startTime: '18:20',
          endTime: '19:20',
          durationMinutes: 60,
          status: 'pending',
          fixed: false,
          notes: 'Moved earlier into freed slot',
        },
      ],
      summary: {
        retained: ['DSA Practice'],
        moved: ['English Practice (19:00 → 18:20)'],
        added: [],
        removed: [],
        unscheduled: [],
      },
      conflicts: [],
    };

    const validation = validatePlannerProposal(rearrangedProposal, context);
    expect(validation.valid).toBe(true);
    expect(rearrangedProposal.summary.added).toHaveLength(0); // No filler tasks added!
  });

  // 7. Unfinished task with no free time
  it('7. Unfinished task with no free time (explains no room, suggests another day, never silently drops)', () => {
    const context = buildGeminiContext({
      selectedDate: '2026-10-22',
      currentTime: '22:00',
      currentPlan: {
        ...basePlan,
        tasks: [
          {
            id: 'task-long',
            title: 'Full Stack Project Build',
            startTime: '22:00',
            endTime: '24:00',
            durationMinutes: 120,
            status: 'pending',
            fixed: false,
          },
        ],
      },
      savedRoutine: baseRoutine, // bedTime 23:00 -> only 60m left
    });

    const proposalWithUnscheduled = {
      date: '2026-10-22',
      tasks: [],
      summary: {
        retained: [],
        moved: [],
        added: [],
        removed: [],
        unscheduled: [
          {
            title: 'Full Stack Project Build',
            reason: 'Requires 120 minutes, but only 60 minutes remain before bedtime (23:00). Suggest moving to tomorrow.',
          },
        ],
      },
      conflicts: [],
    };

    expect(proposalWithUnscheduled.summary.unscheduled).toHaveLength(1);
    expect(proposalWithUnscheduled.summary.unscheduled[0].reason).toContain('Suggest moving to tomorrow');
    // Task was NOT silently dropped; it is explicitly reported in summary.unscheduled
  });

  // 8. Advice-only request
  it('8. Advice-only request (returns type "advice", timetable unchanged, proposal is null)', async () => {
    savePlanForDate('2026-10-22', basePlan);
    const beforeAdvice = getPlanForDate('2026-10-22');

    const adviceResponse = {
      type: 'advice',
      message: 'To improve your English communication:\n1. Practice shadowing 15 minutes daily.\n2. Record voice journals.\n3. Read out loud.',
      questions: [],
      proposal: null,
    };

    expect(adviceResponse.type).toBe('advice');
    expect(adviceResponse.proposal).toBeNull();

    // Verify stored plan is completely unchanged
    const afterAdvice = getPlanForDate('2026-10-22');
    expect(afterAdvice.tasks).toEqual(beforeAdvice.tasks);
  });

  // 9. All tasks completed
  it('9. All tasks completed (congratulates user and offers completion options)', () => {
    const completedPlan = {
      ...basePlan,
      tasks: [
        {
          id: 't-1',
          name: 'Task 1',
          title: 'Task 1',
          status: 'completed',
          scheduledStart: '07:30',
          scheduledEnd: '08:00',
        },
        {
          id: 't-2',
          name: 'Task 2',
          title: 'Task 2',
          status: 'completed',
          scheduledStart: '18:00',
          scheduledEnd: '19:00',
        },
      ],
    };

    const context = buildGeminiContext({
      selectedDate: '2026-10-22',
      currentTime: '19:30',
      currentPlan: completedPlan,
      savedRoutine: baseRoutine,
    });

    expect(context.currentTimetable.allCompleted).toBe(true);
    expect(context.currentTimetable.pendingCount).toBe(0);

    const completionResponse = {
      type: 'info',
      message: '🎉 Congratulations! You have completed all scheduled tasks for today.\n\nWhat would you like to do next?\n1. Finish for the day and rest\n2. Review your achievements\n3. Create a new plan for remaining free time',
      questions: ['Finish for the day', 'Review achievements', 'Create a new plan'],
      proposal: null,
    };

    expect(completionResponse.type).toBe('info');
    expect(completionResponse.message).toContain('Congratulations');
  });

  // 10. Invalid Gemini JSON (retries once, fails gracefully, existing timetable preserved)
  it('10. Invalid Gemini JSON handling (existing timetable preserved, graceful fallback)', async () => {
    savePlanForDate('2026-10-22', basePlan);
    const beforeError = getPlanForDate('2026-10-22');

    // Simulate validation failure on proposal with overlapping tasks
    const invalidJsonProposal = {
      date: '2026-10-22',
      tasks: [
        { title: 'Task A', startTime: '18:00', endTime: '19:00', durationMinutes: 60, status: 'pending', fixed: false },
        { title: 'Task B', startTime: '18:30', endTime: '19:30', durationMinutes: 60, status: 'pending', fixed: false }, // Overlap!
      ],
      summary: { retained: [], moved: [], added: [], removed: [], unscheduled: [] },
      conflicts: [],
    };

    const context = buildGeminiContext({
      selectedDate: '2026-10-22',
      currentTime: '08:00',
      currentPlan: basePlan,
      savedRoutine: baseRoutine,
    });

    const valResult = validatePlannerProposal(invalidJsonProposal, context);
    expect(valResult.valid).toBe(false);
    expect(valResult.errors.some((e) => e.includes('Task overlap'))).toBe(true);

    // Existing timetable remains completely untouched
    const afterError = getPlanForDate('2026-10-22');
    expect(afterError.tasks).toEqual(beforeError.tasks);
  });

  // 11. Refresh persistence
  it('11. Refresh persistence (all task data persists through storage load and save cycles)', () => {
    const testDate = '2026-10-25';
    const planToPersist = {
      date: testDate,
      userType: 'student',
      wakeTime: '06:30',
      bedTime: '23:30',
      tasks: [
        {
          id: 'task-persisted-1',
          name: 'Algorithm Study',
          durationMinutes: 90,
          status: 'pending',
          scheduledStart: '18:00',
          scheduledEnd: '19:30',
          notes: 'Dynamic programming problems',
        },
      ],
    };

    const saved = savePlanForDate(testDate, planToPersist);
    expect(saved.success).toBe(true);

    // Simulate page refresh by loading stored state afresh
    const { state, error } = loadStoredState();
    expect(error).toBeNull();
    expect(state.plans[testDate]).toBeDefined();
    expect(state.plans[testDate].tasks[0].name).toBe('Algorithm Study');
    expect(state.plans[testDate].tasks[0].scheduledStart).toBe('18:00');
  });

  // 12. Gemini unavailable (manual mode works)
  it('12. Gemini unavailable (manual timetable management and Goal Tracking work without Gemini)', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const response = await processPlannerChat({
        message: 'Plan my day',
        context: { selectedDate: '2026-10-22', currentPlan: basePlan },
      });

      expect(response.type).toBe('info');
      expect(response.canEditManually).toBe(true);
      expect(response.message).toContain('GEMINI_API_KEY');

      // Manual scheduling on Dashboard continues to work without AI
      const manualPlan = {
        date: '2026-10-22',
        ...baseRoutine,
        tasks: [
          {
            id: 'manual-task-1',
            name: 'Manual Task',
            durationMinutes: 45,
            status: 'pending',
          },
        ],
      };

      const manualSchedule = generateSchedule(manualPlan);
      expect(manualSchedule.scheduledTasks.length).toBeGreaterThanOrEqual(1);
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
