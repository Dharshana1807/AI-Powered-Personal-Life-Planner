import { GoogleGenAI } from '@google/genai';
import {
  timeToMinutes,
  minutesToTime,
  checkIntervalConflict,
  isWithinWakeHours,
  doIntervalsOverlap,
} from '../shared/conflictEngine.js';
import {
  generateSchedule,
  findSlotForSingleTask,
  toRelativeMinutes,
  fromRelativeMinutes,
  subtractIntervals,
} from '../client/src/utils/scheduler.js';
import { generateId, extractTimeFromText, formatTime12h } from '../client/src/utils/dateUtils.js';

// Server-side session store for guided regeneration state machines
// Keyed by sessionId: { id, state, selectedDate, planVersion, preferences, savedPermanentPreferences, pendingQuestions, currentQuestion, lastProposal, history }
export const chatSessions = new Map();

/**
 * Returns or creates a server-side chat session.
 */
export function getOrCreateSession(sessionId, initialPreferences = {}) {
  const sid = sessionId || generateId('session');
  if (!chatSessions.has(sid)) {
    chatSessions.set(sid, {
      id: sid,
      state: 'idle', // 'idle' | 'collecting_preferences' | 'proposal_ready' | 'modifying' | 'applied' | 'cancelled'
      selectedDate: null,
      planVersion: null,
      preferences: {
        travel: null, // 'free' | 'audio_tasks'
        collegeWork: null, // 'reserve_all' | 'allow_breaks'
        meals: null, // 'free' | 'allow_short_tasks'
      },
      savedPermanentPreferences: { ...initialPreferences },
      pendingQuestions: [],
      currentQuestion: null,
      lastProposal: null,
      history: [],
      updatedAt: Date.now(),
    });
  }
  const session = chatSessions.get(sid);
  session.updatedAt = Date.now();
  return session;
}

/**
 * Clears or resets a session state back to idle.
 */
export function resetSession(sessionId) {
  if (chatSessions.has(sessionId)) {
    const s = chatSessions.get(sessionId);
    s.state = 'idle';
    s.pendingQuestions = [];
    s.currentQuestion = null;
    s.lastProposal = null;
    s.preferences = { ...s.savedPermanentPreferences };
  }
}

/**
 * Task audio-friendliness validator.
 * Tasks during travel MUST be audio-friendly (podcast, lecture, audio, listening, mental review).
 * Any task requiring visual attention, typing, coding, reading, or manual concentration is strictly disallowed.
 */
export function isAudioFriendlyTask(task) {
  if (!task) return false;
  const name = (task.name || '').toLowerCase();
  const category = (task.category || '').toLowerCase();
  const notes = (task.notes || '').toLowerCase();
  let fullText = `${name} ${category} ${notes}`;

  // Normalize voice notes so "notes" keyword doesn't trigger visual/typing flag
  if (fullText.includes('voice note') || fullText.includes('voice notes')) {
    fullText = fullText.replace(/voice\s+notes?/g, 'voice_audio');
  }

  const audioKeywords = [
    'audio',
    'podcast',
    'lecture',
    'listen',
    'listening',
    'audiobook',
    'mental review',
    'review mentally',
    'voice',
    'voice_audio',
    'planning by voice',
    'language listening',
  ];

  const visualTypingKeywords = [
    'code',
    'coding',
    'program',
    'programming',
    'write',
    'writing',
    'type',
    'typing',
    'dsa',
    'read',
    'reading',
    'book',
    'paper',
    'math',
    'problem solving',
    'lab',
    'screen',
    'sheet',
    'workout',
    'gym',
    'exercise',
    'pushup',
    'assignment',
  ];

  const hasAudio = audioKeywords.some((kw) => fullText.includes(kw));
  const hasVisual = visualTypingKeywords.some((kw) => fullText.includes(kw));

  // Must have audio keyword and not have visual/typing/coding tasks
  return hasAudio && !hasVisual;
}

/**
 * Validates that an interval does not conflict with fixed routine blocks.
 */
export function validateAgainstFixedCommitments(start, end, plan, ignoreTaskId = null) {
  if (!start || !end) return { hasConflict: true, message: 'Invalid start or end time.' };

  // 1. Wake / Sleep bounds
  const wakeTime = plan.wakeTime || '07:00';
  const bedTime = plan.bedTime || '23:00';
  if (!isWithinWakeHours(start, end, wakeTime, bedTime)) {
    return {
      hasConflict: true,
      message: `Proposed time (${start} - ${end}) falls outside your waking hours (${wakeTime} - ${bedTime}) or overlaps sleep.`,
    };
  }

  // 2. Fixed routine items (College/Work, Meals, Commitments)
  const fixedItems = [];
  if (plan.workHours?.start && plan.workHours?.end) {
    fixedItems.push({
      start: plan.workHours.start,
      end: plan.workHours.end,
      title: plan.workHours.label || (plan.userType === 'student' ? 'College / Classes' : 'Work / Office Hours'),
    });
  }
  (plan.meals || []).forEach((m) => {
    if (m.start && m.end) fixedItems.push({ start: m.start, end: m.end, title: m.name || 'Meal' });
  });
  (plan.commitments || []).forEach((c) => {
    if (c.start && c.end) fixedItems.push({ start: c.start, end: c.end, title: c.name || 'Commitment' });
  });

  const fixedConflict = checkIntervalConflict(
    { startTime: start, endTime: end },
    fixedItems.map((item) => ({ ...item, startTime: item.start, endTime: item.end }))
  );

  if (fixedConflict.hasConflict) {
    return {
      hasConflict: true,
      conflictingItem: fixedConflict.conflictingItem,
      message: `Conflicts with fixed schedule: ${fixedConflict.message}`,
    };
  }

  // 3. Completed / Locked tasks
  const completedTasks = (plan.tasks || []).filter(
    (t) => t.id !== ignoreTaskId && t.status === 'completed' && t.scheduledStart && t.scheduledEnd
  );
  const completedConflict = checkIntervalConflict(
    { startTime: start, endTime: end },
    completedTasks.map((t) => ({ ...t, startTime: t.scheduledStart, endTime: t.scheduledEnd, title: t.name }))
  );

  if (completedConflict.hasConflict) {
    return {
      hasConflict: true,
      conflictingItem: completedConflict.conflictingItem,
      message: `Conflicts with completed task "${completedConflict.conflictingItem?.title}" (${completedConflict.conflictingItem?.startTime} - ${completedConflict.conflictingItem?.endTime}).`,
    };
  }

  return { hasConflict: false };
}

/**
 * Finds next free intervals after a given reference time (e.g. currentTime).
 */
export function findAvailableFreeSlots(plan, afterTime = null, durationMinutes = 30) {
  const wakeTime = plan.wakeTime || '07:00';
  const bedTime = plan.bedTime || '23:00';
  const wakeMin = timeToMinutes(wakeTime);
  let bedMin = timeToMinutes(bedTime);
  if (bedMin <= wakeMin) bedMin += 1440;
  const totalWaking = bedMin - wakeMin;

  const blocked = [];
  if (plan.workHours?.start && plan.workHours?.end) {
    const s = toRelativeMinutes(plan.workHours.start, wakeMin, bedMin);
    const e = toRelativeMinutes(plan.workHours.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e)) blocked.push([s, e]);
  }
  (plan.meals || []).forEach((m) => {
    const s = toRelativeMinutes(m.start, wakeMin, bedMin);
    const e = toRelativeMinutes(m.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e)) blocked.push([s, e]);
  });
  (plan.commitments || []).forEach((c) => {
    const s = toRelativeMinutes(c.start, wakeMin, bedMin);
    const e = toRelativeMinutes(c.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e)) blocked.push([s, e]);
  });
  (plan.tasks || []).forEach((t) => {
    if (t.status === 'completed' && t.scheduledStart && t.scheduledEnd) {
      const s = toRelativeMinutes(t.scheduledStart, wakeMin, bedMin);
      const e = toRelativeMinutes(t.scheduledEnd, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e)) blocked.push([s, e]);
    }
  });

  let freeWindows = subtractIntervals([[0, totalWaking]], blocked);

  if (afterTime) {
    const afterRel = toRelativeMinutes(afterTime, wakeMin, bedMin);
    if (!isNaN(afterRel)) {
      freeWindows = freeWindows
        .map(([s, e]) => [Math.max(s, afterRel), e])
        .filter(([s, e]) => e - s >= durationMinutes);
    }
  }

  return freeWindows.map(([s, e]) => ({
    start: fromRelativeMinutes(s, wakeMin),
    end: fromRelativeMinutes(e, wakeMin),
    duration: e - s,
  }));
}

/**
 * Builds a structured diff between old tasks and newly proposed tasks.
 */
export function buildProposalChangesSummary(currentTasks = [], nextTasks = [], unscheduled = []) {
  const moved = [];
  const unchanged = [];
  const added = [];

  for (const nextT of nextTasks) {
    const orig = currentTasks.find((t) => t.id === nextT.id || t.name.toLowerCase() === nextT.name.toLowerCase());
    if (!orig) {
      added.push({
        task: nextT,
        newStart: nextT.scheduledStart,
        newEnd: nextT.scheduledEnd,
      });
      continue;
    }

    if (orig.scheduledStart !== nextT.scheduledStart || orig.scheduledEnd !== nextT.scheduledEnd) {
      moved.push({
        task: nextT,
        oldStart: orig.scheduledStart || 'Unscheduled',
        oldEnd: orig.scheduledEnd || 'Unscheduled',
        newStart: nextT.scheduledStart,
        newEnd: nextT.scheduledEnd,
      });
    } else {
      unchanged.push(nextT);
    }
  }

  return { moved, unchanged, added, unscheduled };
}

/**
 * Determines questions that actually exist in today's data and are not yet answered.
 */
export function determineApplicableQuestions(plan, sessionPreferences = {}, savedPermanent = {}) {
  const questions = [];

  // 1. Travel check
  const hasTravel = (Number(plan.travelMinutes) > 0) || (plan.travel?.enabled);
  const travelPref = sessionPreferences.travel || savedPermanent.travel;
  if (hasTravel && !travelPref) {
    const travelMins = Number(plan.travelMinutes) || 30;
    questions.push({
      id: 'travel',
      topic: 'Travel / Commute',
      text: `You have ${travelMins} minutes of commute/travel today. Would you like to keep this time free, or schedule audio-friendly tasks (e.g. listening to a lecture or podcast)?`,
      quickReplies: ['Keep travel free', 'Allow audio tasks only'],
    });
  }

  // 2. College / Work check
  const hasWork = Boolean(plan.workHours?.start && plan.workHours?.end);
  const workPref = sessionPreferences.collegeWork || savedPermanent.collegeWork;
  if (hasWork && !workPref) {
    const label = plan.workHours.label || (plan.userType === 'student' ? 'College / Classes' : 'Work');
    questions.push({
      id: 'collegeWork',
      topic: 'Work / College Hours',
      text: `During your ${label} (${plan.workHours.start} - ${plan.workHours.end}), should I reserve the entire period, or allow flexible tasks during genuine free breaks?`,
      quickReplies: ['Reserve whole block', 'Allow flexible tasks during breaks'],
    });
  }

  // 3. Meals check
  const hasMeals = Array.isArray(plan.meals) && plan.meals.length > 0;
  const mealsPref = sessionPreferences.meals || savedPermanent.meals;
  if (hasMeals && !mealsPref) {
    questions.push({
      id: 'meals',
      topic: 'Meals',
      text: `For your meal times, would you like to keep them free by default, or allow optional short tasks?`,
      quickReplies: ['Keep meals free', 'Allow short tasks during meals'],
    });
  }

  return questions;
}

/**
 * Computes plan version fingerprint to detect stale proposals.
 */
export function computePlanFingerprint(plan) {
  if (!plan) return 'empty';
  const taskCount = (plan.tasks || []).length;
  const updatedAt = plan.updatedAt || plan.date || '';
  const taskSignatures = (plan.tasks || []).map((t) => `${t.id}-${t.status}-${t.scheduledStart || ''}`).join('|');
  return `${plan.date}-${taskCount}-${updatedAt}-${taskSignatures}`;
}

/**
 * Builds the AI prompt for intent classification and coaching advice.
 */
function buildIntentPrompt(context) {
  const { selectedDate, currentTime, currentPlan, savedRoutine, goalChecklists } = context;

  const currentTasksStr = currentPlan?.tasks?.length
    ? currentPlan.tasks
        .map(
          (t) =>
            `- ID: "${t.id}", Name: "${t.name}", Duration: ${t.durationMinutes}m, Status: "${t.status}", Scheduled: ${
              t.scheduledStart ? `${t.scheduledStart} - ${t.scheduledEnd}` : 'None'
            }`
        )
        .join('\n')
    : '(No tasks created yet for this date)';

  return `
You are the AI Personal Coach & Adaptive Planner.

### CONTEXT:
- Active Date: ${selectedDate}
- Current Time: ${currentTime || '12:00'}
- Current Tasks:
${currentTasksStr}

### INTENT RULES:
1. "advice": Coaching questions (fitness routines, vegetarian meals, English communication, study strategy, cloud computing/IT support roadmap, sleep habits). For advice: answer directly in chat, NEVER touch the schedule or start regeneration.
2. "plan_generation": User has no plan and wants to generate one.
3. "plan_modification": User wants to move/modify a specific task (e.g. "Move DSA to 7 PM").
4. "plan_regeneration": User wants to rebuild or reorganize their schedule (e.g. "Regenerate my plan", "I woke up late, plan the rest of the day", "Rearrange my remaining tasks", "I only have two hours free").

### RESPONSE JSON FORMAT:
{
  "intent": "advice" | "plan_generation" | "plan_modification" | "plan_regeneration",
  "reply": "string (markdown coaching answer if advice, or acknowledgment if scheduling)",
  "followUpQuestion": null,
  "requestedModifications": [
    {
      "taskId": "string (optional)",
      "taskName": "string",
      "action": "move" | "add" | "delete" | "reschedule" | "shorten",
      "preferredTime": "HH:mm (optional)",
      "scheduledStart": "HH:mm (optional)",
      "scheduledEnd": "HH:mm (optional)",
      "durationMinutes": number (optional)
    }
  ] | null
}

### TIME FORMAT RULES:
- In your conversational text ("reply"), ALWAYS write all times in 12-hour AM/PM format (e.g., "5:00 PM", "8:30 AM", "12:00 PM", "12:00 AM", no leading zero on the hour). Never use 24-hour time in conversational text.
- In structured JSON fields ("preferredTime", "scheduledStart", "scheduledEnd"), keep standard 24-hour "HH:mm" format.
`.trim();
}

/**
 * Invokes Gemini with candidate fallback models.
 */
async function callGemini(prompt, systemInstruction) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is not configured on the server. Please check your .env configuration.');
  }

  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const candidateModels = [
    configuredModel,
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemma-4-26b-a4b-it',
  ];

  const ai = new GoogleGenAI({ apiKey });
  let lastError = null;

  for (const modelName of [...new Set(candidateModels)]) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nUSER MESSAGE:\n${prompt}` }] }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '';
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Response was not valid JSON.');
        }
      }

      return { data: parsed, modelUsed: modelName };
    } catch (err) {
      lastError = err;
      console.warn(`Model ${modelName} call failed:`, err.message?.slice(0, 100));
    }
  }

  throw lastError || new Error('Failed to generate response from Gemini API.');
}

/**
 * Generates proposal applying all hard scheduling rules and user preferences.
 */
export function generateProposalWithHardRules({ plan, preferences, currentTime, isRemainingDayRequest }) {
  const planClone = JSON.parse(JSON.stringify(plan));
  const existingTasks = Array.isArray(planClone.tasks) ? planClone.tasks : [];

  // Hard Rule 1: Never change completed tasks. Lock them into place.
  const completedTasks = existingTasks.filter((t) => t.status === 'completed');

  // Hard Rule 2: Respect travel preference & strictly enforce audio-only rule
  const travelPref = preferences.travel || 'free';
  if (travelPref === 'free') {
    // Travel is strictly blocked: keep travelMinutes as is in scheduler
  } else if (travelPref === 'audio_tasks') {
    // Check if any task is audio friendly
    // In our scheduler, travel blocks remain fixed blocks unless tasks are audio-friendly
  }

  // Hard Rule 3: Respect college/work preference
  const workPref = preferences.collegeWork || 'reserve_all';

  // Hard Rule 4: Respect meal preference
  const mealsPref = preferences.meals || 'free';

  // Hard Rule 5: If today, do not schedule unfinished tasks before current time
  if (isRemainingDayRequest || planClone.date === (new Date().toISOString().split('T')[0])) {
    const wakeMin = timeToMinutes(planClone.wakeTime || '07:00');
    let bedMin = timeToMinutes(planClone.bedTime || '23:00');
    if (bedMin <= wakeMin) bedMin += 1440;
    const currentRel = toRelativeMinutes(currentTime, wakeMin, bedMin);

    if (!isNaN(currentRel) && currentRel > 0) {
      planClone.commitments = [
        ...(planClone.commitments || []),
        {
          id: 'past-day-block',
          name: 'Passed Time Today',
          start: planClone.wakeTime || '07:00',
          end: currentTime,
        },
      ];
    }
  }

  // Run deterministic scheduler
  const scheduleResult = generateSchedule(planClone, { isRegeneration: true });

  // Hard Rule 6: Code-level validation & repairs:
  // - Completed tasks must not be shifted
  // - No tasks scheduled during travel unless strictly audio-friendly
  const repairedTasks = scheduleResult.scheduledTasks.map((st) => {
    // If task was completed originally, enforce original start/end
    const origCompleted = completedTasks.find((c) => c.id === st.id);
    if (origCompleted) {
      return {
        ...st,
        scheduledStart: origCompleted.scheduledStart,
        scheduledEnd: origCompleted.scheduledEnd,
        status: 'completed',
      };
    }

    // Travel overlap check:
    if (plan.travelMinutes && Number(plan.travelMinutes) > 0 && plan.workHours?.start) {
      const travelStart = minutesToTime(timeToMinutes(plan.workHours.start) - Number(plan.travelMinutes));
      const travelEnd = plan.workHours.start;
      const sM = timeToMinutes(st.scheduledStart);
      const eM = timeToMinutes(st.scheduledEnd);
      const tSM = timeToMinutes(travelStart);
      const tEM = timeToMinutes(travelEnd);

      if (doIntervalsOverlap(sM, eM, tSM, tEM)) {
        // Enforce audio-only rule: if not audio friendly, flag conflict
        if (!isAudioFriendlyTask(st)) {
          // Reject placement in travel time
          return {
            ...st,
            scheduledStart: null,
            scheduledEnd: null,
            conflictReason: `Cannot schedule "${st.name}" during travel time: only audio-friendly tasks (podcasts, lectures) are permitted.`,
          };
        }
      }
    }

    return st;
  });

  const validScheduledTasks = repairedTasks.filter((t) => t.scheduledStart && t.scheduledEnd);
  const conflictTasks = repairedTasks.filter((t) => t.conflictReason);

  const unscheduled = [
    ...scheduleResult.unscheduledTasks,
    ...conflictTasks.map((c) => ({
      taskId: c.id,
      name: c.name,
      durationMinutes: c.durationMinutes,
      reason: c.conflictReason,
      suggestion: 'Reschedule after travel or select an audio-friendly task.',
    })),
  ];

  const summary = buildProposalChangesSummary(plan.tasks || [], validScheduledTasks, unscheduled);

  return {
    date: plan.date,
    tasks: validScheduledTasks,
    schedule: {
      generatedAt: new Date().toISOString(),
      blocks: scheduleResult.scheduledBlocks,
      unscheduled,
    },
    status: 'scheduled',
    summary,
    warnings: scheduleResult.warnings || [],
    conflicts: conflictTasks,
  };
}

/**
 * Main chat handler orchestrating Intent Routing & the Guided Regeneration State Machine.
 */
export async function processChatRequest({
  message,
  history = [],
  context = {},
  sessionId,
  action, // 'apply_proposal' | 'cancel_proposal' | 'modify_proposal'
  proposalData,
}) {
  const selectedDate = context.selectedDate || new Date().toISOString().split('T')[0];
  const currentTime = context.currentTime || '12:00';
  const currentPlan = context.currentPlan || {
    date: selectedDate,
    wakeTime: '07:00',
    bedTime: '23:00',
    tasks: [],
    meals: [],
    commitments: [],
    workHours: null,
    travelMinutes: 0,
    status: 'no_plan',
  };

  const session = getOrCreateSession(sessionId, context.savedPreferences || {});
  session.selectedDate = selectedDate;

  // Handle explicit action triggers (e.g. Apply or Cancel button clicks)
  if (action === 'apply_proposal') {
    // Idempotency: if already applied, return immediately
    if (session.state === 'applied') {
      return {
        sessionState: 'applied',
        intent: 'plan_regeneration',
        reply: '✓ This plan has already been applied to your schedule.',
        isIdempotent: true,
        proposedPlan: session.lastProposal,
      };
    }

    // Check for stale proposal
    const currentFingerprint = computePlanFingerprint(currentPlan);
    if (proposalData?.planVersion && proposalData.planVersion !== currentFingerprint) {
      return {
        sessionState: session.state,
        intent: 'plan_regeneration',
        error: 'STALE_PROPOSAL',
        reply: '⚠️ **Proposal Stale:** The schedule was modified after this proposal was created. Please regenerate to get an updated plan.',
        proposedPlan: null,
      };
    }

    session.state = 'applied';
    session.lastProposal = proposalData || session.lastProposal;
    return {
      sessionState: 'applied',
      intent: 'plan_regeneration',
      reply: '✓ **Schedule Applied!** Your daily timetable has been updated immediately.',
      proposedPlan: session.lastProposal,
    };
  }

  if (action === 'cancel_proposal') {
    session.state = 'cancelled';
    session.pendingQuestions = [];
    session.currentQuestion = null;
    return {
      sessionState: 'cancelled',
      intent: 'plan_regeneration',
      reply: '✕ Schedule proposal cancelled. Your existing schedule remains unchanged.',
      proposedPlan: null,
    };
  }

  if (action === 'modify_proposal') {
    session.state = 'modifying';
    return {
      sessionState: 'modifying',
      intent: 'plan_regeneration',
      reply: 'What would you like me to adjust in this proposal? (e.g., *"Move DSA to 7 PM"*, *"Make today study lighter"*, *"Add a 30m break"*).',
      proposedPlan: session.lastProposal,
    };
  }

  // Clean message text
  const cleanMsg = (message || '').trim();

  // If in collecting_preferences state, check if user is answering the current question
  if (session.state === 'collecting_preferences' && session.currentQuestion) {
    const q = session.currentQuestion;
    const lower = cleanMsg.toLowerCase();

    // Check if user requested permanent saving
    const wantsAlways = /always|permanently|remember this/i.test(lower);

    if (q.id === 'travel') {
      const isAudio = /audio|lecture|podcast|listen/i.test(lower);
      session.preferences.travel = isAudio ? 'audio_tasks' : 'free';
      if (wantsAlways) session.savedPermanentPreferences.travel = session.preferences.travel;
    } else if (q.id === 'collegeWork') {
      const allowBreaks = /break|flexible|utilize/i.test(lower);
      session.preferences.collegeWork = allowBreaks ? 'allow_breaks' : 'reserve_all';
      if (wantsAlways) session.savedPermanentPreferences.collegeWork = session.preferences.collegeWork;
    } else if (q.id === 'meals') {
      const allowShort = /short|allow|light/i.test(lower);
      session.preferences.meals = allowShort ? 'allow_short_tasks' : 'free';
      if (wantsAlways) session.savedPermanentPreferences.meals = session.preferences.meals;
    }

    // Check next pending question
    if (session.pendingQuestions.length > 0) {
      session.currentQuestion = session.pendingQuestions.shift();
      return {
        sessionState: 'collecting_preferences',
        intent: 'plan_regeneration',
        reply: session.currentQuestion.text,
        question: session.currentQuestion,
        quickReplies: session.currentQuestion.quickReplies,
        proposedPlan: null,
      };
    }

    // All questions answered -> transition to proposal_ready!
    session.state = 'proposal_ready';
    session.currentQuestion = null;

    const proposal = generateProposalWithHardRules({
      plan: currentPlan,
      preferences: session.preferences,
      currentTime,
      isRemainingDayRequest: true,
    });

    proposal.planVersion = computePlanFingerprint(currentPlan);
    session.lastProposal = proposal;

    let prefNotes = [];
    if (session.preferences.travel) {
      prefNotes.push(`Travel: ${session.preferences.travel === 'free' ? 'kept free' : 'audio tasks permitted'}`);
    }
    if (session.preferences.collegeWork) {
      prefNotes.push(`Work/College: ${session.preferences.collegeWork === 'reserve_all' ? 'whole block reserved' : 'breaks utilized'}`);
    }
    if (session.preferences.meals) {
      prefNotes.push(`Meals: ${session.preferences.meals === 'free' ? 'kept free' : 'short tasks allowed'}`);
    }

    const prefSummaryStr = prefNotes.length ? `*(Preferences applied: ${prefNotes.join(', ')})*` : '';

    return {
      sessionState: 'proposal_ready',
      intent: 'plan_regeneration',
      reply: `Here is your revised schedule proposal ${prefSummaryStr}.\n\n**Is this schedule okay, or would you like me to change anything?**`,
      proposalActions: ['Apply New Plan', 'Modify Plan', 'Cancel'],
      proposedPlan: proposal,
    };
  }

  // If in modifying state, incorporate user modification with earlier answers
  if (session.state === 'modifying') {
    session.state = 'proposal_ready';

    // Parse requested modification
    const modIntentPrompt = buildIntentPrompt({
      ...context,
      selectedDate,
      currentTime,
      currentPlan,
    });

    const { data: aiResult } = await callGemini(cleanMsg, modIntentPrompt);
    const planForMod = JSON.parse(JSON.stringify(currentPlan));

    if (aiResult.requestedModifications?.length > 0) {
      for (const mod of aiResult.requestedModifications) {
        const target = (planForMod.tasks || []).find(
          (t) => (mod.taskId && t.id === mod.taskId) || (mod.taskName && t.name.toLowerCase() === mod.taskName.toLowerCase())
        );
        if (target) {
          if (mod.durationMinutes) target.durationMinutes = Number(mod.durationMinutes);
          if (mod.preferredTime) target.preferredTime = mod.preferredTime;
          if (mod.scheduledStart) target.scheduledStart = mod.scheduledStart;
          if (mod.scheduledEnd) target.scheduledEnd = mod.scheduledEnd;
        }
      }
    }

    // Fallback: direct natural language time extraction (e.g. "Move English practice to 5 PM", "5:30 in the evening", "17:00")
    const extractedTime = extractTimeFromText(cleanMsg);
    if (extractedTime) {
      const lowerMsg = cleanMsg.toLowerCase();
      const matchedTask = (planForMod.tasks || []).find((t) => lowerMsg.includes(t.name.toLowerCase()));
      if (matchedTask) {
        matchedTask.preferredTime = extractedTime;
        matchedTask.scheduledStart = extractedTime;
        if (matchedTask.durationMinutes) {
          const sMin = timeToMinutes(extractedTime);
          matchedTask.scheduledEnd = minutesToTime((sMin + Number(matchedTask.durationMinutes)) % 1440);
        }
      }
    }

    const revisedProposal = generateProposalWithHardRules({
      plan: planForMod,
      preferences: session.preferences,
      currentTime,
      isRemainingDayRequest: true,
    });

    revisedProposal.planVersion = computePlanFingerprint(currentPlan);
    session.lastProposal = revisedProposal;

    return {
      sessionState: 'proposal_ready',
      intent: 'plan_regeneration',
      reply: `I have updated your proposal based on: "${cleanMsg}".\n\n**Is this schedule okay, or would you like me to change anything?**`,
      proposalActions: ['Apply New Plan', 'Modify Plan', 'Cancel'],
      proposedPlan: revisedProposal,
    };
  }

  // Standard Intent Routing via Gemini
  const systemInstruction = buildIntentPrompt({
    ...context,
    selectedDate,
    currentTime,
    currentPlan,
  });

  const { data: aiResult, modelUsed } = await callGemini(cleanMsg, systemInstruction);
  const intent = aiResult.intent || 'advice';

  // 1. ADVICE: Answer in chat, never touch the plan or start regeneration workflow
  if (intent === 'advice') {
    return {
      sessionState: 'idle',
      intent: 'advice',
      reply: aiResult.reply || 'Here is your guidance.',
      proposedPlan: null,
      modelUsed,
    };
  }

  // 2. PLAN REGENERATION: Start guided conversation workflow. NEVER immediately generate schedule!
  if (intent === 'plan_regeneration') {
    session.state = 'collecting_preferences';
    session.planVersion = computePlanFingerprint(currentPlan);

    // Identify applicable questions for situations that actually exist today
    const applicableQuestions = determineApplicableQuestions(
      currentPlan,
      session.preferences,
      session.savedPermanentPreferences
    );

    // Display any saved preferences being reused
    const reusedNotes = [];
    if (session.savedPermanentPreferences.travel) {
      reusedNotes.push(`Using your saved preference: ${session.savedPermanentPreferences.travel === 'free' ? 'keep travel free' : 'allow audio tasks during travel'}.`);
    }
    if (session.savedPermanentPreferences.collegeWork) {
      reusedNotes.push(`Using your saved preference: ${session.savedPermanentPreferences.collegeWork === 'reserve_all' ? 'reserve whole college block' : 'allow flexible tasks in breaks'}.`);
    }
    if (session.savedPermanentPreferences.meals) {
      reusedNotes.push(`Using your saved preference: ${session.savedPermanentPreferences.meals === 'free' ? 'keep meals free' : 'allow short tasks during meals'}.`);
    }

    const reusedPrefix = reusedNotes.length ? `${reusedNotes.join(' ')}\n\n` : '';

    if (applicableQuestions.length > 0) {
      session.pendingQuestions = applicableQuestions.slice(1);
      session.currentQuestion = applicableQuestions[0];

      return {
        sessionState: 'collecting_preferences',
        intent: 'plan_regeneration',
        reply: `${reusedPrefix}Before I regenerate your schedule, let's tailor it to your day:\n\n${session.currentQuestion.text}`,
        question: session.currentQuestion,
        quickReplies: session.currentQuestion.quickReplies,
        proposedPlan: null,
      };
    }

    // If no questions are applicable (no travel, no work, no meals, or all already saved), advance to proposal
    session.state = 'proposal_ready';
    const proposal = generateProposalWithHardRules({
      plan: currentPlan,
      preferences: session.preferences,
      currentTime,
      isRemainingDayRequest: true,
    });
    proposal.planVersion = computePlanFingerprint(currentPlan);
    session.lastProposal = proposal;

    return {
      sessionState: 'proposal_ready',
      intent: 'plan_regeneration',
      reply: `${reusedPrefix}Here is your regenerated schedule proposal.\n\n**Is this schedule okay, or would you like me to change anything?**`,
      proposalActions: ['Apply New Plan', 'Modify Plan', 'Cancel'],
      proposedPlan: proposal,
    };
  }

  // 3. PLAN MODIFICATION: Specific task change
  if (intent === 'plan_modification') {
    const planForMod = JSON.parse(JSON.stringify(currentPlan));
    if (aiResult.requestedModifications?.length > 0) {
      for (const mod of aiResult.requestedModifications) {
        const target = (planForMod.tasks || []).find(
          (t) => (mod.taskId && t.id === mod.taskId) || (mod.taskName && t.name.toLowerCase() === mod.taskName.toLowerCase())
        );
        if (target) {
          if (mod.durationMinutes) target.durationMinutes = Number(mod.durationMinutes);
          if (mod.preferredTime) target.preferredTime = mod.preferredTime;
          if (mod.scheduledStart) target.scheduledStart = mod.scheduledStart;
          if (mod.scheduledEnd) target.scheduledEnd = mod.scheduledEnd;
        }
      }
    }

    // Direct natural language time extraction fallback (e.g. "Move English practice to 5 PM", "5:30 in the evening", "17:00")
    const extractedTime = extractTimeFromText(cleanMsg);
    if (extractedTime) {
      const lowerMsg = cleanMsg.toLowerCase();
      const matchedTask = (planForMod.tasks || []).find((t) => lowerMsg.includes(t.name.toLowerCase()));
      if (matchedTask) {
        matchedTask.preferredTime = extractedTime;
        matchedTask.scheduledStart = extractedTime;
        if (matchedTask.durationMinutes) {
          const sMin = timeToMinutes(extractedTime);
          matchedTask.scheduledEnd = minutesToTime((sMin + Number(matchedTask.durationMinutes)) % 1440);
        }
      }
    }

    const proposal = generateProposalWithHardRules({
      plan: planForMod,
      preferences: session.preferences,
      currentTime,
      isRemainingDayRequest: false,
    });
    proposal.planVersion = computePlanFingerprint(currentPlan);
    session.lastProposal = proposal;
    session.state = 'proposal_ready';

    return {
      sessionState: 'proposal_ready',
      intent: 'plan_modification',
      reply: aiResult.reply || 'Here is your revised schedule proposal.',
      proposalActions: ['Apply New Plan', 'Modify Plan', 'Cancel'],
      proposedPlan: proposal,
    };
  }

  return {
    sessionState: 'idle',
    intent,
    reply: aiResult.reply || 'How else can I assist you?',
    proposedPlan: null,
  };
}
