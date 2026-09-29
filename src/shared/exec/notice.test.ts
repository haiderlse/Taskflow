import { describe, it, expect } from 'vitest';
import { noticeDue } from './notice';
import type { Settings } from './schemas';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi', weekStartDay: 0, workDays: [1, 2, 3, 4, 5], deepWorkStart: '08:35', deepWorkMinutes: 90,
  shutdownTime: '17:00', officeStart: '08:15', officeEnd: '18:00', buildBlocks: [],
};
/** Karachi is UTC+5: a local HH:MM on a date as a Date. */
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = h * 60 + m - 300;
  return new Date(`${date}T${String(Math.floor(utc / 60)).padStart(2, '0')}:${String(utc % 60).padStart(2, '0')}:00Z`);
};

describe('noticeDue', () => {
  it('is due from five minutes before deep work until it starts, on a work day', () => {
    expect(noticeDue(at('2026-09-29', '08:29'), SETTINGS)).toBeNull();
    expect(noticeDue(at('2026-09-29', '08:30'), SETTINGS)).toBe('2026-09-29');
    expect(noticeDue(at('2026-09-29', '08:34'), SETTINGS)).toBe('2026-09-29');
    expect(noticeDue(at('2026-09-29', '08:35'), SETTINGS)).toBeNull();
  });

  it('is never due on a non-work day, or when there are no work days', () => {
    expect(noticeDue(at('2026-10-03', '08:31'), SETTINGS)).toBeNull();
    expect(noticeDue(at('2026-09-29', '08:31'), { ...SETTINGS, workDays: [] })).toBeNull();
  });

  it('follows a changed start time', () => {
    expect(noticeDue(at('2026-09-29', '09:56'), { ...SETTINGS, deepWorkStart: '10:00' })).toBe('2026-09-29');
  });
});
