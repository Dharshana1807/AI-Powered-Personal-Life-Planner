/**
 * Shared Conflict Engine
 * Used by both client (UI validation & preview) and server (AI proposed change verification).
 */

/**
 * Convert HH:mm to minutes from midnight (0..1439)
 * @param {string} timeStr - e.g. "09:30"
 * @returns {number} minutes from midnight
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return NaN;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight back to HH:mm string
 * @param {number} minutes
 * @returns {string} e.g. "09:30"
 */
export function minutesToTime(minutes) {
  if (isNaN(minutes)) return '00:00';
  const total = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Check if two intervals [startA, endA) and [startB, endB) overlap.
 * Intervals are treated as half-open: [start, end)
 */
export function doIntervalsOverlap(startA, endA, startB, endB) {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Check if a proposed interval overlaps with any items in a list of intervals.
 * @param {{ startTime: string, endTime: string, id?: string }} proposed
 * @param {Array<{ startTime: string, endTime: string, id?: string, title?: string }>} existingList
 * @param {string} [ignoreId] - Optional id to ignore (e.g. self when moving a task)
 * @returns {{ hasConflict: boolean, conflictingItem?: object, message?: string }}
 */
export function checkIntervalConflict(proposed, existingList, ignoreId = null) {
  const pStart = timeToMinutes(proposed.startTime);
  const pEnd = timeToMinutes(proposed.endTime);

  if (isNaN(pStart) || isNaN(pEnd)) {
    return { hasConflict: true, message: 'Invalid start or end time format.' };
  }
  if (pEnd <= pStart) {
    return { hasConflict: true, message: 'End time must be strictly after start time.' };
  }

  for (const item of existingList) {
    if (ignoreId && (item.id === ignoreId || item.taskId === ignoreId)) {
      continue;
    }
    const itemStart = timeToMinutes(item.startTime);
    const itemEnd = timeToMinutes(item.endTime);
    if (!isNaN(itemStart) && !isNaN(itemEnd)) {
      if (doIntervalsOverlap(pStart, pEnd, itemStart, itemEnd)) {
        return {
          hasConflict: true,
          conflictingItem: item,
          message: `Conflicts with "${item.title || item.name || 'another item'}" (${item.startTime} - ${item.endTime}).`,
        };
      }
    }
  }

  return { hasConflict: false };
}

/**
 * Validate that an interval fits inside user's wake boundary [wakeTime, bedTime].
 * If bedTime < wakeTime (e.g. 23:30 to 07:00), handles midnight wrapping.
 */
export function isWithinWakeHours(startTime, endTime, wakeTime, bedTime) {
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  const wake = timeToMinutes(wakeTime);
  const bed = timeToMinutes(bedTime);

  if ([s, e, wake, bed].some(isNaN)) return false;

  // Regular same-day wake hours (e.g., wake: 07:00, bed: 23:00)
  if (wake < bed) {
    return s >= wake && e <= bed;
  }
  // Overnight wake hours (e.g. wake: 06:00, bed: 01:00 next day)
  // Interval must be in [wake, 1440) or [0, bed)
  const isAfterWake = s >= wake && e <= 1440;
  const isBeforeBed = s >= 0 && e <= bed;
  return isAfterWake || isBeforeBed;
}
