/**
 * Pure Deterministic Scheduler Engine
 * Operates on linear minutes relative to wake-up time to support overnight schedules.
 * Output blocks for tasks store ONLY { id, type: 'task', taskId, start, end }
 * so the live task record remains the single source of truth.
 */

import { timeToMinutes, minutesToTime } from '../../../shared/conflictEngine.js';
import { generateId } from './dateUtils.js';

export const BREAK_CONFIG = {
  LONG_THRESHOLD_MINS: 90,
  LONG_BREAK_MINS: 15,
  MEDIUM_THRESHOLD_MINS: 60,
  MEDIUM_BREAK_MINS: 10,
};

/**
 * Converts a 24h clock time string (HH:mm) into minutes relative to wakeTime.
 * @param {string} timeStr - "HH:mm"
 * @param {number} wakeMin - wake-up time in minutes from midnight (0..1439)
 * @param {number} bedMin - bedtime in minutes from midnight (can be >= 1440 if overnight)
 * @returns {number} relative minutes from wake time, or NaN
 */
export function toRelativeMinutes(timeStr, wakeMin, bedMin) {
  const m = timeToMinutes(timeStr);
  if (isNaN(m) || isNaN(wakeMin) || isNaN(bedMin)) return NaN;

  if (m >= wakeMin) {
    return m - wakeMin;
  }
  // If time is earlier than wake-up and schedule wraps past midnight
  if (bedMin > 1440 && m + 1440 <= bedMin) {
    return m + 1440 - wakeMin;
  }
  // Otherwise it falls before wake-up (e.g. sleep period)
  return m - wakeMin;
}

/**
 * Converts relative minutes back to 24h "HH:mm" clock string.
 * @param {number} relMin - relative minutes from wake time
 * @param {number} wakeMin - wake-up time in minutes from midnight
 * @returns {string} "HH:mm"
 */
export function fromRelativeMinutes(relMin, wakeMin) {
  if (isNaN(relMin) || isNaN(wakeMin)) return '00:00';
  const total = wakeMin + Math.floor(relMin);
  if (total === 1440) return '24:00';
  const normalized = ((total % 1440) + 1440) % 1440;
  return minutesToTime(normalized);
}

/**
 * Subtracts a list of blocked intervals [start, end) from an initial set of free intervals.
 * All intervals are in relative minutes.
 * @param {Array<[number, number]>} freeWindows
 * @param {Array<[number, number]>} blockedList
 * @returns {Array<[number, number]>}
 */
export function subtractIntervals(freeWindows, blockedList) {
  let result = [...freeWindows];

  for (const [bStart, bEnd] of blockedList) {
    if (bEnd <= bStart) continue;
    const nextResult = [];
    for (const [fStart, fEnd] of result) {
      if (bEnd <= fStart || bStart >= fEnd) {
        // No overlap
        nextResult.push([fStart, fEnd]);
      } else {
        // Overlap: split
        if (fStart < bStart) {
          nextResult.push([fStart, bStart]);
        }
        if (bEnd < fEnd) {
          nextResult.push([bEnd, fEnd]);
        }
      }
    }
    result = nextResult;
  }

  // Sort and filter out zero-length intervals
  return result
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Intersects two sets of intervals.
 * @param {Array<[number, number]>} listA
 * @param {Array<[number, number]>} listB
 * @returns {Array<[number, number]>}
 */
export function intersectIntervals(listA, listB) {
  const result = [];
  for (const [aStart, aEnd] of listA) {
    for (const [bStart, bEnd] of listB) {
      const overlapStart = Math.max(aStart, bStart);
      const overlapEnd = Math.min(aEnd, bEnd);
      if (overlapEnd > overlapStart) {
        result.push([overlapStart, overlapEnd]);
      }
    }
  }
  return result.sort((a, b) => a[0] - b[0]);
}

/**
 * Pure schedule generator function.
 * @param {object} planDetails - input plan object (wakeTime, bedTime, meals, commitments, tasks, etc.)
 * @param {object} [options] - options like isRegeneration, lockedTaskIds, etc.
 * @returns {{
 *   scheduledBlocks: Array<object>,
 *   scheduledTasks: Array<object>,
 *   unscheduledTasks: Array<object>,
 *   warnings: Array<string>
 * }}
 */
export function generateSchedule(planDetails, options = {}) {
  const warnings = [];

  // Basic essential validations
  if (!planDetails || typeof planDetails !== 'object') {
    return { scheduledBlocks: [], scheduledTasks: [], unscheduledTasks: [], warnings: ['Invalid plan details provided.'] };
  }

  const {
    date: planDate,
    wakeTime,
    bedTime,
    workHours,
    travelMinutes,
    meals = [],
    commitments = [],
    freeSlots = [],
    tasks = [],
  } = planDetails;

  if (!tasks || tasks.length === 0) {
    return {
      scheduledBlocks: [],
      scheduledTasks: [],
      unscheduledTasks: [],
      warnings: ['Add at least one task to generate a plan.'],
      error: 'Add at least one task to generate a plan.',
    };
  }

  const wakeMin = timeToMinutes(wakeTime);
  const bedMinClock = timeToMinutes(bedTime);

  if (isNaN(wakeMin) || isNaN(bedMinClock)) {
    return {
      scheduledBlocks: [],
      scheduledTasks: [],
      unscheduledTasks: [],
      warnings: ['Wake-up time and bedtime must be valid HH:mm times.'],
    };
  }

  // Handle overnight bedtimes (e.g. wake 06:00, bed 00:30 -> bedMin = 1470)
  const isBedAfterMidnight = bedMinClock <= wakeMin;
  let bedMin = bedMinClock;
  if (isBedAfterMidnight) {
    bedMin += 1440;
  }

  const totalWakingDuration = bedMin - wakeMin;
  const initialFree = [[0, totalWakingDuration]];

  // 1. Identify Fixed Blocks
  const fixedIntervals = []; // [[relStart, relEnd]]
  const fixedBlocks = [];    // Visual timeline blocks

  // Sleep Blocks for timeline rendering
  if (isBedAfterMidnight) {
    // Bedtime is after midnight (e.g. 00:30 or 01:00 with wake 06:00 or 07:00)
    // Sleep is the single non-overlapping part from bedtime to wake-up time
    fixedBlocks.push({
      id: generateId('sleep-overnight'),
      type: 'sleep',
      title: 'Sleep / Rest',
      start: bedTime,
      end: wakeTime,
      isFixed: true,
      relStart: totalWakingDuration,
      relEnd: 1440,
    });
  } else {
    // Bedtime is before midnight: exactly two non-overlapping parts
    // Part 1: midnight to wake time (00:00 to wakeTime)
    if (wakeMin > 0) {
      fixedBlocks.push({
        id: generateId('sleep-morning'),
        type: 'sleep',
        title: 'Sleep / Rest',
        start: '00:00',
        end: wakeTime,
        isFixed: true,
        relStart: -wakeMin,
        relEnd: 0,
      });
    }

    // Part 2: bedtime to midnight (bedTime to 24:00)
    fixedBlocks.push({
      id: generateId('sleep-night'),
      type: 'sleep',
      title: 'Sleep / Rest',
      start: bedTime,
      end: '24:00',
      isFixed: true,
      relStart: totalWakingDuration,
      relEnd: 1440 - wakeMin,
    });
  }

  // College / Work Hours
  let workRelStart = NaN;
  let workRelEnd = NaN;
  if (workHours && workHours.start && workHours.end) {
    workRelStart = toRelativeMinutes(workHours.start, wakeMin, bedMin);
    workRelEnd = toRelativeMinutes(workHours.end, wakeMin, bedMin);

    if (!isNaN(workRelStart) && !isNaN(workRelEnd) && workRelEnd > workRelStart) {
      // Travel: one-way immediately before work
      const travelMins = Number(travelMinutes) || 0;
      if (travelMins > 0) {
        const tBeforeStart = Math.max(0, workRelStart - travelMins);
        fixedIntervals.push([tBeforeStart, workRelStart]);
        fixedBlocks.push({
          id: generateId('travel-before'),
          type: 'travel',
          title: 'Commute / Travel to Work/College',
          start: fromRelativeMinutes(tBeforeStart, wakeMin),
          end: fromRelativeMinutes(workRelStart, wakeMin),
          isFixed: true,
          relStart: tBeforeStart,
          relEnd: workRelStart,
        });
      }

      // Work block
      fixedIntervals.push([workRelStart, workRelEnd]);
      fixedBlocks.push({
        id: generateId('work'),
        type: 'work',
        title: planDetails.userType === 'student' ? 'College / Classes' : 'Work / Office Hours',
        start: workHours.start,
        end: workHours.end,
        isFixed: true,
        relStart: workRelStart,
        relEnd: workRelEnd,
      });

      // Travel: one-way immediately after work
      if (travelMins > 0) {
        const tAfterEnd = Math.min(totalWakingDuration, workRelEnd + travelMins);
        fixedIntervals.push([workRelEnd, tAfterEnd]);
        fixedBlocks.push({
          id: generateId('travel-after'),
          type: 'travel',
          title: 'Commute / Travel from Work/College',
          start: fromRelativeMinutes(workRelEnd, wakeMin),
          end: fromRelativeMinutes(tAfterEnd, wakeMin),
          isFixed: true,
          relStart: workRelEnd,
          relEnd: tAfterEnd,
        });
      }
    }
  }

  // Meals
  for (const meal of meals) {
    if (meal.start && meal.end) {
      const s = toRelativeMinutes(meal.start, wakeMin, bedMin);
      const e = toRelativeMinutes(meal.end, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e) && e > s) {
        fixedIntervals.push([s, e]);
        fixedBlocks.push({
          id: meal.id || generateId('meal'),
          type: 'meal',
          title: meal.name || 'Meal',
          start: meal.start,
          end: meal.end,
          isFixed: true,
          relStart: s,
          relEnd: e,
        });
      }
    }
  }

  // Fixed Commitments
  for (const comm of commitments) {
    if (comm.start && comm.end) {
      const s = toRelativeMinutes(comm.start, wakeMin, bedMin);
      const e = toRelativeMinutes(comm.end, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e) && e > s) {
        fixedIntervals.push([s, e]);
        fixedBlocks.push({
          id: comm.id || generateId('comm'),
          type: 'commitment',
          title: comm.name || 'Commitment',
          start: comm.start,
          end: comm.end,
          isFixed: true,
          relStart: s,
          relEnd: e,
        });
      }
    }
  }

  // Locked Tasks from regeneration (completed, skipped, or in_progress)
  const isRegeneration = options.isRegeneration || false;
  const lockedTasks = [];
  const tasksToSchedule = [];

  for (const task of tasks) {
    const isLockedStatus = ['completed', 'skipped', 'in_progress'].includes(task.status);
    if (isRegeneration && isLockedStatus && task.scheduledStart && task.scheduledEnd) {
      const s = toRelativeMinutes(task.scheduledStart, wakeMin, bedMin);
      const e = toRelativeMinutes(task.scheduledEnd, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e) && e > s) {
        fixedIntervals.push([s, e]);
        lockedTasks.push({ ...task, scheduledStartRel: s, scheduledEndRel: e });
        continue;
      }
    }

    // Rescheduled task check: if already rescheduled and still conflict-free during regeneration
    if (isRegeneration && task.status === 'rescheduled' && task.scheduledStart && task.scheduledEnd) {
      const s = toRelativeMinutes(task.scheduledStart, wakeMin, bedMin);
      const e = toRelativeMinutes(task.scheduledEnd, wakeMin, bedMin);
      // Check if slot has conflict with current fixed blocks
      const hasConflict = fixedIntervals.some(([fS, fE]) => Math.max(s, fS) < Math.min(e, fE));
      if (!hasConflict && s >= 0 && e <= totalWakingDuration) {
        fixedIntervals.push([s, e]);
        lockedTasks.push({ ...task, scheduledStartRel: s, scheduledEndRel: e });
        continue;
      } else {
        warnings.push(`Task "${task.name}" was previously rescheduled to ${task.scheduledStart}, but moved because of a conflict.`);
      }
    }

    tasksToSchedule.push({ ...task });
  }

  // 2. Compute Available Free Windows
  let availableWindows = subtractIntervals(initialFree, fixedIntervals);

  // If user provided explicit free slots, intersect with available windows
  if (Array.isArray(freeSlots) && freeSlots.length > 0) {
    const userFreeIntervals = [];
    for (const slot of freeSlots) {
      if (slot.start && slot.end) {
        const s = toRelativeMinutes(slot.start, wakeMin, bedMin);
        const e = toRelativeMinutes(slot.end, wakeMin, bedMin);
        if (!isNaN(s) && !isNaN(e) && e > s) {
          userFreeIntervals.push([s, e]);
        }
      }
    }
    if (userFreeIntervals.length > 0) {
      availableWindows = intersectIntervals(availableWindows, userFreeIntervals);
    }
  } else {
    warnings.push('Free windows derived automatically from waking hours minus fixed commitments.');
  }

  // 3. Sort Tasks Deterministically
  const priorityRank = { high: 1, medium: 2, low: 3 };

  const sortedTasks = [...tasksToSchedule].map((t, idx) => ({ ...t, _originalIndex: idx }));
  sortedTasks.sort((a, b) => {
    // Deadline urgency check
    const aUrgent = getDeadlineUrgencyScore(a, planDate, wakeMin, bedMin);
    const bUrgent = getDeadlineUrgencyScore(b, planDate, wakeMin, bedMin);
    if (aUrgent !== bUrgent) {
      return aUrgent - bUrgent;
    }

    // Priority check
    const pA = priorityRank[(a.priority || 'medium').toLowerCase()] || 2;
    const pB = priorityRank[(b.priority || 'medium').toLowerCase()] || 2;
    if (pA !== pB) {
      return pA - pB;
    }

    // Preferred time check (has preferred time first)
    const hasPrefA = Boolean(a.preferredTime);
    const hasPrefB = Boolean(b.preferredTime);
    if (hasPrefA !== hasPrefB) {
      return hasPrefA ? -1 : 1;
    }

    // Stable tie-break by original index
    return a._originalIndex - b._originalIndex;
  });

  // 4. Place ALL Tasks First
  const newlyScheduledTasks = [];
  const unscheduledTasks = [];

  for (const task of sortedTasks) {
    const duration = Number(task.durationMinutes);
    if (isNaN(duration) || duration <= 0) {
      unscheduledTasks.push({
        taskId: task.id,
        name: task.name,
        durationMinutes: task.durationMinutes,
        reason: 'Invalid task duration.',
        suggestion: 'Specify a positive whole number duration.',
      });
      continue;
    }

    const deadlineLimitRel = getDeadlineRelativeLimit(task, planDate, wakeMin, bedMin, totalWakingDuration);
    let placedSlot = null;

    // Check Preferred Time First
    if (task.preferredTime) {
      const prefRel = toRelativeMinutes(task.preferredTime, wakeMin, bedMin);
      if (!isNaN(prefRel) && prefRel >= 0 && prefRel + duration <= totalWakingDuration) {
        // Must fit within available windows and end before deadline (or be explicitly flexible)
        const fitsInWindow = availableWindows.some(([wStart, wEnd]) => prefRel >= wStart && prefRel + duration <= wEnd);
        const meetsDeadline = prefRel + duration <= deadlineLimitRel;

        if ((fitsInWindow || task.isFlexible) && meetsDeadline) {
          placedSlot = [prefRel, prefRel + duration];
        } else {
          warnings.push(`Could not use preferred time (${task.preferredTime}) for "${task.name}". Placed at earliest available time.`);
        }
      }
    }

    // Earliest Fitting Window Fallback
    if (!placedSlot) {
      for (const [wStart, wEnd] of availableWindows) {
        if (wEnd - wStart >= duration) {
          const candidateEnd = wStart + duration;
          if (candidateEnd <= deadlineLimitRel) {
            placedSlot = [wStart, candidateEnd];
            break;
          }
        }
      }
    }

    if (placedSlot) {
      const [startRel, endRel] = placedSlot;
      const startTimeStr = fromRelativeMinutes(startRel, wakeMin);
      const endTimeStr = fromRelativeMinutes(endRel, wakeMin);

      newlyScheduledTasks.push({
        ...task,
        scheduledStart: startTimeStr,
        scheduledEnd: endTimeStr,
        scheduledStartRel: startRel,
        scheduledEndRel: endRel,
      });

      // Update available windows by subtracting placed slot
      availableWindows = subtractIntervals(availableWindows, [placedSlot]);
    } else {
      // Task could not fit - explain conflict and provide alternative
      const maxWindowMins = availableWindows.reduce((max, [s, e]) => Math.max(max, e - s), 0);
      let reason = 'Not enough free time remaining in today\'s schedule.';
      let suggestion = availableWindows.length > 0
        ? `Free slot available at ${fromRelativeMinutes(availableWindows[0][0], wakeMin)}. Or mark task as flexible.`
        : 'Move to another day or free up routine time.';

      // Check if preferredTime conflicted with a fixed routine
      if (task.preferredTime) {
        const prefRel = toRelativeMinutes(task.preferredTime, wakeMin, bedMin);
        const overlappingFixed = fixedBlocks.find(
          (fb) => fb.relStart < prefRel + duration && fb.relEnd > prefRel
        );
        if (overlappingFixed) {
          reason = `Preferred time conflicts with ${overlappingFixed.title} (${overlappingFixed.start} - ${overlappingFixed.end}).`;
          suggestion = availableWindows.length > 0
            ? `Schedule in available free slot at ${fromRelativeMinutes(availableWindows[0][0], wakeMin)}, or mark as flexible during ${overlappingFixed.title}.`
            : `Mark task as flexible to allow during ${overlappingFixed.title}, or shorten duration.`;
        }
      }

      // Check if deadline was the barrier
      const canFitWithoutDeadline = availableWindows.some(([s, e]) => e - s >= duration);
      if (canFitWithoutDeadline && deadlineLimitRel < totalWakingDuration && !task.preferredTime) {
        reason = `Cannot finish before deadline (${task.deadlineTime || 'bedtime'}).`;
        suggestion = 'Shorten task duration or adjust deadline.';
      } else if (duration > maxWindowMins && !task.preferredTime) {
        reason = `Task duration (${duration}m) exceeds largest continuous free window (${maxWindowMins}m).`;
        suggestion = maxWindowMins >= 15
          ? `Shorten duration to ${maxWindowMins}m or split into smaller tasks.`
          : 'Move to another day.';
      }

      unscheduledTasks.push({
        taskId: task.id,
        name: task.name,
        durationMinutes: duration,
        reason,
        suggestion,
      });
    }
  }

  // 5. Combine All Scheduled Tasks (Locked + Newly Scheduled)
  const allScheduledTasks = [...lockedTasks, ...newlyScheduledTasks];

  // 6. Insert Rest Breaks into Leftover Free Time
  const breakBlocks = [];
  for (const st of newlyScheduledTasks) {
    const dur = Number(st.durationMinutes);
    let neededBreak = 0;
    if (dur >= BREAK_CONFIG.LONG_THRESHOLD_MINS) {
      neededBreak = BREAK_CONFIG.LONG_BREAK_MINS;
    } else if (dur >= BREAK_CONFIG.MEDIUM_THRESHOLD_MINS) {
      neededBreak = BREAK_CONFIG.MEDIUM_BREAK_MINS;
    }

    if (neededBreak > 0) {
      const breakStartRel = st.scheduledEndRel;
      const breakEndRel = breakStartRel + neededBreak;

      // Check if break fits in leftover available windows
      const fitsInLeftover = availableWindows.some(([wStart, wEnd]) => breakStartRel >= wStart && breakEndRel <= wEnd);

      if (fitsInLeftover && breakEndRel <= totalWakingDuration) {
        breakBlocks.push({
          id: generateId('break'),
          type: 'break',
          title: `Rest Break (${neededBreak}m)`,
          start: fromRelativeMinutes(breakStartRel, wakeMin),
          end: fromRelativeMinutes(breakEndRel, wakeMin),
          isFixed: false,
          relStart: breakStartRel,
          relEnd: breakEndRel,
        });

        // Consume this break from available windows so breaks don't overlap each other
        availableWindows = subtractIntervals(availableWindows, [[breakStartRel, breakEndRel]]);
      }
    }
  }

  // 7. Assemble Timeline Blocks
  // Task blocks store ONLY { id, type: 'task', taskId, start, end } per requirement #1!
  const taskBlocks = allScheduledTasks.map((t) => ({
    id: generateId('task-block'),
    type: 'task',
    taskId: t.id,
    start: t.scheduledStart,
    end: t.scheduledEnd,
    relStart: t.scheduledStartRel,
    relEnd: t.scheduledEndRel,
  }));

  const allBlocks = [...fixedBlocks, ...taskBlocks, ...breakBlocks];

  // Sort chronologically by relative minutes from wake-up
  allBlocks.sort((a, b) => a.relStart - b.relStart);

  // Strip internal helper properties before returning
  const cleanBlocks = allBlocks.map(({ relStart, relEnd, ...rest }) => rest);
  const cleanTasks = allScheduledTasks.map(({ scheduledStartRel, scheduledEndRel, _originalIndex, ...rest }) => rest);

  return {
    scheduledBlocks: cleanBlocks,
    scheduledTasks: cleanTasks,
    unscheduledTasks,
    warnings,
  };
}

/**
 * Calculates a numerical deadline urgency score (lower score = higher urgency).
 */
function getDeadlineUrgencyScore(task, planDate, wakeMin, bedMin) {
  if (!task.deadlineDate && !task.deadlineTime) {
    return 10000; // No deadline
  }

  // Overdue check
  if (task.deadlineDate && task.deadlineDate < planDate) {
    return -100; // Overdue: maximum urgency
  }

  // Same day deadline
  if (!task.deadlineDate || task.deadlineDate === planDate) {
    if (task.deadlineTime) {
      const rel = toRelativeMinutes(task.deadlineTime, wakeMin, bedMin);
      return isNaN(rel) ? 5000 : rel;
    }
    return 9000; // Finish by bedtime
  }

  // Future deadline: not urgent for today
  return 10000;
}

/**
 * Gets the maximum relative minute by which a task must finish today.
 */
function getDeadlineRelativeLimit(task, planDate, wakeMin, bedMin, totalWakingDuration) {
  if (!task.deadlineDate && !task.deadlineTime) {
    return totalWakingDuration;
  }

  // Overdue tasks can still be placed anywhere today
  if (task.deadlineDate && task.deadlineDate < planDate) {
    return totalWakingDuration;
  }

  // Future deadline
  if (task.deadlineDate && task.deadlineDate > planDate) {
    return totalWakingDuration;
  }

  // Same day deadline with time
  if (task.deadlineTime) {
    const rel = toRelativeMinutes(task.deadlineTime, wakeMin, bedMin);
    return isNaN(rel) ? totalWakingDuration : rel;
  }

  return totalWakingDuration;
}

/**
 * Single task placement helper reusing the exact same placement logic as generateSchedule.
 * Used by taskOperations in addTask, reopen, and moveTaskToDate.
 * @param {object} planDetails
 * @param {object} task
 * @param {{ ignoreTaskId?: string }} [options]
 * @returns {{
 *   success: boolean,
 *   slot?: { start: string, end: string },
 *   warning?: string,
 *   reason?: string,
 *   suggestion?: string
 * }}
 */
export function findSlotForSingleTask(planDetails, task, options = {}) {
  const wakeMin = timeToMinutes(planDetails.wakeTime);
  let bedMin = timeToMinutes(planDetails.bedTime);
  if (isNaN(wakeMin) || isNaN(bedMin)) {
    return { success: false, reason: 'Wake and bed times are invalid.' };
  }
  if (bedMin <= wakeMin) bedMin += 1440;
  const totalWakingDuration = bedMin - wakeMin;
  const initialFree = [[0, totalWakingDuration]];

  // 1. Gather all fixed intervals (routine + work + meals + commitments)
  const fixedIntervals = [];

  if (planDetails.workHours?.start && planDetails.workHours?.end) {
    const wS = toRelativeMinutes(planDetails.workHours.start, wakeMin, bedMin);
    const wE = toRelativeMinutes(planDetails.workHours.end, wakeMin, bedMin);
    if (!isNaN(wS) && !isNaN(wE) && wE > wS) {
      const travelMins = Number(planDetails.travelMinutes) || 0;
      if (travelMins > 0) {
        fixedIntervals.push([Math.max(0, wS - travelMins), wS]);
      }
      fixedIntervals.push([wS, wE]);
      if (travelMins > 0) {
        fixedIntervals.push([wE, Math.min(totalWakingDuration, wE + travelMins)]);
      }
    }
  }

  for (const m of (planDetails.meals || [])) {
    const s = toRelativeMinutes(m.start, wakeMin, bedMin);
    const e = toRelativeMinutes(m.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e) && e > s) fixedIntervals.push([s, e]);
  }

  for (const c of (planDetails.commitments || [])) {
    const s = toRelativeMinutes(c.start, wakeMin, bedMin);
    const e = toRelativeMinutes(c.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e) && e > s) fixedIntervals.push([s, e]);
  }

  // Also include all other tasks that are currently scheduled
  for (const otherT of (planDetails.tasks || [])) {
    if (otherT.id === (options.ignoreTaskId || task.id)) continue;
    if (otherT.scheduledStart && otherT.scheduledEnd) {
      const s = toRelativeMinutes(otherT.scheduledStart, wakeMin, bedMin);
      const e = toRelativeMinutes(otherT.scheduledEnd, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e) && e > s) {
        fixedIntervals.push([s, e]);
      }
    }
  }

  let availableWindows = subtractIntervals(initialFree, fixedIntervals);

  if (Array.isArray(planDetails.freeSlots) && planDetails.freeSlots.length > 0) {
    const userFree = [];
    for (const slot of planDetails.freeSlots) {
      const s = toRelativeMinutes(slot.start, wakeMin, bedMin);
      const e = toRelativeMinutes(slot.end, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e) && e > s) userFree.push([s, e]);
    }
    if (userFree.length > 0) {
      availableWindows = intersectIntervals(availableWindows, userFree);
    }
  }

  const duration = Number(task.durationMinutes) || 30;
  const deadlineLimitRel = getDeadlineRelativeLimit(task, planDetails.date, wakeMin, bedMin, totalWakingDuration);
  let placedSlot = null;
  let warning = null;

  // Try preferred time
  if (task.preferredTime) {
    const prefRel = toRelativeMinutes(task.preferredTime, wakeMin, bedMin);
    if (!isNaN(prefRel) && prefRel >= 0 && prefRel + duration <= totalWakingDuration) {
      const fitsInWindow = availableWindows.some(([wS, wE]) => prefRel >= wS && prefRel + duration <= wE);
      const meetsDeadline = prefRel + duration <= deadlineLimitRel;
      if (fitsInWindow && meetsDeadline) {
        placedSlot = [prefRel, prefRel + duration];
      } else {
        warning = `Could not use preferred time (${task.preferredTime}) for "${task.name}". Placed at earliest available time.`;
      }
    }
  }

  // Fallback to earliest window
  if (!placedSlot) {
    for (const [wS, wE] of availableWindows) {
      if (wE - wS >= duration) {
        const candidateEnd = wS + duration;
        if (candidateEnd <= deadlineLimitRel) {
          placedSlot = [wS, candidateEnd];
          break;
        }
      }
    }
  }

  if (placedSlot) {
    return {
      success: true,
      slot: {
        start: fromRelativeMinutes(placedSlot[0], wakeMin),
        end: fromRelativeMinutes(placedSlot[1], wakeMin),
      },
      warning,
    };
  }

  const maxWindowMins = availableWindows.reduce((max, [s, e]) => Math.max(max, e - s), 0);
  let reason = 'Not enough free time remaining in schedule.';
  let suggestion = 'Move to another day or free up routine time.';

  const canFitWithoutDeadline = availableWindows.some(([s, e]) => e - s >= duration);
  if (canFitWithoutDeadline && deadlineLimitRel < totalWakingDuration) {
    reason = `Cannot finish before deadline (${task.deadlineTime || 'bedtime'}).`;
    suggestion = 'Shorten task duration or adjust deadline.';
  } else if (duration > maxWindowMins) {
    reason = `Task duration (${duration}m) exceeds largest continuous free window (${maxWindowMins}m).`;
    suggestion = maxWindowMins >= 15 ? `Shorten duration to ${maxWindowMins}m or split into smaller tasks.` : 'Move to another day.';
  }

  return {
    success: false,
    reason,
    suggestion,
  };
}

/**
 * Calculates available free windows between fixed items (and optionally tasks).
 * Single source of truth shared by scheduler and UI timetable rendering.
 * @param {object} planDetails
 * @param {{ includeScheduledTasks?: boolean }} [options]
 * @returns {Array<{ id: string, type: string, start: string, end: string, durationMinutes: number, title: string, relStart: number, relEnd: number }>}
 */
export function calculateFreeWindows(planDetails, options = {}) {
  if (!planDetails || typeof planDetails !== 'object') return [];

  const wakeTime = planDetails.wakeTime || '06:00';
  const bedTime = planDetails.bedTime || '23:00';
  const wakeMin = timeToMinutes(wakeTime);
  let bedMin = timeToMinutes(bedTime);
  if (isNaN(wakeMin) || isNaN(bedMin)) return [];

  if (bedMin <= wakeMin) bedMin += 1440;
  const totalWakingDuration = bedMin - wakeMin;
  const initialFree = [[0, totalWakingDuration]];

  // 1. Gather fixed intervals
  const fixedIntervals = [];

  // Work & travel
  if (planDetails.workHours?.start && planDetails.workHours?.end) {
    const wS = toRelativeMinutes(planDetails.workHours.start, wakeMin, bedMin);
    const wE = toRelativeMinutes(planDetails.workHours.end, wakeMin, bedMin);
    if (!isNaN(wS) && !isNaN(wE) && wE > wS) {
      const travelMins = Number(planDetails.travelMinutes) || 0;
      if (travelMins > 0) {
        fixedIntervals.push([Math.max(0, wS - travelMins), wS]);
      }
      fixedIntervals.push([wS, wE]);
      if (travelMins > 0) {
        fixedIntervals.push([wE, Math.min(totalWakingDuration, wE + travelMins)]);
      }
    }
  }

  // Meals
  for (const m of (planDetails.meals || [])) {
    const s = toRelativeMinutes(m.start, wakeMin, bedMin);
    const e = toRelativeMinutes(m.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e) && e > s) fixedIntervals.push([s, e]);
  }

  // Commitments
  for (const c of (planDetails.commitments || [])) {
    const s = toRelativeMinutes(c.start, wakeMin, bedMin);
    const e = toRelativeMinutes(c.end, wakeMin, bedMin);
    if (!isNaN(s) && !isNaN(e) && e > s) fixedIntervals.push([s, e]);
  }

  // If includeScheduledTasks: also subtract scheduled tasks and breaks
  if (options.includeScheduledTasks) {
    for (const otherT of (planDetails.tasks || [])) {
      if (otherT.scheduledStart && otherT.scheduledEnd) {
        const s = toRelativeMinutes(otherT.scheduledStart, wakeMin, bedMin);
        const e = toRelativeMinutes(otherT.scheduledEnd, wakeMin, bedMin);
        if (!isNaN(s) && !isNaN(e) && e > s) {
          fixedIntervals.push([s, e]);
        }
      }
    }
    for (const b of (planDetails.schedule?.blocks || [])) {
      if (b.type === 'break' && b.start && b.end) {
        const s = toRelativeMinutes(b.start, wakeMin, bedMin);
        const e = toRelativeMinutes(b.end, wakeMin, bedMin);
        if (!isNaN(s) && !isNaN(e) && e > s) {
          fixedIntervals.push([s, e]);
        }
      }
    }
  }

  let availableWindows = subtractIntervals(initialFree, fixedIntervals);

  if (Array.isArray(planDetails.freeSlots) && planDetails.freeSlots.length > 0) {
    const userFree = [];
    for (const slot of planDetails.freeSlots) {
      const s = toRelativeMinutes(slot.start, wakeMin, bedMin);
      const e = toRelativeMinutes(slot.end, wakeMin, bedMin);
      if (!isNaN(s) && !isNaN(e) && e > s) userFree.push([s, e]);
    }
    if (userFree.length > 0) {
      availableWindows = intersectIntervals(availableWindows, userFree);
    }
  }

  return availableWindows
    .filter(([s, e]) => e > s)
    .map(([s, e]) => {
      const start = fromRelativeMinutes(s, wakeMin);
      const end = fromRelativeMinutes(e, wakeMin);
      const durationMinutes = e - s;
      return {
        id: generateId('free'),
        type: 'free',
        title: `Free: ${start} - ${end} (${durationMinutes} min)`,
        start,
        end,
        durationMinutes,
        relStart: s,
        relEnd: e,
      };
    });
}
