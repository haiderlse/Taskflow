import { describe, it, expect } from 'vitest';
import type { Settings } from './schemas';
import { localClock, hhmmToMinutes, isWorkDay, isOfficeHours, defaultContext, weekStartOf, weekEndOf } from './time';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [],
};

describe('localClock', () => {
  it('reads the wall clock in the settings time zone', () => {
    // 04:00 UTC on Tuesday 22 Sep 2026 is 09:00 in Karachi (UTC+5).
    expect(localClock(new Date('2026-09-22T04:00:00Z'), 'Asia/Karachi')).toEqual({ date: '2026-09-22', weekday: 2, minutes: 540 });
  });

  it('rolls the calendar date with the zone, not with UTC', () => {
    // 20:30 UTC on 21 Sep is 01:30 on 22 Sep in Karachi.
    expect(localClock(new Date('2026-09-21T20:30:00Z'), 'Asia/Karachi')).toEqual({ date: '2026-09-22', weekday: 2, minutes: 90 });
  });

  it('reports midnight as minute 0, not 24 hours', () => {
    expect(localClock(new Date('2026-09-21T19:00:00Z'), 'Asia/Karachi').minutes).toBe(0);
  });
});

describe('office hours', () => {
  const at = (iso: string) => localClock(new Date(iso), SETTINGS.timezone);

  it('is a work day inside the office window, start inclusive and end exclusive', () => {
    expect(isOfficeHours(at('2026-09-22T03:15:00Z'), SETTINGS)).toBe(true); // 08:15
    expect(isOfficeHours(at('2026-09-22T12:59:00Z'), SETTINGS)).toBe(true); // 17:59
    expect(isOfficeHours(at('2026-09-22T13:00:00Z'), SETTINGS)).toBe(false); // 18:00
    expect(isOfficeHours(at('2026-09-22T03:14:00Z'), SETTINGS)).toBe(false); // 08:14
  });

  it('is never office hours on a non-work day', () => {
    const saturday = at('2026-09-26T05:00:00Z'); // 10:00 Saturday
    expect(isWorkDay(saturday, SETTINGS)).toBe(false);
    expect(isOfficeHours(saturday, SETTINGS)).toBe(false);
  });

  it('defaults capture to work in office hours and to build otherwise', () => {
    expect(defaultContext(new Date('2026-09-22T04:00:00Z'), SETTINGS)).toBe('work');
    expect(defaultContext(new Date('2026-09-22T14:00:00Z'), SETTINGS)).toBe('build');
    expect(defaultContext(new Date('2026-09-26T05:00:00Z'), SETTINGS)).toBe('build');
  });

  it('converts HH:MM to minutes', () => {
    expect(hhmmToMinutes('08:35')).toBe(515);
    expect(hhmmToMinutes('00:00')).toBe(0);
  });
});

describe('planning week', () => {
  it('starts on the configured weekday on or before the date', () => {
    expect(weekStartOf('2026-09-22', 0)).toBe('2026-09-20'); // Tuesday -> Sunday
    expect(weekStartOf('2026-09-20', 0)).toBe('2026-09-20'); // Sunday stays
    expect(weekStartOf('2026-09-20', 1)).toBe('2026-09-14'); // Sunday -> previous Monday
    expect(weekStartOf('2026-09-22', 1)).toBe('2026-09-21');
  });

  it('ends six days after it starts', () => {
    expect(weekEndOf('2026-09-22', 0)).toBe('2026-09-26');
    expect(weekEndOf('2026-12-30', 1)).toBe('2027-01-03');
  });
});
