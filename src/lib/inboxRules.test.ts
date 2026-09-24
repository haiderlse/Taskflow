import { describe, it, expect } from 'vitest';
import { scheduleStatus, tomorrowFrom } from './inboxRules';

describe('inbox rules', () => {
  it('commits a date inside the current week and parks anything later', () => {
    // Today is Tuesday 22 Sep 2026; the Sunday-start week runs 20–26 Sep.
    expect(scheduleStatus('2026-09-25', '2026-09-22', 0)).toBe('this_week');
    expect(scheduleStatus('2026-09-26', '2026-09-22', 0)).toBe('this_week');
    expect(scheduleStatus('2026-09-27', '2026-09-22', 0)).toBe('later');
    expect(scheduleStatus('2026-09-21', '2026-09-22', 1)).toBe('this_week'); // Monday-start week: 21–27
    expect(scheduleStatus('2026-09-20', '2026-09-22', 1)).toBe('later');
  });

  it('defaults follow-ups and schedules to tomorrow', () => {
    expect(tomorrowFrom('2026-09-30')).toBe('2026-10-01');
  });
});
