/**
 * Date and ID Utility Functions
 * Uses local calendar date representations exclusively (never toISOString())
 * to avoid timezone offset regressions.
 */

/**
 * Returns a calendar date string in YYYY-MM-DD format using local year, month, and day.
 * @param {Date|number|string} [date=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function toLocalISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD local date into a user-friendly string (e.g. "Monday, October 12, 2026").
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
export function formatLocalDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const localDate = new Date(year, month, day);
  return localDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generates a unique identifier with crypto.randomUUID() and safe fallback.
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Safe fallback
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${Date.now()}-${rand}`;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Formats a YYYY-MM-DD string into "20 Oct 2026"
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(monthIdx) || isNaN(day) || monthIdx < 0 || monthIdx > 11) {
    return dateStr;
  }
  return `${day} ${MONTH_NAMES_SHORT[monthIdx]} ${year}`;
}

/**
 * Converts a 24-hour time string ("HH:mm") to 12-hour display format ("1:00 AM", "4:30 PM", "9:00 PM").
 * Always returns 12-hour format without leading zeros on the hour.
 * 12:00 PM is noon and 12:00 AM is midnight.
 * @param {string} timeStr - "HH:mm"
 * @returns {string}
 */
export function formatTime12h(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return timeStr;

  const period = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  const minStr = String(minute).padStart(2, '0');
  return `${hour}:${minStr} ${period}`;
}

/** Backward-compatible alias for formatTime12h */
export const format12Hour = formatTime12h;

/**
 * Formats a time range into 12-hour AM/PM format (e.g. "6:00 AM - 8:00 AM", "4:30 PM - 8:00 PM").
 * @param {string} startTime - "HH:mm"
 * @param {string} endTime - "HH:mm"
 * @returns {string}
 */
export function formatTimeRange12h(startTime, endTime) {
  if (!startTime && !endTime) return '';
  if (startTime && !endTime) return formatTime12h(startTime);
  if (!startTime && endTime) return formatTime12h(endTime);
  return `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`;
}

/**
 * Formats a free slot string in 12-hour format: "Free: 6:00 AM - 8:00 AM (120 min)"
 * @param {string} start - "HH:mm"
 * @param {string} end - "HH:mm"
 * @param {number|string} durationMinutes
 * @returns {string}
 */
export function formatFreeSlot12h(start, end, durationMinutes) {
  return `Free: ${formatTimeRange12h(start, end)} (${durationMinutes} min)`;
}

/**
 * Returns the day part for a given 24-hour "HH:mm" time string:
 * - Morning: 5:00 AM to 11:59 AM (05:00 - 11:59)
 * - Afternoon: 12:00 PM to 4:59 PM (12:00 - 16:59)
 * - Evening: 5:00 PM to 8:59 PM (17:00 - 20:59)
 * - Night: 9:00 PM to 4:59 AM (21:00 - 04:59)
 * @param {string} timeStr - "HH:mm"
 * @returns {'Morning' | 'Afternoon' | 'Evening' | 'Night'}
 */
export function getDayPart(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 'Morning';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return 'Morning';
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 'Morning';

  const totalMinutes = h * 60 + m;

  // Morning: 5:00 AM (300m) to 11:59 AM (719m)
  if (totalMinutes >= 300 && totalMinutes < 720) {
    return 'Morning';
  }
  // Afternoon: 12:00 PM (720m) to 4:59 PM (1019m)
  if (totalMinutes >= 720 && totalMinutes < 1020) {
    return 'Afternoon';
  }
  // Evening: 5:00 PM (1020m) to 8:59 PM (1259m)
  if (totalMinutes >= 1020 && totalMinutes < 1260) {
    return 'Evening';
  }
  // Night: 9:00 PM (1260m) to 4:59 AM (299m)
  return 'Night';
}

/** Day part metadata configuration */
export const DAY_PARTS_ORDER = [
  { id: 'Morning', label: 'Morning', range: '5:00 AM to 11:59 AM', icon: '🌅' },
  { id: 'Afternoon', label: 'Afternoon', range: '12:00 PM to 4:59 PM', icon: '☀️' },
  { id: 'Evening', label: 'Evening', range: '5:00 PM to 8:59 PM', icon: '🌆' },
  { id: 'Night', label: 'Night', range: '9:00 PM to 4:59 AM', icon: '🌙' },
];

/**
 * Parses user input strings like "5 PM", "5pm", "17:00", "5:30 in the evening",
 * "noon", "midnight", etc. into standard 24-hour "HH:mm".
 * @param {string} inputStr
 * @returns {string|null} "HH:mm" or null if unparseable
 */
export function parseUserTimeString(inputStr) {
  if (!inputStr || typeof inputStr !== 'string') return null;
  const s = inputStr.trim().toLowerCase();

  if (s === 'noon' || s === '12 noon' || s === 'midday') return '12:00';
  if (s === 'midnight') return '00:00';

  // Check 24-hour format: "HH:mm" or "H:mm" (e.g. "17:00", "9:30", "09:30")
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const m = parseInt(match24[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // Check 12-hour with optional minutes and AM/PM: e.g. "5 pm", "5pm", "5:30pm", "5:30 pm", "12 am"
  const match12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2] ? parseInt(match12[2], 10) : 0;
    const period = match12[3].toUpperCase();
    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      return to24Hour(h, m, period);
    }
  }

  // Check descriptive day-part phrases:
  // e.g. "5:30 in the evening", "5 in the evening", "6 in the morning", "2 in the afternoon", "10 at night"
  const matchDescriptive = s.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(?:in the\s+|at\s+)?(morning|afternoon|evening|night)$/i
  );
  if (matchDescriptive) {
    let h = parseInt(matchDescriptive[1], 10);
    const m = matchDescriptive[2] ? parseInt(matchDescriptive[2], 10) : 0;
    const part = matchDescriptive[3].toLowerCase();

    if (h >= 1 && h <= 12 && m >= 0 && m <= 59) {
      if (part === 'morning') {
        return to24Hour(h, m, 'AM');
      } else if (part === 'afternoon' || part === 'evening') {
        return to24Hour(h, m, 'PM');
      } else if (part === 'night') {
        if (h === 12) return '00:00';
        if (h >= 7 && h <= 11) return to24Hour(h, m, 'PM');
        if (h >= 1 && h <= 6) return to24Hour(h, m, 'AM');
        return to24Hour(h, m, 'PM');
      }
    }
  }

  return null;
}

/**
 * Extracts and parses a time string from a larger conversational text sentence.
 * e.g. "Move English practice to 5 PM" -> "17:00"
 * @param {string} text
 * @returns {string | null}
 */
export function extractTimeFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. "12 noon", "noon", "midnight"
  const specialMatch = text.match(/\b(noon|12\s*noon|midnight)\b/i);
  if (specialMatch) {
    const parsed = parseUserTimeString(specialMatch[1]);
    if (parsed) return parsed;
  }

  // 2. Descriptive: e.g. "5:30 in the evening", "5 in the evening", "6 in the morning", "10 at night", "2 in the afternoon"
  const descMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:in the\s+|at\s+)(?:morning|afternoon|evening|night))\b/i);
  if (descMatch) {
    const parsed = parseUserTimeString(descMatch[1]);
    if (parsed) return parsed;
  }

  // 3. AM/PM: e.g. "5:30 PM", "5pm", "5 PM", "11:59pm", "12:00 AM"
  const ampmMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (ampmMatch) {
    const parsed = parseUserTimeString(ampmMatch[1]);
    if (parsed) return parsed;
  }

  // 4. 24h: e.g. "17:00", "08:30"
  const hhmmMatch = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmmMatch) {
    const parsed = parseUserTimeString(hhmmMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}


/**
 * Parses a 24-hour time string ("HH:mm") into 12-hour components: { hour: 1-12, minute: "00", period: "AM"|"PM", formatted: "1:00 AM" }
 * @param {string} timeStr - "HH:mm"
 * @returns {{ hour: number, minute: string, period: 'AM'|'PM', formatted: string }}
 */
export function parseTo12HourComponents(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hour: 12, minute: '00', period: 'AM', formatted: '12:00 AM' };
  }
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    return { hour: 12, minute: '00', period: 'AM', formatted: '12:00 AM' };
  }
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) {
    return { hour: 12, minute: '00', period: 'AM', formatted: '12:00 AM' };
  }
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  const minStr = String(m).padStart(2, '0');
  return {
    hour: h,
    minute: minStr,
    period,
    formatted: `${h}:${minStr} ${period}`,
  };
}

/**
 * Converts 12-hour components into a standard 24-hour "HH:mm" string for internal storage and logic.
 * @param {number|string} hour12 - 1 to 12
 * @param {number|string} minute - 0 to 59
 * @param {'AM'|'PM'|string} period - "AM" or "PM"
 * @returns {string} "HH:mm"
 */
export function to24Hour(hour12, minute, period = 'AM') {
  let h = parseInt(hour12, 10);
  if (isNaN(h) || h < 1) h = 12;
  if (h > 12) h = 12;
  const m = parseInt(minute, 10);
  const minStr = isNaN(m) ? '00' : String(Math.max(0, Math.min(59, m))).padStart(2, '0');
  const p = String(period).trim().toUpperCase();

  if (p === 'AM') {
    if (h === 12) h = 0;
  } else {
    if (h < 12) h += 12;
  }
  return `${String(h).padStart(2, '0')}:${minStr}`;
}

/**
 * Validates a 24-hour "HH:mm" time string.
 * @param {string} val
 * @returns {boolean}
 */
export function isValidTimeHHMM(val) {
  if (!val || typeof val !== 'string') return false;
  const match = val.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(match);
}

/**
 * Validates a "YYYY-MM-DD" date string.
 * @param {string} val
 * @returns {boolean}
 */
export function isValidDateYYYYMMDD(val) {
  if (!val || typeof val !== 'string') return false;
  const match = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const testDate = new Date(y, m - 1, d);
  return (
    testDate.getFullYear() === y &&
    testDate.getMonth() === m - 1 &&
    testDate.getDate() === d
  );
}
