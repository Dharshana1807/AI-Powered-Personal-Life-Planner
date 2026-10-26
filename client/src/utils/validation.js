/**
 * Pure Validation Module for Daily Planning Form
 * Handles time formats, overnight bedtimes, interval boundaries,
 * required constraints, and non-blocking conflict warnings.
 */

import { timeToMinutes, doIntervalsOverlap, isWithinWakeHours } from '../../../shared/conflictEngine.js';

export const VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'skipped', 'rescheduled'];

/**
 * Validates HH:mm time string.
 * @param {string} timeStr
 * @returns {boolean}
 */
export function isValidTimeHHMM(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const match = timeStr.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

/**
 * Validates YYYY-MM-DD date string.
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidDateYYYYMMDD(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const match = dateStr.trim().match(/^\d{4}-\d{2}-\d{2}$/);
  if (!match) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Checks whether start time is strictly before end time on the same day.
 * @param {string} start
 * @param {string} end
 * @returns {boolean}
 */
export function isStartBeforeEnd(start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (isNaN(s) || isNaN(e)) return false;
  return s < e;
}

/**
 * Validates wake and bedtime. Bedtime can be on the same day (e.g. 23:00)
 * or past midnight on the next calendar morning (e.g. 00:30, 01:00).
 * @param {string} wakeTime
 * @param {string} bedTime
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validateWakeAndBedTimes(wakeTime, bedTime) {
  if (!isValidTimeHHMM(wakeTime)) {
    return { isValid: false, message: 'Wake-up time must be a valid time in HH:mm format (e.g. 06:30).' };
  }
  if (!isValidTimeHHMM(bedTime)) {
    return { isValid: false, message: 'Bedtime must be a valid time in HH:mm format (e.g. 23:00).' };
  }

  const wake = timeToMinutes(wakeTime);
  const bed = timeToMinutes(bedTime);

  // If wake and bed are exactly identical, that leaves zero waking hours
  if (wake === bed) {
    return { isValid: false, message: 'Bedtime cannot be identical to wake-up time.' };
  }

  // Both are valid HH:mm; overnight bedtimes (e.g. wake 07:00, bed 01:00) are valid
  return { isValid: true };
}

/**
 * Detects overlapping intervals within an array of { id, name, start, end } items.
 * @param {Array<{ name?: string, start: string, end: string }>} items
 * @param {string} labelName
 * @returns {string[]} warning messages
 */
export function findOverlapsInList(items, labelName = 'items') {
  const warnings = [];
  if (!items || !Array.isArray(items)) return warnings;

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    const sA = timeToMinutes(a.start);
    const eA = timeToMinutes(a.end);
    if (isNaN(sA) || isNaN(eA)) continue;

    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      const sB = timeToMinutes(b.start);
      const eB = timeToMinutes(b.end);
      if (isNaN(sB) || isNaN(eB)) continue;

      if (doIntervalsOverlap(sA, eA, sB, eB)) {
        warnings.push(
          `Overlapping ${labelName}: "${a.name || 'Item ' + (i + 1)}" (${a.start}-${a.end}) overlaps with "${b.name || 'Item ' + (j + 1)}" (${b.start}-${b.end}).`
        );
      }
    }
  }
  return warnings;
}

/**
 * Validates a single step or the entire form.
 * @param {number} step - Step number (1, 2, 3, 4, 5)
 * @param {object} formData - Form data
 * @param {{ isGenerating?: boolean }} [options]
 * @returns {{ isValid: boolean, errors: Record<string, string>, warnings: string[] }}
 */
export function validateStep(step, formData, options = {}) {
  const errors = {};
  const warnings = [];
  const { isGenerating = false } = options;

  // STEP 1: About Your Day
  if (step === 1 || step === 5) {
    if (!formData.userType || !['student', 'professional', 'both'].includes(formData.userType)) {
      errors.userType = 'Please select your role (Student, Working Professional, or Both).';
    }
    if (!formData.date || !isValidDateYYYYMMDD(formData.date)) {
      errors.date = 'Please select a valid plan date in YYYY-MM-DD format.';
    }
    if (!formData.wakeTime) {
      errors.wakeTime = 'Wake-up time is required (e.g. 06:30).';
    } else if (!isValidTimeHHMM(formData.wakeTime)) {
      errors.wakeTime = 'Invalid wake-up time format (use HH:mm).';
    }

    if (!formData.bedTime) {
      errors.bedTime = 'Bedtime is required (e.g. 23:00).';
    } else if (!isValidTimeHHMM(formData.bedTime)) {
      errors.bedTime = 'Invalid bedtime format (use HH:mm).';
    }

    if (formData.wakeTime && formData.bedTime && isValidTimeHHMM(formData.wakeTime) && isValidTimeHHMM(formData.bedTime)) {
      const wakeBedCheck = validateWakeAndBedTimes(formData.wakeTime, formData.bedTime);
      if (!wakeBedCheck.isValid) {
        errors.bedTime = wakeBedCheck.message;
      }
    }
  }

  // STEP 2: Fixed Commitments
  if (step === 2 || step === 5) {
    const hasWork = ['student', 'professional', 'both'].includes(formData.userType);
    if (hasWork && formData.workHours) {
      const { start, end } = formData.workHours;
      if (start || end) {
        if (!start || !isValidTimeHHMM(start)) {
          errors.workHoursStart = 'College/work start time is invalid (use HH:mm).';
        }
        if (!end || !isValidTimeHHMM(end)) {
          errors.workHoursEnd = 'College/work end time is invalid (use HH:mm).';
        }
        if (start && end && isValidTimeHHMM(start) && isValidTimeHHMM(end) && !isStartBeforeEnd(start, end)) {
          errors.workHoursEnd = 'Work/college end time must be after start time.';
        }
        // Warning: outside waking hours
        if (start && end && formData.wakeTime && formData.bedTime) {
          if (!isWithinWakeHours(start, end, formData.wakeTime, formData.bedTime)) {
            warnings.push(`Work/college hours (${start} - ${end}) extend outside your configured waking hours.`);
          }
        }
      }
    }

    // Travel time validation
    if (formData.travelMinutes !== undefined && formData.travelMinutes !== null && formData.travelMinutes !== '') {
      const travel = Number(formData.travelMinutes);
      if (isNaN(travel) || travel < 0 || !Number.isInteger(travel)) {
        errors.travelMinutes = 'Travel time must be a non-negative whole number of minutes.';
      }
    }

    // Meals validation
    if (Array.isArray(formData.meals)) {
      formData.meals.forEach((meal, idx) => {
        if (!meal.name || !meal.name.trim()) {
          errors[`meal_${idx}_name`] = `Meal #${idx + 1} requires a name (e.g. Lunch).`;
        }
        if (!meal.start || !isValidTimeHHMM(meal.start)) {
          errors[`meal_${idx}_start`] = `Meal #${idx + 1} requires a valid start time (HH:mm).`;
        }
        if (!meal.end || !isValidTimeHHMM(meal.end)) {
          errors[`meal_${idx}_end`] = `Meal #${idx + 1} requires a valid end time (HH:mm).`;
        }
        if (meal.start && meal.end && isValidTimeHHMM(meal.start) && isValidTimeHHMM(meal.end) && !isStartBeforeEnd(meal.start, meal.end)) {
          errors[`meal_${idx}_end`] = `Meal #${idx + 1} end time must be after start time.`;
        }
        // Warning: outside waking hours
        if (meal.start && meal.end && formData.wakeTime && formData.bedTime) {
          if (!isWithinWakeHours(meal.start, meal.end, formData.wakeTime, formData.bedTime)) {
            warnings.push(`Meal "${meal.name || idx + 1}" (${meal.start}-${meal.end}) falls outside waking hours.`);
          }
        }
      });
      warnings.push(...findOverlapsInList(formData.meals, 'meals'));
    }

    // Commitments validation
    if (Array.isArray(formData.commitments)) {
      formData.commitments.forEach((comm, idx) => {
        if (!comm.name || !comm.name.trim()) {
          errors[`comm_${idx}_name`] = `Commitment #${idx + 1} requires a description/name.`;
        }
        if (!comm.start || !isValidTimeHHMM(comm.start)) {
          errors[`comm_${idx}_start`] = `Commitment #${idx + 1} requires a valid start time (HH:mm).`;
        }
        if (!comm.end || !isValidTimeHHMM(comm.end)) {
          errors[`comm_${idx}_end`] = `Commitment #${idx + 1} requires a valid end time (HH:mm).`;
        }
        if (comm.start && comm.end && isValidTimeHHMM(comm.start) && isValidTimeHHMM(comm.end) && !isStartBeforeEnd(comm.start, comm.end)) {
          errors[`comm_${idx}_end`] = `Commitment #${idx + 1} end time must be after start time.`;
        }
        // Warning: outside waking hours
        if (comm.start && comm.end && formData.wakeTime && formData.bedTime) {
          if (!isWithinWakeHours(comm.start, comm.end, formData.wakeTime, formData.bedTime)) {
            warnings.push(`Commitment "${comm.name || idx + 1}" (${comm.start}-${comm.end}) falls outside waking hours.`);
          }
        }
      });
      warnings.push(...findOverlapsInList(formData.commitments, 'commitments'));
    }
  }

  // STEP 3: Free Time & Priorities
  if (step === 3 || step === 5) {
    if (Array.isArray(formData.freeSlots)) {
      formData.freeSlots.forEach((slot, idx) => {
        if (!slot.start || !isValidTimeHHMM(slot.start)) {
          errors[`slot_${idx}_start`] = `Free slot #${idx + 1} requires a valid start time (HH:mm).`;
        }
        if (!slot.end || !isValidTimeHHMM(slot.end)) {
          errors[`slot_${idx}_end`] = `Free slot #${idx + 1} requires a valid end time (HH:mm).`;
        }
        if (slot.start && slot.end && isValidTimeHHMM(slot.start) && isValidTimeHHMM(slot.end) && !isStartBeforeEnd(slot.start, slot.end)) {
          errors[`slot_${idx}_end`] = `Free slot #${idx + 1} end time must be after start time.`;
        }
        if (slot.start && slot.end && formData.wakeTime && formData.bedTime) {
          if (!isWithinWakeHours(slot.start, slot.end, formData.wakeTime, formData.bedTime)) {
            warnings.push(`Free slot #${idx + 1} (${slot.start}-${slot.end}) falls outside waking hours.`);
          }
        }
      });
      warnings.push(...findOverlapsInList(formData.freeSlots, 'free time slots'));
    }
  }

  // STEP 4: Tasks
  if (step === 4 || step === 5) {
    const tasks = Array.isArray(formData.tasks) ? formData.tasks : [];

    if (isGenerating && tasks.length === 0) {
      errors.tasks = 'Add at least one task to generate a plan.';
    }

    tasks.forEach((task, idx) => {
      if (!task.name || !task.name.trim()) {
        errors[`task_${idx}_name`] = `Task #${idx + 1} requires a name.`;
      }
      const dur = Number(task.durationMinutes);
      if (!task.durationMinutes || isNaN(dur) || dur <= 0 || !Number.isInteger(dur)) {
        errors[`task_${idx}_duration`] = `Task #${idx + 1} duration must be a positive whole number of minutes.`;
      }
      if (task.status && !VALID_TASK_STATUSES.includes(task.status)) {
        errors[`task_${idx}_status`] = `Task #${idx + 1} status "${task.status}" is invalid.`;
      }
      if (task.preferredTime && !isValidTimeHHMM(task.preferredTime)) {
        errors[`task_${idx}_preferredTime`] = `Task #${idx + 1} preferred time must be in HH:mm format.`;
      }
      if (task.deadlineDate && !isValidDateYYYYMMDD(task.deadlineDate)) {
        errors[`task_${idx}_deadlineDate`] = `Task #${idx + 1} deadline date must be in YYYY-MM-DD format.`;
      }
      if (task.deadlineTime && !isValidTimeHHMM(task.deadlineTime)) {
        errors[`task_${idx}_deadlineTime`] = `Task #${idx + 1} deadline time must be in HH:mm format.`;
      }
    });
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}
