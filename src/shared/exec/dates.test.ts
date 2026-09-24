import { describe, it, expect } from 'vitest';
import { isCalendarDate, addDays, compareDates, toCalendarDate } from './dates';

describe('isCalendarDate', () => {
  it.each(['2026-09-22', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-09-31', '2026-9-1', '22-09-2026', '2026-09-22T00:00:00Z', ''])(
    'rejects %j',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    }
  );
});

describe('addDays', () => {
  it('crosses month and year ends in calendar space', () => {
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-22', 0)).toBe('2026-09-22');
  });
});

describe('compareDates and toCalendarDate', () => {
  it('orders calendar dates and formats a UTC instant', () => {
    expect(compareDates('2026-09-21', '2026-09-22')).toBeLessThan(0);
    expect(compareDates('2026-09-22', '2026-09-22')).toBe(0);
    expect(compareDates('2026-10-01', '2026-09-30')).toBeGreaterThan(0);
    expect(toCalendarDate(new Date('2026-09-22T23:59:59Z'))).toBe('2026-09-22');
  });
});
