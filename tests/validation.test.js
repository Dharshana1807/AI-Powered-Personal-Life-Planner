import { describe, it, expect } from 'vitest';
import {
  isValidTimeHHMM,
  isValidDateYYYYMMDD,
  isStartBeforeEnd,
  validateWakeAndBedTimes,
  validateStep,
} from '../client/src/utils/validation.js';

describe('Validation Utility Tests', () => {
  describe('Time and Date Format Checks', () => {
    it('validates HH:mm time format correctly', () => {
      expect(isValidTimeHHMM('00:00')).toBe(true);
      expect(isValidTimeHHMM('06:30')).toBe(true);
      expect(isValidTimeHHMM('23:59')).toBe(true);
      expect(isValidTimeHHMM('24:00')).toBe(false);
      expect(isValidTimeHHMM('12:60')).toBe(false);
      expect(isValidTimeHHMM('6:30')).toBe(false);
      expect(isValidTimeHHMM('')).toBe(false);
      expect(isValidTimeHHMM(null)).toBe(false);
    });

    it('validates YYYY-MM-DD date format correctly', () => {
      expect(isValidDateYYYYMMDD('2026-10-12')).toBe(true);
      expect(isValidDateYYYYMMDD('2026-02-28')).toBe(true);
      expect(isValidDateYYYYMMDD('2026-02-30')).toBe(false);
      expect(isValidDateYYYYMMDD('12-10-2026')).toBe(false);
      expect(isValidDateYYYYMMDD('')).toBe(false);
    });

    it('verifies start time is before end time', () => {
      expect(isStartBeforeEnd('09:00', '10:00')).toBe(true);
      expect(isStartBeforeEnd('10:00', '09:00')).toBe(false);
      expect(isStartBeforeEnd('10:00', '10:00')).toBe(false);
    });
  });

  describe('Overnight Bedtime Support', () => {
    it('accepts bedtime after midnight as a valid schedule boundary', () => {
      // e.g. Waking at 06:00 and sleeping at 00:30 (next morning)
      const res = validateWakeAndBedTimes('06:00', '00:30');
      expect(res.isValid).toBe(true);
    });

    it('accepts standard same-day bedtime', () => {
      const res = validateWakeAndBedTimes('07:00', '23:00');
      expect(res.isValid).toBe(true);
    });

    it('rejects identical wake and bed time', () => {
      const res = validateWakeAndBedTimes('07:00', '07:00');
      expect(res.isValid).toBe(false);
    });
  });

  describe('Multi-step Form Validation', () => {
    it('validates Step 1 required fields', () => {
      const invalidData = { userType: '', date: '', wakeTime: '', bedTime: '' };
      const result = validateStep(1, invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.userType).toBeDefined();
      expect(result.errors.date).toBeDefined();
      expect(result.errors.wakeTime).toBeDefined();
      expect(result.errors.bedTime).toBeDefined();
    });

    it('passes Step 1 with valid entries', () => {
      const validData = {
        userType: 'student',
        date: '2026-10-12',
        wakeTime: '06:30',
        bedTime: '23:30',
      };
      const result = validateStep(1, validData);
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('detects inverted meal times in Step 2', () => {
      const data = {
        userType: 'student',
        meals: [{ id: '1', name: 'Lunch', start: '14:00', end: '13:00' }],
      };
      const result = validateStep(2, data);
      expect(result.isValid).toBe(false);
      expect(result.errors.meal_0_end).toContain('must be after start time');
    });

    it('generates warnings for overlapping commitments without blocking valid inputs', () => {
      const data = {
        userType: 'student',
        commitments: [
          { id: '1', name: 'Meeting A', start: '10:00', end: '11:00' },
          { id: '2', name: 'Meeting B', start: '10:30', end: '11:30' },
        ],
      };
      const result = validateStep(2, data);
      // Still valid from a form completion perspective, but contains warning
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Overlapping commitments');
    });

    it('requires at least one task when isGenerating is true', () => {
      const data = {
        userType: 'student',
        date: '2026-10-12',
        wakeTime: '06:00',
        bedTime: '23:00',
        tasks: [],
      };
      const resultGen = validateStep(4, data, { isGenerating: true });
      expect(resultGen.isValid).toBe(false);
      expect(resultGen.errors.tasks).toBeDefined();

      const resultSave = validateStep(4, data, { isGenerating: false });
      expect(resultSave.isValid).toBe(true);
    });

    it('validates task duration is a positive whole number', () => {
      const data = {
        tasks: [{ id: '1', name: 'Study', durationMinutes: -30 }],
      };
      const result = validateStep(4, data);
      expect(result.isValid).toBe(false);
      expect(result.errors.task_0_duration).toBeDefined();
    });
  });
});
