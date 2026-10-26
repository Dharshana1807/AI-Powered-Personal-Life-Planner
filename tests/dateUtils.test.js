import { describe, it, expect } from 'vitest';
import {
  toLocalISODate,
  formatLocalDateString,
  generateId,
  formatDisplayDate,
  format12Hour,
  to24Hour,
  parseTo12HourComponents,
} from '../client/src/utils/dateUtils.js';

describe('Date Utilities - Local Calendar Dates', () => {
  it('returns local calendar date YYYY-MM-DD instead of UTC date', () => {
    const localDate = new Date(2026, 9, 12, 2, 0, 0); // Month is 0-indexed: 9 = October
    const result = toLocalISODate(localDate);
    expect(result).toBe('2026-10-12');
  });

  it('formats dates consistently without shifting days', () => {
    const formatted = formatLocalDateString('2026-10-12');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('October');
    expect(formatted).toContain('12');
  });

  it('formats dates as "20 Oct 2026"', () => {
    expect(formatDisplayDate('2026-10-20')).toBe('20 Oct 2026');
    expect(formatDisplayDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDisplayDate('2026-12-31')).toBe('31 Dec 2026');
  });

  it('formats 24h time to 12h display time accurately', () => {
    expect(format12Hour('01:00')).toBe('1:00 AM');
    expect(format12Hour('06:00')).toBe('6:00 AM');
    expect(format12Hour('09:00')).toBe('9:00 AM');
    expect(format12Hour('12:00')).toBe('12:00 PM');
    expect(format12Hour('12:30')).toBe('12:30 PM');
    expect(format12Hour('13:15')).toBe('1:15 PM');
    expect(format12Hour('16:30')).toBe('4:30 PM');
    expect(format12Hour('20:45')).toBe('8:45 PM');
    expect(format12Hour('21:00')).toBe('9:00 PM');
    expect(format12Hour('23:59')).toBe('11:59 PM');
    expect(format12Hour('00:00')).toBe('12:00 AM');
    expect(format12Hour('00:45')).toBe('12:45 AM');
  });

  it('parses and converts 12h components to 24h time', () => {
    expect(to24Hour(1, '00', 'AM')).toBe('01:00');
    expect(to24Hour(4, '30', 'PM')).toBe('16:30');
    expect(to24Hour(9, '00', 'PM')).toBe('21:00');
    expect(to24Hour(12, '00', 'AM')).toBe('00:00');
    expect(to24Hour(12, '00', 'PM')).toBe('12:00');

    const parsed = parseTo12HourComponents('16:30');
    expect(parsed.hour).toBe(4);
    expect(parsed.minute).toBe('30');
    expect(parsed.period).toBe('PM');
    expect(parsed.formatted).toBe('4:30 PM');
  });

  it('generates unique IDs with proper prefix', () => {
    const id1 = generateId('task');
    const id2 = generateId('task');
    expect(id1).toMatch(/^task-/);
    expect(id2).toMatch(/^task-/);
    expect(id1).not.toBe(id2);
  });
});

describe('Date Utilities - Day Parts and Time Ranges', () => {
  it('correctly maps 24h start times to Day-Part labels', async () => {
    const { getDayPart } = await import('../client/src/utils/dateUtils.js');
    // Morning: 5:00 AM to 11:59 AM
    expect(getDayPart('05:00')).toBe('Morning');
    expect(getDayPart('06:00')).toBe('Morning');
    expect(getDayPart('11:59')).toBe('Morning');

    // Afternoon: 12:00 PM to 4:59 PM
    expect(getDayPart('12:00')).toBe('Afternoon');
    expect(getDayPart('12:30')).toBe('Afternoon');
    expect(getDayPart('16:30')).toBe('Afternoon');
    expect(getDayPart('16:59')).toBe('Afternoon');

    // Evening: 5:00 PM to 8:59 PM
    expect(getDayPart('17:00')).toBe('Evening');
    expect(getDayPart('18:30')).toBe('Evening');
    expect(getDayPart('20:45')).toBe('Evening');
    expect(getDayPart('20:59')).toBe('Evening');

    // Night: 9:00 PM to 4:59 AM
    expect(getDayPart('21:00')).toBe('Night');
    expect(getDayPart('22:00')).toBe('Night');
    expect(getDayPart('23:59')).toBe('Night');
    expect(getDayPart('00:00')).toBe('Night');
    expect(getDayPart('04:59')).toBe('Night');
  });

  it('formats time ranges and free slots in 12-hour format with uppercase AM/PM and no leading zeroes', async () => {
    const { formatTimeRange12h, formatFreeSlot12h } = await import('../client/src/utils/dateUtils.js');
    expect(formatTimeRange12h('06:00', '08:00')).toBe('6:00 AM - 8:00 AM');
    expect(formatTimeRange12h('16:30', '20:00')).toBe('4:30 PM - 8:00 PM');
    expect(formatTimeRange12h('20:45', '22:00')).toBe('8:45 PM - 10:00 PM');
    expect(formatTimeRange12h('00:00', '01:00')).toBe('12:00 AM - 1:00 AM');
    expect(formatTimeRange12h('12:00', '13:00')).toBe('12:00 PM - 1:00 PM');

    expect(formatFreeSlot12h('06:00', '08:00', 120)).toBe('Free: 6:00 AM - 8:00 AM (120 min)');
    expect(formatFreeSlot12h('16:30', '20:00', 210)).toBe('Free: 4:30 PM - 8:00 PM (210 min)');
    expect(formatFreeSlot12h('20:45', '22:00', 75)).toBe('Free: 8:45 PM - 10:00 PM (75 min)');
  });

  it('parses user natural language times like "5 PM", "5pm", "17:00", "5:30 in the evening"', async () => {
    const { parseUserTimeString, extractTimeFromText } = await import('../client/src/utils/dateUtils.js');
    expect(parseUserTimeString('5 PM')).toBe('17:00');
    expect(parseUserTimeString('5pm')).toBe('17:00');
    expect(parseUserTimeString('5:30 PM')).toBe('17:30');
    expect(parseUserTimeString('17:00')).toBe('17:00');
    expect(parseUserTimeString('5:30 in the evening')).toBe('17:30');
    expect(parseUserTimeString('6 in the morning')).toBe('06:00');
    expect(parseUserTimeString('12:00 PM')).toBe('12:00');
    expect(parseUserTimeString('12:00 AM')).toBe('00:00');
    expect(parseUserTimeString('noon')).toBe('12:00');
    expect(parseUserTimeString('midnight')).toBe('00:00');

    // extractTimeFromText inside conversational messages
    expect(extractTimeFromText('Move English practice to 5 PM')).toBe('17:00');
    expect(extractTimeFromText('Can we do this at 5pm?')).toBe('17:00');
    expect(extractTimeFromText('Schedule gym for 17:00')).toBe('17:00');
    expect(extractTimeFromText('Let us practice at 5:30 in the evening please')).toBe('17:30');
    expect(extractTimeFromText('Wake me at 6 in the morning')).toBe('06:00');
  });
});
