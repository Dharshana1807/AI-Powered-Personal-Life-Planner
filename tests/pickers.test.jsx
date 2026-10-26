import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import DatePicker from '../client/src/components/common/DatePicker.jsx';
import TimePicker from '../client/src/components/common/TimePicker.jsx';
import { formatDisplayDate, format12Hour, to24Hour } from '../client/src/utils/dateUtils.js';

describe('DatePicker Component', () => {
  it('renders trigger button displaying date in "20 Oct 2026" format and never allows raw typing', () => {
    const html = renderToString(
      React.createElement(DatePicker, {
        id: 'test-date',
        label: 'Plan Date',
        value: '2026-10-20',
        onChange: () => {},
      })
    );

    expect(html).toContain('20 Oct 2026');
    expect(html).toContain('Plan Date');
    // Button element for trigger, not raw text input
    expect(html).toContain('<button');
    expect(html).not.toContain('type="text"');
  });

  it('formats dates consistently using formatDisplayDate', () => {
    expect(formatDisplayDate('2026-10-20')).toBe('20 Oct 2026');
    expect(formatDisplayDate('2026-05-04')).toBe('4 May 2026');
  });
});

describe('TimePicker Component', () => {
  it('renders trigger button displaying time in 12-hour format and never allows raw typing', () => {
    const html = renderToString(
      React.createElement(TimePicker, {
        id: 'test-time',
        label: 'Wake-Up Time',
        value: '06:30',
        onChange: () => {},
      })
    );

    expect(html).toContain('6:30 AM');
    expect(html).toContain('Wake-Up Time');
    expect(html).toContain('<button');
    expect(html).not.toContain('type="text"');
  });

  it('formats afternoon and evening times with PM', () => {
    expect(format12Hour('14:30')).toBe('2:30 PM');
    expect(format12Hour('21:00')).toBe('9:00 PM');
    expect(format12Hour('12:00')).toBe('12:00 PM');
    expect(format12Hour('00:00')).toBe('12:00 AM');
  });

  it('converts 12-hour parts accurately into 24-hour string for internal storage', () => {
    expect(to24Hour(6, '30', 'AM')).toBe('06:30');
    expect(to24Hour(2, '30', 'PM')).toBe('14:30');
    expect(to24Hour(12, '00', 'PM')).toBe('12:00');
    expect(to24Hour(12, '00', 'AM')).toBe('00:00');
  });
});
