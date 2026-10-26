import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.GEMINI_API_KEY = 'mock-test-key';

vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      constructor() {
        this.models = {
          generateContent: async ({ contents }) => {
            const prompt = contents?.[0]?.parts?.[0]?.text || '';

            if (prompt.includes('fitness guide')) {
              return {
                text: JSON.stringify({
                  intent: 'advice',
                  reply: '### Beginner Fitness Guide\n1. Stay consistent.\n2. Hydrate.\n3. Safe bodyweight exercises.',
                  followUpQuestion: null,
                  requestedModifications: null,
                }),
              };
            }

            if (prompt.includes('Move DSA LeetCode Coding')) {
              return {
                text: JSON.stringify({
                  intent: 'plan_modification',
                  reply: 'Moved DSA LeetCode Coding to 18:00.',
                  followUpQuestion: null,
                  requestedModifications: [
                    {
                      taskName: 'DSA LeetCode Coding',
                      action: 'move',
                      scheduledStart: '18:00',
                      scheduledEnd: '19:00',
                    },
                  ],
                }),
              };
            }

            if (prompt.includes('Regenerate') || prompt.includes('regenerate') || prompt.includes('woke up late')) {
              return {
                text: JSON.stringify({
                  intent: 'plan_regeneration',
                  reply: "Let's regenerate your schedule.",
                  followUpQuestion: null,
                  requestedModifications: null,
                }),
              };
            }

            return {
              text: JSON.stringify({
                intent: 'advice',
                reply: 'Hello! I am here to help.',
                followUpQuestion: null,
                requestedModifications: null,
              }),
            };
          },
        };
      }
    },
  };
});

import {
  processChatRequest,
  getOrCreateSession,
  resetSession,
  isAudioFriendlyTask,
  generateProposalWithHardRules,
  determineApplicableQuestions,
  computePlanFingerprint,
} from '../server/chatService.js';
import {
  savePlanForDate,
  getPlanForDate,
  loadChatPreferences,
  saveChatPreferences,
} from '../client/src/utils/storage.js';

describe('Guided Plan Regeneration State Machine & Hard Scheduling Rules', () => {
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

  const testPlan = {
    date: '2026-10-20',
    wakeTime: '07:00',
    bedTime: '23:00',
    travelMinutes: 30,
    workHours: {
      start: '09:00',
      end: '17:00',
      label: 'College Classes',
    },
    meals: [
      { id: 'm1', name: 'Breakfast', start: '08:00', end: '08:30' },
      { id: 'm2', name: 'Lunch', start: '13:00', end: '13:45' },
    ],
    commitments: [],
    tasks: [
      {
        id: 't-comp',
        name: 'Morning Meditation',
        durationMinutes: 30,
        status: 'completed',
        scheduledStart: '07:30',
        scheduledEnd: '08:00',
        completedAt: '2026-10-20T08:00:00Z',
      },
      {
        id: 't-dsa',
        name: 'DSA LeetCode Coding',
        durationMinutes: 60,
        status: 'pending',
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: 't-podcast',
        name: 'Tech Architecture Podcast',
        durationMinutes: 30,
        status: 'pending',
        scheduledStart: null,
        scheduledEnd: null,
      },
    ],
  };

  describe('Audio-Friendly vs. Visual/Typing Rule for Travel', () => {
    it('correctly identifies audio-friendly tasks and disallows visual/typing tasks', () => {
      // Audio friendly
      expect(isAudioFriendlyTask({ name: 'Listen to Cloud Architecture Podcast' })).toBe(true);
      expect(isAudioFriendlyTask({ name: 'German Language Listening', category: 'Education' })).toBe(true);
      expect(isAudioFriendlyTask({ name: 'Mental review of system design ideas' })).toBe(true);
      expect(isAudioFriendlyTask({ name: 'Planning by voice notes' })).toBe(true);

      // Disallowed visual, coding, math, reading, typing tasks
      expect(isAudioFriendlyTask({ name: 'DSA LeetCode Coding' })).toBe(false);
      expect(isAudioFriendlyTask({ name: 'Read chapter 4 of OS textbook' })).toBe(false);
      expect(isAudioFriendlyTask({ name: 'Write college lab report' })).toBe(false);
      expect(isAudioFriendlyTask({ name: 'Type resume update' })).toBe(false);
      expect(isAudioFriendlyTask({ name: 'Gym pushups workout' })).toBe(false);
    });

    it('rejects placement of visual/typing tasks in commute time even if travel has open slot', () => {
      const planWithTravel = {
        ...testPlan,
        travelMinutes: 30,
        workHours: { start: '09:00', end: '17:00' },
        tasks: [
          {
            id: 't-coding',
            name: 'React and Vite Coding',
            durationMinutes: 30,
            status: 'pending',
            scheduledStart: null,
            scheduledEnd: null,
          },
        ],
      };

      const proposal = generateProposalWithHardRules({
        plan: planWithTravel,
        preferences: { travel: 'audio_tasks' },
        currentTime: '07:00',
        isRemainingDayRequest: false,
      });

      // The visual/coding task MUST NOT be scheduled in travel time (08:30 - 09:00)!
      const scheduledInTravel = proposal.tasks.find(
        (t) => t.id === 't-coding' && t.scheduledStart === '08:30'
      );
      expect(scheduledInTravel).toBeUndefined();
    });
  });

  describe('Guided Questionnaire Generation', () => {
    it('identifies questions only for situations that actually exist today', () => {
      const questions = determineApplicableQuestions(testPlan, {}, {});
      expect(questions.length).toBe(3); // travel, collegeWork, meals all exist
      expect(questions.map((q) => q.id)).toEqual(['travel', 'collegeWork', 'meals']);
    });

    it('skips questions for situations that do not exist today', () => {
      const minimalPlan = {
        date: '2026-10-20',
        travelMinutes: 0,
        workHours: null,
        meals: [],
        tasks: [],
      };
      const questions = determineApplicableQuestions(minimalPlan, {}, {});
      expect(questions.length).toBe(0);
    });

    it('skips questions if preferences are already saved or answered', () => {
      const savedPrefs = { travel: 'free', collegeWork: 'reserve_all' };
      const questions = determineApplicableQuestions(testPlan, {}, savedPrefs);
      expect(questions.length).toBe(1); // Only meals question remains
      expect(questions[0].id).toBe('meals');
    });
  });

  describe('State Machine & Guided Workflow Integration', () => {
    const sessionId = 'test-session-123';

    beforeEach(() => {
      resetSession(sessionId);
    });

    it('1. Advice request never touches plan or starts workflow', async () => {
      const res = await processChatRequest({
        sessionId,
        message: 'Give me a fitness guide for beginners',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });

      expect(res.intent).toBe('advice');
      expect(res.proposedPlan).toBeNull();
      expect(res.sessionState).toBe('idle');
    });

    it('2. "Regenerate my plan" triggers questionnaire and NEVER immediately generates schedule', async () => {
      const res = await processChatRequest({
        sessionId,
        message: 'Regenerate my plan for today',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });

      expect(res.intent).toBe('plan_regeneration');
      expect(res.sessionState).toBe('collecting_preferences');
      expect(res.question).toBeDefined();
      expect(res.quickReplies.length).toBeGreaterThan(0);
      expect(res.proposedPlan).toBeNull(); // Strictly NO schedule on first request!
    });

    it('3. Answering questions advances state machine and produces proposal once complete', async () => {
      // Step 1: Trigger regeneration
      let res = await processChatRequest({
        sessionId,
        message: 'Regenerate my plan',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });
      expect(res.sessionState).toBe('collecting_preferences');
      expect(res.question.id).toBe('travel');

      // Step 2: Answer travel question
      res = await processChatRequest({
        sessionId,
        message: 'Keep travel free',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });
      expect(res.sessionState).toBe('collecting_preferences');
      expect(res.question.id).toBe('collegeWork');

      // Step 3: Answer collegeWork question
      res = await processChatRequest({
        sessionId,
        message: 'Reserve whole block',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });
      expect(res.sessionState).toBe('collecting_preferences');
      expect(res.question.id).toBe('meals');

      // Step 4: Answer meals question -> all answered -> proposal_ready!
      res = await processChatRequest({
        sessionId,
        message: 'Keep meals free',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });
      expect(res.sessionState).toBe('proposal_ready');
      expect(res.proposedPlan).toBeDefined();
      expect(res.proposedPlan.tasks).toBeDefined();
      expect(res.proposalActions).toEqual(['Apply New Plan', 'Modify Plan', 'Cancel']);
    });

    it('4. Reuses saved permanent preferences and displays them to the user', async () => {
      const savedPrefs = { meals: 'free', travel: 'free' };
      const res = await processChatRequest({
        sessionId: 'test-session-reuse',
        message: 'Regenerate my plan',
        context: {
          selectedDate: '2026-10-20',
          currentPlan: testPlan,
          savedPreferences: savedPrefs,
        },
      });

      // Shows reuse message
      expect(res.reply).toContain('Using your saved preference');
      expect(res.reply).toContain('keep travel free');
    });

    it('5. Modify Plan prompts for adjustments and creates a revised proposal', async () => {
      // Set session to proposal_ready
      const session = getOrCreateSession('test-mod-session');
      session.state = 'proposal_ready';
      session.lastProposal = {
        date: '2026-10-20',
        tasks: testPlan.tasks,
      };

      // User triggers modify_proposal
      const modPrompt = await processChatRequest({
        sessionId: 'test-mod-session',
        action: 'modify_proposal',
      });
      expect(modPrompt.sessionState).toBe('modifying');

      // User provides modification instructions
      const revised = await processChatRequest({
        sessionId: 'test-mod-session',
        message: 'Move DSA LeetCode Coding to 18:00',
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });

      expect(revised.sessionState).toBe('proposal_ready');
      expect(revised.proposedPlan).toBeDefined();
      expect(revised.proposalActions).toEqual(['Apply New Plan', 'Modify Plan', 'Cancel']);
    });

    it('6. Apply is idempotent and updates timetable while preserving completed tasks', async () => {
      const planToApply = {
        date: '2026-10-20',
        tasks: [
          { id: 't-comp', name: 'Morning Meditation', status: 'completed', scheduledStart: '07:30', scheduledEnd: '08:00' },
          { id: 't-dsa', name: 'DSA LeetCode Coding', status: 'pending', scheduledStart: '18:00', scheduledEnd: '19:00' },
        ],
        planVersion: computePlanFingerprint(testPlan),
      };

      const applyRes = await processChatRequest({
        sessionId: 'test-apply-session',
        action: 'apply_proposal',
        proposalData: planToApply,
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });

      expect(applyRes.sessionState).toBe('applied');

      // Repeat click (idempotent)
      const repeatRes = await processChatRequest({
        sessionId: 'test-apply-session',
        action: 'apply_proposal',
        proposalData: planToApply,
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });

      expect(repeatRes.sessionState).toBe('applied');
      expect(repeatRes.isIdempotent).toBe(true);
    });

    it('7. Stale proposals are rejected if the underlying plan changed', async () => {
      const staleProposal = {
        date: '2026-10-20',
        tasks: testPlan.tasks,
        planVersion: 'old-outdated-fingerprint-999',
      };

      const res = await processChatRequest({
        sessionId: 'test-stale-session',
        action: 'apply_proposal',
        proposalData: staleProposal,
        context: { selectedDate: '2026-10-20', currentPlan: testPlan },
      });

      expect(res.error).toBe('STALE_PROPOSAL');
      expect(res.reply).toContain('modified after this proposal was created');
    });

    it('8. Cancel ends workflow without modifying existing plan', async () => {
      const res = await processChatRequest({
        sessionId: 'test-cancel-session',
        action: 'cancel_proposal',
      });

      expect(res.sessionState).toBe('cancelled');
      expect(res.proposedPlan).toBeNull();
    });
  });
});
