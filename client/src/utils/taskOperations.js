/**
 * Pure Task Operations Module
 * Pure functions: (store, ...) -> { ok: boolean, store: object, errors: string[], warnings: string[] }
 * Strictly atomic: on any error, returns the original store completely unchanged.
 * Zero dependencies on React, localStorage, or DOM APIs.
 */

import { generateId } from './dateUtils.js';
import {
  timeToMinutes,
  minutesToTime,
  isWithinWakeHours,
  checkIntervalConflict,
  doIntervalsOverlap,
} from '../../../shared/conflictEngine.js';
import { findSlotForSingleTask, toRelativeMinutes } from './scheduler.js';
import { VALID_TASK_STATUSES } from './validation.js';

/**
 * Checks integrity of a plan: detects duplicate IDs, orphan blocks,
 * overlapping task blocks, and mismatched task.date values.
 * @param {object} plan
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function checkPlanIntegrity(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan is null or not an object.'] };
  }

  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const taskIds = new Set();

  for (const t of tasks) {
    if (!t.id) {
      errors.push('Task missing unique ID.');
      continue;
    }
    if (taskIds.has(t.id)) {
      errors.push(`Duplicate task ID found: "${t.id}".`);
    }
    taskIds.add(t.id);

    // Mismatched dates check
    if (t.date && plan.date && t.date !== plan.date) {
      errors.push(`Task "${t.id}" date (${t.date}) does not match plan date (${plan.date}).`);
    }
  }

  // Schedule blocks check
  const blocks = plan.schedule?.blocks || [];
  const scheduledTaskBlocks = [];

  for (const b of blocks) {
    if (b.type === 'task') {
      if (!b.taskId) {
        errors.push(`Task block "${b.id}" missing taskId.`);
      } else if (!taskIds.has(b.taskId)) {
        errors.push(`Orphan block found: references non-existent taskId "${b.taskId}".`);
      } else {
        scheduledTaskBlocks.push(b);
      }
    }
  }

  // Overlapping blocks check between scheduled task blocks
  for (let i = 0; i < scheduledTaskBlocks.length; i++) {
    const bA = scheduledTaskBlocks[i];
    const sA = timeToMinutes(bA.start);
    const eA = timeToMinutes(bA.end);
    for (let j = i + 1; j < scheduledTaskBlocks.length; j++) {
      const bB = scheduledTaskBlocks[j];
      const sB = timeToMinutes(bB.start);
      const eB = timeToMinutes(bB.end);
      if (!isNaN(sA) && !isNaN(eA) && !isNaN(sB) && !isNaN(eB)) {
        if (doIntervalsOverlap(sA, eA, sB, eB)) {
          errors.push(`Overlapping task blocks detected between "${bA.taskId}" and "${bB.taskId}".`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Pure function to detect if a scheduled task is overdue.
 * Only applies when plan.date === now.localDate and task.status === 'pending'.
 * @param {object} task
 * @param {object} plan
 * @param {{ localDate: string, currentTime: string }} now - { localDate: "YYYY-MM-DD", currentTime: "HH:mm" }
 * @returns {boolean}
 */
export function isTaskOverdue(task, plan, now) {
  if (!task || !plan || !now) return false;
  if (task.status !== 'pending') return false;
  if (!task.scheduledEnd) return false;

  // Extract localDate and currentTime from now parameter safely without calling new Date()
  const localDate = typeof now === 'object' && now.localDate
    ? now.localDate
    : (typeof now === 'string'
      ? now
      : (now.getFullYear ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` : null));

  const currentTime = typeof now === 'object' && now.currentTime
    ? now.currentTime
    : (now.getHours ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '00:00');

  if (!localDate || plan.date !== localDate) return false;

  const wakeMin = timeToMinutes(plan.wakeTime || '06:00');
  let bedMin = timeToMinutes(plan.bedTime || '23:00');
  if (bedMin <= wakeMin) bedMin += 1440;

  const taskEndRel = toRelativeMinutes(task.scheduledEnd, wakeMin, bedMin);
  const nowRel = toRelativeMinutes(currentTime, wakeMin, bedMin);

  if (isNaN(taskEndRel) || isNaN(nowRel)) return false;

  // Task has passed if current relative time is strictly greater than task's scheduled end
  return nowRel > taskEndRel;
}

/**
 * Deep clones the store to guarantee pure operations.
 */
function cloneStore(store) {
  return JSON.parse(JSON.stringify(store));
}

/**
 * Adds a new task to a plan.
 * If schedule exists, attempts to slot it using findSlotForSingleTask.
 * @param {object} store - { schemaVersion, plans }
 * @param {string} date - YYYY-MM-DD
 * @param {object} taskData
 * @returns {{ ok: boolean, store: object, task?: object, errors?: string[], warnings?: string[] }}
 */
export function addTask(store, date, taskData) {
  const errors = [];
  const warnings = [];

  if (!taskData.name || !taskData.name.trim()) {
    errors.push('Task name is required.');
  }
  const dur = Number(taskData.durationMinutes);
  if (isNaN(dur) || dur <= 0 || !Number.isInteger(dur)) {
    errors.push('Duration must be a positive whole number of minutes.');
  }

  if (errors.length > 0) {
    return { ok: false, store, errors, warnings };
  }

  const nextStore = cloneStore(store);
  let plan = nextStore.plans[date];

  if (!plan) {
    // Create minimal plan
    plan = {
      schemaVersion: nextStore.schemaVersion || 3,
      date,
      userType: 'both',
      wakeTime: '06:00',
      bedTime: '23:00',
      workHours: null,
      travelMinutes: 0,
      meals: [],
      commitments: [],
      freeSlots: [],
      priorities: '',
      specialCircumstances: '',
      tasks: [],
      status: 'no_plan',
      schedule: null,
    };
    nextStore.plans[date] = plan;
  }

  const newTask = {
    id: generateId('task'),
    date,
    name: taskData.name.trim(),
    category: taskData.category || 'Education',
    durationMinutes: dur,
    priority: taskData.priority || 'Medium',
    preferredTime: taskData.preferredTime || null,
    scheduledStart: null,
    scheduledEnd: null,
    status: 'pending',
    notes: taskData.notes || '',
    deadlineDate: taskData.deadlineDate || null,
    deadlineTime: taskData.deadlineTime || null,
    updatedAt: new Date().toISOString(),
    completedAt: null,
    skippedAt: null,
    movedFrom: null,
  };

  // If plan has an active schedule, attempt to place the task
  if (plan.schedule && plan.status === 'scheduled') {
    const slotResult = findSlotForSingleTask(plan, newTask);

    if (slotResult.success && slotResult.slot) {
      newTask.scheduledStart = slotResult.slot.start;
      newTask.scheduledEnd = slotResult.slot.end;

      if (slotResult.warning) warnings.push(slotResult.warning);

      // Add to schedule.blocks
      const newBlock = {
        id: generateId('task-block'),
        type: 'task',
        taskId: newTask.id,
        start: newTask.scheduledStart,
        end: newTask.scheduledEnd,
      };

      plan.schedule.blocks = [...(plan.schedule.blocks || []), newBlock].sort((a, b) => {
        const wakeMin = timeToMinutes(plan.wakeTime);
        const bedMin = timeToMinutes(plan.bedTime) <= wakeMin ? timeToMinutes(plan.bedTime) + 1440 : timeToMinutes(plan.bedTime);
        return toRelativeMinutes(a.start, wakeMin, bedMin) - toRelativeMinutes(b.start, wakeMin, bedMin);
      });
    } else {
      // Add to unscheduled
      plan.schedule.unscheduled = [
        ...(plan.schedule.unscheduled || []),
        {
          taskId: newTask.id,
          name: newTask.name,
          durationMinutes: newTask.durationMinutes,
          reason: slotResult.reason || 'Could not find a free slot that fits this task.',
          suggestion: slotResult.suggestion || 'Shorten task duration or move to another day.',
        },
      ];
      warnings.push(`Task "${newTask.name}" could not fit in today's schedule and was added to the "Could not fit" list.`);
    }
  }

  plan.tasks = [...(plan.tasks || []), newTask];
  plan.updatedAt = new Date().toISOString();

  return { ok: true, store: nextStore, task: newTask, errors: [], warnings };
}

/**
 * Edits an existing task atomically.
 * @param {object} store
 * @param {string} date
 * @param {string} taskId
 * @param {object} updates
 * @returns {{ ok: boolean, store: object, errors?: string[], warnings?: string[] }}
 */
export function editTask(store, date, taskId, updates) {
  const nextStore = cloneStore(store);
  const plan = nextStore.plans[date];
  if (!plan) return { ok: false, store, errors: ['Plan not found.'] };

  const taskIndex = (plan.tasks || []).findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return { ok: false, store, errors: ['Task not found.'] };

  const currentTask = plan.tasks[taskIndex];
  const warnings = [];

  // Consistent start/end/duration calculation
  let newStart = updates.scheduledStart !== undefined ? updates.scheduledStart : currentTask.scheduledStart;
  let newEnd = updates.scheduledEnd !== undefined ? updates.scheduledEnd : currentTask.scheduledEnd;
  let newDuration = updates.durationMinutes !== undefined ? Number(updates.durationMinutes) : currentTask.durationMinutes;

  if (updates.durationMinutes !== undefined && updates.scheduledEnd === undefined && newStart) {
    // Duration changed: recalculate end
    const s = timeToMinutes(newStart);
    if (!isNaN(s)) {
      newEnd = minutesToTime(s + newDuration);
    }
  } else if (updates.scheduledEnd !== undefined && updates.durationMinutes === undefined && newStart) {
    // End time changed: recalculate duration
    const s = timeToMinutes(newStart);
    const e = timeToMinutes(newEnd);
    if (!isNaN(s) && !isNaN(e) && e > s) {
      newDuration = e - s;
    }
  }

  // Preserve status for completed/skipped tasks
  let status = currentTask.status;
  if (currentTask.status === 'completed' || currentTask.status === 'skipped') {
    warnings.push(`Task status remains "${currentTask.status}".`);
  }

  const updatedTask = {
    ...currentTask,
    name: updates.name !== undefined ? updates.name.trim() : currentTask.name,
    category: updates.category || currentTask.category,
    priority: updates.priority || currentTask.priority,
    durationMinutes: newDuration,
    scheduledStart: newStart,
    scheduledEnd: newEnd,
    notes: updates.notes !== undefined ? updates.notes : currentTask.notes,
    deadlineDate: updates.deadlineDate !== undefined ? updates.deadlineDate : currentTask.deadlineDate,
    deadlineTime: updates.deadlineTime !== undefined ? updates.deadlineTime : currentTask.deadlineTime,
    status,
    updatedAt: new Date().toISOString(),
  };

  plan.tasks[taskIndex] = updatedTask;

  // Update schedule block if present
  if (plan.schedule && plan.schedule.blocks) {
    plan.schedule.blocks = plan.schedule.blocks.map((b) =>
      b.type === 'task' && b.taskId === taskId
        ? { ...b, start: newStart, end: newEnd }
        : b
    );
  }

  return { ok: true, store: nextStore, errors: [], warnings };
}

/**
 * Deletes a task.
 * If task is completed and confirmDeleteCompleted is false, returns rejection.
 * @param {object} store
 * @param {string} date
 * @param {string} taskId
 * @param {{ confirmDeleteCompleted?: boolean }} [options]
 * @returns {{ ok: boolean, store: object, needsCompletedConfirmation?: boolean, errors?: string[] }}
 */
export function deleteTask(store, date, taskId, options = {}) {
  const nextStore = cloneStore(store);
  const plan = nextStore.plans[date];
  if (!plan) return { ok: false, store, errors: ['Plan not found.'] };

  const task = (plan.tasks || []).find((t) => t.id === taskId);
  if (!task) return { ok: false, store, errors: ['Task not found.'] };

  if (task.status === 'completed' && !options.confirmDeleteCompleted) {
    return {
      ok: false,
      store,
      needsCompletedConfirmation: true,
      errors: ['Deleting a completed task removes it from your completed history and progress.'],
    };
  }

  plan.tasks = plan.tasks.filter((t) => t.id !== taskId);

  if (plan.schedule) {
    if (plan.schedule.blocks) {
      plan.schedule.blocks = plan.schedule.blocks.filter(
        (b) => !(b.type === 'task' && b.taskId === taskId)
      );
    }
    if (plan.schedule.unscheduled) {
      plan.schedule.unscheduled = plan.schedule.unscheduled.filter(
        (u) => u.taskId !== taskId
      );
    }
  }

  return { ok: true, store: nextStore };
}

/**
 * Sets task status enforcing status transition rules, single in_progress rule,
 * and conflict-safe Reopen.
 * @param {object} store
 * @param {string} date
 * @param {string} taskId
 * @param {string} newStatus
 * @param {{ pauseExisting?: boolean, nowIso?: string }} [options]
 * @returns {{ ok: boolean, store: object, conflictInProgressTaskId?: string, errors?: string[], warnings?: string[] }}
 */
export function setTaskStatus(store, date, taskId, newStatus, options = {}) {
  const nextStore = cloneStore(store);
  const plan = nextStore.plans[date];
  if (!plan) return { ok: false, store, errors: ['Plan not found.'] };

  const taskIndex = (plan.tasks || []).findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return { ok: false, store, errors: ['Task not found.'] };

  const task = plan.tasks[taskIndex];
  const currentStatus = task.status;
  const nowIso = options.nowIso || new Date().toISOString();
  const warnings = [];

  // Allowed transitions check
  const allowed = {
    pending: ['in_progress', 'completed', 'skipped'],
    rescheduled: ['in_progress', 'completed', 'skipped'],
    in_progress: ['completed', 'pending', 'skipped'],
    completed: ['pending'], // Reopen
    skipped: ['pending'],   // Reopen
  };

  if (currentStatus !== newStatus && (!allowed[currentStatus] || !allowed[currentStatus].includes(newStatus))) {
    return {
      ok: false,
      store,
      errors: [`Transition from "${currentStatus}" to "${newStatus}" is not allowed.`],
    };
  }

  // Single in_progress rule
  if (newStatus === 'in_progress') {
    const existingInProgress = plan.tasks.find((t) => t.id !== taskId && t.status === 'in_progress');
    if (existingInProgress) {
      if (!options.pauseExisting) {
        return {
          ok: false,
          store,
          conflictInProgressTaskId: existingInProgress.id,
          errors: [`Another task ("${existingInProgress.name}") is already in progress.`],
        };
      }
      // Pause existing task
      existingInProgress.status = 'pending';
      warnings.push(`Paused "${existingInProgress.name}" and returned it to pending.`);
    }
  }

  const updatedTask = { ...task, status: newStatus, updatedAt: nowIso };

  // Timestamps recording
  if (newStatus === 'completed') {
    updatedTask.completedAt = nowIso;
  } else if (newStatus === 'skipped') {
    updatedTask.skippedAt = nowIso;
  } else if (newStatus === 'pending') {
    // Reopen clears completedAt and skippedAt
    updatedTask.completedAt = null;
    updatedTask.skippedAt = null;

    // Check if original scheduled time is still conflict-free using placement helper
    if (updatedTask.scheduledStart && updatedTask.scheduledEnd && plan.schedule) {
      const slotResult = findSlotForSingleTask(
        plan,
        { ...updatedTask, preferredTime: updatedTask.scheduledStart },
        { ignoreTaskId: taskId }
      );
      const isOriginalSlotFree = slotResult.success && slotResult.slot?.start === updatedTask.scheduledStart;

      if (isOriginalSlotFree) {
        // Ensure block exists in schedule.blocks
        const hasBlock = (plan.schedule.blocks || []).some(
          (b) => b.type === 'task' && b.taskId === taskId
        );
        if (!hasBlock) {
          plan.schedule.blocks = [...(plan.schedule.blocks || []), {
            id: generateId('task-block'),
            type: 'task',
            taskId: updatedTask.id,
            start: updatedTask.scheduledStart,
            end: updatedTask.scheduledEnd,
          }].sort((a, b) => {
            const wakeMin = timeToMinutes(plan.wakeTime);
            const bedMin = timeToMinutes(plan.bedTime) <= wakeMin ? timeToMinutes(plan.bedTime) + 1440 : timeToMinutes(plan.bedTime);
            return toRelativeMinutes(a.start, wakeMin, bedMin) - toRelativeMinutes(b.start, wakeMin, bedMin);
          });
        }
      } else {
        // Original time is not conflict-free: move to unscheduled ("Could not fit")
        const originalTime = `${updatedTask.scheduledStart} - ${updatedTask.scheduledEnd}`;
        updatedTask.scheduledStart = null;
        updatedTask.scheduledEnd = null;

        // Remove any block from schedule.blocks
        plan.schedule.blocks = (plan.schedule.blocks || []).filter(
          (b) => !(b.type === 'task' && b.taskId === taskId)
        );

        plan.schedule.unscheduled = [
          ...(plan.schedule.unscheduled || []).filter((u) => u.taskId !== taskId),
          {
            taskId: updatedTask.id,
            name: updatedTask.name,
            durationMinutes: updatedTask.durationMinutes,
            reason: slotResult.reason || `Original time (${originalTime}) is now occupied.`,
            suggestion: slotResult.suggestion || 'Reschedule to an available slot or move to another day.',
          },
        ];
        warnings.push(`Reopened task could not restore its original slot (${originalTime}). Moved to "Could not fit".`);
      }
    }
  }

  plan.tasks[taskIndex] = updatedTask;
  return { ok: true, store: nextStore, warnings };
}

/**
 * Reschedules a task to new start and end times on the same date.
 * Validates hard and soft conflicts using shared conflictEngine.
 * @param {object} store
 * @param {string} date
 * @param {string} taskId
 * @param {string} newStart
 * @param {string} newEnd
 * @param {{ allowSoftConflict?: boolean }} [options]
 * @returns {{ ok: boolean, store: object, softConflict?: boolean, errors?: string[], warnings?: string[] }}
 */
export function rescheduleTask(store, date, taskId, newStart, newEnd, options = {}) {
  const nextStore = cloneStore(store);
  const plan = nextStore.plans[date];
  if (!plan) return { ok: false, store, errors: ['Plan not found.'] };

  const taskIndex = (plan.tasks || []).findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return { ok: false, store, errors: ['Task not found.'] };

  const task = plan.tasks[taskIndex];

  // 1. Boundary Check: Waking hours
  if (plan.wakeTime && plan.bedTime) {
    if (!isWithinWakeHours(newStart, newEnd, plan.wakeTime, plan.bedTime)) {
      return {
        ok: false,
        store,
        errors: [`Proposed time (${newStart} - ${newEnd}) falls outside waking hours (${plan.wakeTime} - ${plan.bedTime}) or overlaps sleep.`],
      };
    }
  }

  // 2. Hard Conflict Check: Routine Commitments & Work
  const fixedItems = [
    ...(plan.meals || []).map((m) => ({ ...m, title: m.name || 'Meal' })),
    ...(plan.commitments || []).map((c) => ({ ...c, title: c.name || 'Commitment' })),
  ];
  if (plan.workHours?.start && plan.workHours?.end) {
    fixedItems.push({ start: plan.workHours.start, end: plan.workHours.end, title: 'College / Work' });
  }

  const fixedCheck = checkIntervalConflict(
    { startTime: newStart, endTime: newEnd },
    fixedItems.map((item) => ({ ...item, startTime: item.start, endTime: item.end }))
  );
  if (fixedCheck.hasConflict) {
    return {
      ok: false,
      store,
      errors: [`Hard Conflict: ${fixedCheck.message} Fixed commitments cannot be overlapped.`],
    };
  }

  // 3. Soft Conflict Check: Other Tasks
  const otherTasks = (plan.tasks || [])
    .filter((t) => t.id !== taskId && t.scheduledStart && t.scheduledEnd)
    .map((t) => ({ id: t.id, startTime: t.scheduledStart, endTime: t.scheduledEnd, title: t.name }));

  const taskCheck = checkIntervalConflict(
    { startTime: newStart, endTime: newEnd, id: taskId },
    otherTasks,
    taskId
  );

  if (taskCheck.hasConflict && !options.allowSoftConflict) {
    return {
      ok: false,
      store,
      softConflict: true,
      warnings: [`Soft Conflict: ${taskCheck.message}`],
    };
  }

  // Update task
  const updatedTask = {
    ...task,
    scheduledStart: newStart,
    scheduledEnd: newEnd,
    status: 'rescheduled',
    updatedAt: new Date().toISOString(),
  };

  plan.tasks[taskIndex] = updatedTask;

  // Update schedule blocks
  if (plan.schedule && plan.schedule.blocks) {
    const existingBlock = plan.schedule.blocks.find((b) => b.type === 'task' && b.taskId === taskId);
    if (existingBlock) {
      existingBlock.start = newStart;
      existingBlock.end = newEnd;
    } else {
      plan.schedule.blocks.push({
        id: generateId('task-block'),
        type: 'task',
        taskId,
        start: newStart,
        end: newEnd,
      });
    }
  }

  return { ok: true, store: nextStore };
}

/**
 * Moves a task atomically to another date.
 * @param {object} store
 * @param {string} fromDate
 * @param {string} toDate
 * @param {string} taskId
 * @returns {{ ok: boolean, store: object, errors?: string[], warnings?: string[] }}
 */
export function moveTaskToDate(store, fromDate, toDate, taskId) {
  if (fromDate === toDate) {
    return { ok: false, store, errors: ['Target date must be different from source date.'] };
  }

  const nextStore = cloneStore(store);
  const sourcePlan = nextStore.plans[fromDate];
  if (!sourcePlan) return { ok: false, store, errors: ['Source plan not found.'] };

  const taskIndex = (sourcePlan.tasks || []).findIndex((t) => t.id === taskId);
  if (taskIndex === -1) return { ok: false, store, errors: ['Task not found on source date.'] };

  const sourceTask = sourcePlan.tasks[taskIndex];
  const warnings = [];

  // Target plan setup
  let targetPlan = nextStore.plans[toDate];
  if (!targetPlan) {
    // Minimal plan creation without inventing routines
    targetPlan = {
      schemaVersion: nextStore.schemaVersion || 3,
      date: toDate,
      userType: sourcePlan.userType || 'both',
      wakeTime: '06:00',
      bedTime: '23:00',
      workHours: null,
      travelMinutes: 0,
      meals: [],
      commitments: [],
      freeSlots: [],
      priorities: '',
      specialCircumstances: '',
      tasks: [],
      status: 'details_saved',
      schedule: null,
    };
    nextStore.plans[toDate] = targetPlan;
    warnings.push(`Created a new plan placeholder for ${toDate}. Routine details are incomplete.`);
  }

  const movedTask = {
    ...sourceTask,
    date: toDate,
    scheduledStart: null,
    scheduledEnd: null,
    status: 'pending',
    movedFrom: { date: fromDate, taskId },
    updatedAt: new Date().toISOString(),
  };

  // If target has schedule, try to fit
  if (targetPlan.schedule && targetPlan.status === 'scheduled') {
    const slotResult = findSlotForSingleTask(targetPlan, movedTask);
    if (slotResult.success && slotResult.slot) {
      movedTask.scheduledStart = slotResult.slot.start;
      movedTask.scheduledEnd = slotResult.slot.end;
      targetPlan.schedule.blocks = [
        ...(targetPlan.schedule.blocks || []),
        {
          id: generateId('task-block'),
          type: 'task',
          taskId: movedTask.id,
          start: movedTask.scheduledStart,
          end: movedTask.scheduledEnd,
        },
      ];
    } else {
      targetPlan.schedule.unscheduled = [
        ...(targetPlan.schedule.unscheduled || []),
        {
          taskId: movedTask.id,
          name: movedTask.name,
          durationMinutes: movedTask.durationMinutes,
          reason: slotResult.reason || 'Could not find a free slot on this date.',
          suggestion: slotResult.suggestion || 'Shorten task or move again.',
        },
      ];
      warnings.push(`Moved task to ${toDate}, but it could not fit and was added to "Could not fit".`);
    }
  }

  // Atomic Step 1: Add to target plan
  targetPlan.tasks = [...(targetPlan.tasks || []), movedTask];

  // Atomic Step 2: Remove from source plan
  sourcePlan.tasks = sourcePlan.tasks.filter((t) => t.id !== taskId);
  if (sourcePlan.schedule) {
    if (sourcePlan.schedule.blocks) {
      sourcePlan.schedule.blocks = sourcePlan.schedule.blocks.filter(
        (b) => !(b.type === 'task' && b.taskId === taskId)
      );
    }
    if (sourcePlan.schedule.unscheduled) {
      sourcePlan.schedule.unscheduled = sourcePlan.schedule.unscheduled.filter(
        (u) => u.taskId !== taskId
      );
    }
  }

  return { ok: true, store: nextStore, warnings };
}

/**
 * Shortens task duration and re-attempts scheduling if unscheduled.
 * @param {object} store
 * @param {string} date
 * @param {string} taskId
 * @param {number} newDuration
 * @returns {{ ok: boolean, store: object, errors?: string[], warnings?: string[] }}
 */
export function shortenTask(store, date, taskId, newDuration) {
  const dur = Number(newDuration);
  if (isNaN(dur) || dur <= 0 || !Number.isInteger(dur)) {
    return { ok: false, store, errors: ['New duration must be a positive integer.'] };
  }

  return editTask(store, date, taskId, { durationMinutes: dur });
}
