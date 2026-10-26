import { GoogleGenAI } from '@google/genai';
import {
  timeToMinutes,
  minutesToTime,
  checkIntervalConflict,
  isWithinWakeHours,
  doIntervalsOverlap,
} from '../../../shared/conflictEngine.js';
import {
  generateSchedule,
  toRelativeMinutes,
  fromRelativeMinutes,
  subtractIntervals,
} from '../../../client/src/utils/scheduler.js';
import { generateId, formatTime12h } from '../../../client/src/utils/dateUtils.js';

/**
 * SECTION 8: GEMINI SYSTEM INSTRUCTION
 * Verbatim text required by specification.
 */
export const GEMINI_SYSTEM_INSTRUCTION = `You are the personal planning assistant inside the Adaptive AI Life Planner. Create realistic daily timetables, modify schedules, and regenerate plans based on the user's situation, preferences, completed tasks, and unfinished tasks.

Rules:
1. Never apply changes yourself. Only propose; the user approves.
2. For regeneration, review the current timetable first. Preserve completed tasks, fixed commitments, and task ids.
3. Ask short, relevant questions only if essential information is missing. Do not repeat questions already answered or saved. Never invent personal details.
4. Never create overlapping tasks. Do not assume college or work breaks are free unless confirmed. Do not schedule during reserved meal or sleep periods. Suggest only travel-appropriate activities while traveling.
5. Use realistic durations and breaks. Do not fill every free minute or add unnecessary tasks.
6. Never mark a task completed unless the user says so. Never silently discard unfinished tasks; reschedule them, explain if there is no room, or ask what to prioritize.
7. For advice-only requests, give advice without changing the timetable.
8. If constraints conflict, explain the conflict and ask which task or preference takes priority.
9. When all tasks are complete, congratulate the user and offer: finish for the day, review achievements, or create a new plan.
10. Always respond in the required JSON schema. Keep conversational text separate from timetable data. Never claim the Dashboard was updated; only the application can confirm that.
11. Always write times in 12-hour AM/PM format (e.g., "5:00 PM", "8:30 AM", "12:00 PM", "12:00 AM", no leading zero on the hour) whenever mentioning times in your conversational message text, explanations, or questions. Never use 24-hour time in conversational text. Keep all structured JSON fields (such as startTime, endTime) strictly in 24-hour "HH:mm" format.`;

/**
 * JSON Schema specification appended to the system instruction.
 */
export const GEMINI_RESPONSE_SCHEMA_INSTRUCTION = `
You must respond with a JSON object strictly matching this schema:
{
  "type": "question" | "proposal" | "advice" | "info",
  "message": string,                 // conversational text only, no timetable data inside
  "questions": string[],             // list of questions when type is "question", empty array otherwise
  "proposal": {
    "date": "YYYY-MM-DD",
    "tasks": [{
      "id": string | null,           // existing id preserved; null for new tasks
      "title": string,
      "startTime": "HH:mm",
      "endTime": "HH:mm",
      "durationMinutes": number,
      "status": "pending" | "completed",
      "fixed": boolean,
      "notes": string | null
    }],
    "summary": {
      "retained": string[],
      "moved": string[],
      "added": string[],
      "removed": string[],
      "unscheduled": [{ "title": string, "reason": string }]
    },
    "conflicts": string[]
  } | null
}

Response rules:
- Keep "message" strictly conversational text. Do not put markdown tables or ASCII timetables inside "message".
- All times mentioned inside "message" or "questions" MUST be in 12-hour AM/PM format with no leading zero on the hour (e.g. "5:00 PM", "8:30 AM", "12:00 PM"). Structured schema fields ("startTime", "endTime") MUST remain in standard 24-hour "HH:mm" format.
- When proposing changes, set "type": "proposal" and populate "proposal".
- When essential information is missing, set "type": "question", explain in "message", list questions in "questions", and set "proposal": null.
- When the user asks for coaching/advice (e.g., how to improve English or diet tips), set "type": "advice" and "proposal": null.
- When acknowledging, congratulating (e.g. all tasks complete), or explaining, set "type": "info" and offer the user choices.
- Preserve all existing task IDs when modifying or retaining tasks.
- Never schedule overlapping tasks, and never schedule during meals, sleep, or college/work.
`;

/**
 * Builds the full context payload sent to Gemini on every request.
 */
export function buildGeminiContext({
  selectedDate,
  currentTime,
  currentPlan,
  savedRoutine,
  goalChecklists,
  savedPreferences,
  pendingProposal,
  recentTurns = [],
  activePage = 'dashboard',
  nutrition,
}) {
  const wakeTime = currentPlan?.wakeTime || savedRoutine?.wakeTime || '07:00';
  const bedTime = currentPlan?.bedTime || savedRoutine?.bedTime || '23:00';
  const workHours = currentPlan?.workHours || savedRoutine?.workHours || null;
  const meals = currentPlan?.meals || savedRoutine?.meals || [];
  const travel = currentPlan?.travel || savedRoutine?.travel || null;
  const travelMinutes = currentPlan?.travelMinutes ?? savedRoutine?.travelMinutes ?? 0;
  const commitments = currentPlan?.commitments || savedRoutine?.commitments || [];

  const existingTasks = (currentPlan?.tasks || []).map((t) => ({
    id: t.id,
    title: t.name || t.title,
    startTime: t.scheduledStart || t.startTime || null,
    endTime: t.scheduledEnd || t.endTime || null,
    durationMinutes: Number(t.durationMinutes) || 30,
    status: t.status || 'pending',
    fixed: Boolean(t.fixed || t.isFixed),
    notes: t.notes || null,
  }));

  // Format active goals with deadlines
  const activeGoals = [];
  if (goalChecklists) {
    for (const [category, items] of Object.entries(goalChecklists)) {
      if (Array.isArray(items)) {
        items.forEach((g) => {
          if (!g.completed) {
            activeGoals.push({
              category,
              title: g.title,
              deadline: g.deadlineDate ? `${g.deadlineDate} ${g.deadlineTime || ''}`.trim() : null,
            });
          }
        });
      }
    }
  }

  return {
    todayDate: selectedDate,
    currentTime,
    routine: {
      wakeTime,
      bedTime,
      workHours,
      travel: {
        enabled: Boolean(travel?.enabled || travelMinutes > 0),
        minutes: travelMinutes,
        details: travel,
      },
      meals,
      commitments,
    },
    preferences: savedPreferences || {},
    currentTimetable: {
      date: selectedDate,
      tasks: existingTasks,
      completedCount: existingTasks.filter((t) => t.status === 'completed').length,
      pendingCount: existingTasks.filter((t) => t.status !== 'completed').length,
      allCompleted: existingTasks.length > 0 && existingTasks.every((t) => t.status === 'completed'),
    },
    activeGoals,
    pendingProposal: pendingProposal || null,
    recentChatTurns: recentTurns.slice(-8),
    activePage: activePage || 'dashboard',
    nutrition: nutrition || null,
  };
}

/**
 * Validates a proposal against Section 5 hard scheduling rules.
 * Returns { valid: true } or { valid: false, errors: string[], conflicts: string[] }
 */
export function validatePlannerProposal(proposal, context) {
  if (!proposal) {
    return { valid: false, errors: ['Proposal object is required.'] };
  }

  const errors = [];
  const conflicts = [];

  const { date, tasks, summary } = proposal;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('Proposal date must be in YYYY-MM-DD format.');
  }

  if (!Array.isArray(tasks)) {
    errors.push('Proposal tasks must be an array.');
    return { valid: false, errors, conflicts };
  }

  const { routine, currentTimetable } = context;
  const wakeTime = routine?.wakeTime || '07:00';
  const bedTime = routine?.bedTime || '23:00';
  const wakeMin = timeToMinutes(wakeTime);
  let bedMin = timeToMinutes(bedTime);
  if (bedMin <= wakeMin) bedMin += 1440;

  // 1. Time formats, start < end, duration match
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const taskIntervals = [];

  for (const t of tasks) {
    if (!t.title || typeof t.title !== 'string') {
      errors.push(`Task missing valid title: ${JSON.stringify(t)}`);
      continue;
    }

    if (!timeRegex.test(t.startTime) || !timeRegex.test(t.endTime)) {
      errors.push(`Task "${t.title}" has invalid time format (${t.startTime} - ${t.endTime}). Use HH:mm.`);
      continue;
    }

    const s = timeToMinutes(t.startTime);
    let e = timeToMinutes(t.endTime);
    if (e <= s) {
      errors.push(`Task "${t.title}" end time (${t.endTime}) must be after start time (${t.startTime}).`);
      continue;
    }

    const duration = e - s;
    if (t.durationMinutes && Number(t.durationMinutes) !== duration) {
      errors.push(`Task "${t.title}" duration (${t.durationMinutes}m) does not match start-end interval (${duration}m).`);
    }

    taskIntervals.push({
      id: t.id,
      title: t.title,
      start: s,
      end: e,
      startTime: t.startTime,
      endTime: t.endTime,
      fixed: Boolean(t.fixed),
      status: t.status,
    });
  }

  // 2. No overlapping tasks
  for (let i = 0; i < taskIntervals.length; i++) {
    for (let j = i + 1; j < taskIntervals.length; j++) {
      const a = taskIntervals[i];
      const b = taskIntervals[j];
      if (Math.max(a.start, b.start) < Math.min(a.end, b.end)) {
        const overlapMsg = `Task overlap: "${a.title}" (${a.startTime}-${a.endTime}) overlaps with "${b.title}" (${b.startTime}-${b.endTime}).`;
        errors.push(overlapMsg);
        conflicts.push(overlapMsg);
      }
    }
  }

  // 3. Fixed commitments unchanged & not overlapped
  const fixedBlocks = [];
  if (routine?.workHours?.enabled && routine.workHours.start && routine.workHours.end) {
    fixedBlocks.push({
      title: routine.workHours.label || 'College / Classes',
      startTime: routine.workHours.start,
      endTime: routine.workHours.end,
      start: timeToMinutes(routine.workHours.start),
      end: timeToMinutes(routine.workHours.end),
    });
  }
  if (Array.isArray(routine?.meals)) {
    routine.meals.forEach((m) => {
      if (m.start && m.end) {
        fixedBlocks.push({
          title: m.name || 'Meal',
          startTime: m.start,
          endTime: m.end,
          start: timeToMinutes(m.start),
          end: timeToMinutes(m.end),
        });
      }
    });
  }
  if (Array.isArray(routine?.commitments)) {
    routine.commitments.forEach((c) => {
      if (c.start && c.end) {
        fixedBlocks.push({
          title: c.name || 'Commitment',
          startTime: c.start,
          endTime: c.end,
          start: timeToMinutes(c.start),
          end: timeToMinutes(c.end),
        });
      }
    });
  }

  // Check no non-fixed task overlaps fixed commitments or meal/sleep periods
  for (const t of taskIntervals) {
    for (const fb of fixedBlocks) {
      if (Math.max(t.start, fb.start) < Math.min(t.end, fb.end)) {
        // If this task is NOT the fixed commitment itself
        if (t.title.toLowerCase() !== fb.title.toLowerCase()) {
          const cMsg = `Task "${t.title}" (${t.startTime}-${t.endTime}) overlaps with fixed "${fb.title}" (${fb.startTime}-${fb.endTime}).`;
          errors.push(cMsg);
          conflicts.push(cMsg);
        }
      }
    }

    // Check outside wake hours (sleep period)
    const withinWake = isWithinWakeHours(t.startTime, t.endTime, wakeTime, bedTime);
    if (!withinWake) {
      const sMsg = `Task "${t.title}" (${t.startTime}-${t.endTime}) is scheduled during sleep hours (outside ${wakeTime} - ${bedTime}).`;
      errors.push(sMsg);
      conflicts.push(sMsg);
    }
  }

  // 4. Completed tasks unchanged and not removed; no task newly marked completed by AI
  const currentTasks = currentTimetable?.tasks || [];
  const completedCurrent = currentTasks.filter((t) => t.status === 'completed');

  for (const comp of completedCurrent) {
    const proposed = tasks.find((t) => t.id === comp.id || (comp.id == null && t.title === comp.title));
    if (!proposed) {
      errors.push(`Completed task "${comp.title}" was removed in proposal. Completed tasks must be preserved.`);
      continue;
    }
    if (proposed.status !== 'completed') {
      errors.push(`Completed task "${comp.title}" had its status changed to "${proposed.status}". Completed status must not be modified.`);
    }
    if (comp.startTime && proposed.startTime !== comp.startTime) {
      errors.push(`Completed task "${comp.title}" was moved from ${comp.startTime} to ${proposed.startTime}. Completed tasks must remain unchanged.`);
    }
  }

  // Verify no pending task was arbitrarily marked completed
  for (const t of tasks) {
    if (t.status === 'completed') {
      const orig = currentTasks.find((ct) => ct.id === t.id);
      if (orig && orig.status === 'pending') {
        errors.push(`Task "${t.title}" was changed from pending to completed. The AI must never mark a task completed unless user says so.`);
      }
    }
  }

  // 5. Existing task IDs preserved; no duplicates created
  const idCounts = {};
  for (const t of tasks) {
    if (t.id) {
      idCounts[t.id] = (idCounts[t.id] || 0) + 1;
      if (idCounts[t.id] > 1) {
        errors.push(`Duplicate task ID "${t.id}" found in proposal.`);
      }
    }
  }

  // 6. Day availability check
  const totalWakingMinutes = bedMin - wakeMin;
  const totalTaskMinutes = taskIntervals.reduce((acc, t) => acc + (t.end - t.start), 0);
  if (totalTaskMinutes > totalWakingMinutes) {
    errors.push(`Total scheduled tasks (${totalTaskMinutes}m) exceed available waking time (${totalWakingMinutes}m).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    conflicts,
  };
}

/**
 * Normalizes and builds a proposal object to ensure all required fields are present.
 */
export function normalizeProposal(rawProposal, context) {
  if (!rawProposal || typeof rawProposal !== 'object') return null;

  const date = rawProposal.date || context.todayDate;
  const tasks = Array.isArray(rawProposal.tasks) ? rawProposal.tasks : [];
  const currentTasks = context.currentTimetable?.tasks || [];

  // Map and sanitize tasks
  const normalizedTasks = tasks.map((t) => {
    // Preserve existing id if matched by title
    let matchedId = t.id || null;
    if (!matchedId) {
      const match = currentTasks.find((ct) => (ct.title || ct.name || '').toLowerCase() === (t.title || '').toLowerCase());
      if (match) matchedId = match.id;
    }

    const s = t.startTime || '09:00';
    const e = t.endTime || '09:30';
    const dur = Number(t.durationMinutes) || Math.max(15, timeToMinutes(e) - timeToMinutes(s));

    return {
      id: matchedId,
      title: t.title || 'Task',
      startTime: s,
      endTime: e,
      durationMinutes: dur,
      status: t.status === 'completed' ? 'completed' : 'pending',
      fixed: Boolean(t.fixed),
      notes: t.notes || null,
    };
  });

  // Calculate clean diff summary
  const retained = [];
  const moved = [];
  const added = [];
  const removed = [];
  const unscheduled = Array.isArray(rawProposal.summary?.unscheduled)
    ? rawProposal.summary.unscheduled.map((u) => ({
        title: u.title || u.name || 'Task',
        reason: u.reason || 'Could not fit in available free slots',
      }))
    : [];

  for (const nt of normalizedTasks) {
    const orig = currentTasks.find((ct) => ct.id === nt.id || (ct.title || ct.name || '').toLowerCase() === nt.title.toLowerCase());
    if (!orig) {
      added.push(nt.title);
    } else if (orig.startTime !== nt.startTime || orig.endTime !== nt.endTime) {
      moved.push(`${nt.title} (${orig.startTime ? formatTime12h(orig.startTime) : 'unscheduled'} → ${formatTime12h(nt.startTime)})`);
    } else {
      retained.push(nt.title);
    }
  }

  for (const ot of currentTasks) {
    const stillExists = normalizedTasks.some((nt) => nt.id === ot.id || nt.title.toLowerCase() === (ot.title || ot.name || '').toLowerCase());
    if (!stillExists) {
      removed.push(ot.title || ot.name || 'Task');
    }
  }

  return {
    date,
    tasks: normalizedTasks,
    summary: {
      retained: rawProposal.summary?.retained || retained,
      moved: rawProposal.summary?.moved || moved,
      added: rawProposal.summary?.added || added,
      removed: rawProposal.summary?.removed || removed,
      unscheduled,
    },
    conflicts: Array.isArray(rawProposal.conflicts) ? rawProposal.conflicts : [],
  };
}

/**
 * Server-side AI planner service.
 * Handles chat requests, Gemini invocation with JSON mode, validation, retries, and fallback.
 */
export async function processPlannerChat({
  message = '',
  history = [],
  context = {},
  sessionId = null,
  action = null,
  proposalData = null,
}) {
  const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

  // Handle explicit actions like cancel_proposal or apply_proposal
  if (action === 'cancel_proposal') {
    return {
      type: 'info',
      message: 'Schedule proposal cancelled. Your existing timetable was left completely unchanged.',
      questions: [],
      proposal: null,
      reply: 'Schedule proposal cancelled. Your existing timetable was left completely unchanged.',
      intent: 'info',
      sessionState: 'cancelled',
    };
  }

  if (action === 'apply_proposal') {
    return {
      type: 'info',
      message: 'Schedule proposal accepted and ready to save.',
      questions: [],
      proposal: proposalData || null,
      reply: 'Schedule proposal accepted and ready to save.',
      intent: 'info',
      sessionState: 'applied',
    };
  }

  // Build the rich context for Gemini
  const plannerContext = buildGeminiContext({
    selectedDate: context.selectedDate || new Date().toISOString().slice(0, 10),
    currentTime: context.currentTime || '08:00',
    currentPlan: context.currentPlan,
    savedRoutine: context.savedRoutine,
    goalChecklists: context.goalChecklists,
    savedPreferences: context.savedPreferences,
    pendingProposal: proposalData || context.pendingProposal,
    recentTurns: history,
    activePage: context.activePage || 'dashboard',
    nutrition: context.nutrition,
  });

  // If no Gemini key is configured, provide graceful advice / manual instructions
  if (!apiKey) {
    return {
      type: 'info',
      message:
        '⚠️ **Gemini API Key Required for AI Planning**\n\nThe AI planner is running in manual mode because `GEMINI_API_KEY` is not set in `.env`.\nYou can create and manage your timetable directly on the **Dashboard** using manual task creation and routine settings.',
      questions: [],
      proposal: null,
      reply:
        '⚠️ **Gemini API Key Required for AI Planning**\n\nThe AI planner is running in manual mode because `GEMINI_API_KEY` is not set in `.env`.\nYou can create and manage your timetable directly on the **Dashboard** using manual task creation and routine settings.',
      intent: 'info',
      canEditManually: true,
    };
  }

  // Prepare Gemini prompt
  const userPrompt = `
CURRENT REALITY & CONTEXT:
${JSON.stringify(plannerContext, null, 2)}

ACTIVE MODULE/SCREEN: "${plannerContext.activePage}"

USER MESSAGE:
"${message}"

PENDING PROPOSAL BEING MODIFIED:
${plannerContext.pendingProposal ? JSON.stringify(plannerContext.pendingProposal, null, 2) : 'None'}

INSTRUCTIONS:
- Review current timetable, routine, active goals, and the user's active module ("${plannerContext.activePage}").
- If the user asks questions relevant to the active module (e.g. study guidance on the study planner, career roadmap on career planner, nutrition tips on diet page, workout routines on fitness page, habits on habit tracker), provide tailored, domain-appropriate advice.
- If the user asks for advice or information only (e.g. learning English, fitness advice, diet ideas), return type "advice" with proposal: null.
- If essential information is missing to create/regenerate a timetable, return type "question", list the questions, and proposal: null.
- If all tasks are completed, congratulate them and offer: Finish for the day, Review achievements, or Create a new plan.
- If proposing or regenerating a timetable, return type "proposal" with a complete, conflict-free timetable and accurate summary.
- If user requests a conflict (e.g., move task into college hours or meal times), explain the conflict clearly in message and ask which takes priority.
`;

  const ai = new GoogleGenAI({ apiKey });
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
  const modelsToTry = [...new Set([configuredModel, 'gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-flash-latest'])];

  let rawResult = null;
  let lastError = null;

  // Primary attempt and single retry loop
  for (let attempt = 1; attempt <= 2; attempt++) {
    const isRetry = attempt === 2;
    const promptToSend = isRetry
      ? `${userPrompt}\n\nNOTE: Your previous response was invalid. Ensure strict valid JSON matching schema, non-overlapping tasks, and no conflicts.`
      : userPrompt;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${GEMINI_SYSTEM_INSTRUCTION}\n\n${GEMINI_RESPONSE_SCHEMA_INSTRUCTION}\n\n${promptToSend}`,
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });

        const text = response.text?.trim() || '';
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr) {
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            throw new Error(`Invalid JSON returned: ${text.slice(0, 100)}`);
          }
        }

        if (parsed && typeof parsed === 'object') {
          rawResult = parsed;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} on model ${model} failed:`, err.message?.slice(0, 120));
      }
    }

    if (rawResult) {
      // Validate proposal if returned
      if (rawResult.type === 'proposal' && rawResult.proposal) {
        const normalized = normalizeProposal(rawResult.proposal, plannerContext);
        const val = validatePlannerProposal(normalized, plannerContext);

        if (!val.valid) {
          console.warn(`Proposal validation failed on attempt ${attempt}:`, val.errors);
          if (attempt === 1) {
            // Trigger retry with feedback
            rawResult = null;
            continue;
          } else {
            // Fallback gracefully on attempt 2: explain conflict instead of proposing invalid schedule
            return {
              type: 'question',
              message: `I encountered scheduling conflicts while arranging your timetable:\n\n${val.errors.map((e) => `• ${e}`).join('\n')}\n\nWhich task or preference would you like to prioritize?`,
              questions: ['Which task takes priority?'],
              proposal: null,
              reply: `I encountered scheduling conflicts while arranging your timetable:\n\n${val.errors.map((e) => `• ${e}`).join('\n')}\n\nWhich task or preference would you like to prioritize?`,
              intent: 'question',
            };
          }
        }

        rawResult.proposal = normalized;
      }
      break;
    }
  }

  // Graceful fallback if Gemini completely failed or timed out
  if (!rawResult) {
    return {
      type: 'info',
      message: `I could not generate an AI timetable right now (${lastError?.message || 'Server timeout'}). Your current timetable is untouched. You can retry or edit tasks manually on the Dashboard.`,
      questions: [],
      proposal: null,
      reply: `I could not generate an AI timetable right now (${lastError?.message || 'Server timeout'}). Your current timetable is untouched. You can retry or edit tasks manually on the Dashboard.`,
      intent: 'info',
      canRetry: true,
      canEditManually: true,
    };
  }

  // Format canonical response matching Section 4
  const finalType = ['question', 'proposal', 'advice', 'info'].includes(rawResult.type) ? rawResult.type : 'info';
  const finalMessage = rawResult.message || rawResult.reply || '';
  const finalQuestions = Array.isArray(rawResult.questions) ? rawResult.questions : [];
  const finalProposal = finalType === 'proposal' && rawResult.proposal ? rawResult.proposal : null;

  return {
    type: finalType,
    message: finalMessage,
    questions: finalQuestions,
    proposal: finalProposal,
    // Provide legacy backward-compatible keys so existing client and tests keep working seamlessly
    reply: finalMessage,
    intent: finalType,
    proposedPlan: finalProposal,
    followUpQuestion: finalQuestions[0] || null,
  };
}
