import { describe, it, expect } from 'vitest';
import { dayInWeek, fridayOf, weekNumber, weekRangeLabel, contextOf } from './week';

describe('week helpers', () => {
  it('finds a weekday inside the seven days from the start', () => {
    expect(dayInWeek('2026-09-20', 0)).toBe('2026-09-20');
    expect(dayInWeek('2026-09-20', 6)).toBe('2026-09-26');
    expect(dayInWeek('2026-09-21', 0)).toBe('2026-09-27'); // Monday-start week: its Sunday is last
    expect(fridayOf('2026-09-20')).toBe('2026-09-25');
    expect(fridayOf('2026-09-21')).toBe('2026-09-25');
  });

  it('numbers the week by the ISO week of its Thursday', () => {
    expect(weekNumber('2026-09-20')).toBe(39);
    expect(weekNumber('2026-09-21')).toBe(39);
    expect(weekNumber('2025-12-28')).toBe(1); // Thursday 1 Jan 2026 is in ISO week 1
    expect(weekNumber('2026-12-27')).toBe(53); // Thursday 31 Dec 2026 is in ISO week 53
  });

  it('labels the date range', () => {
    expect(weekRangeLabel('2026-09-20')).toBe('20–26 Sep');
    expect(weekRangeLabel('2026-09-27')).toBe('27 Sep – 3 Oct');
  });

  it('derives the context from the category', () => {
    expect(contextOf('office')).toBe('work');
    expect(contextOf('business')).toBe('build');
    expect(contextOf('career')).toBe('build');
    expect(contextOf('personal')).toBe('build');
  });
});
