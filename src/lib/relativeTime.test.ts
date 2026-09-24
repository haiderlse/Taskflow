import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const now = new Date('2026-09-22T10:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-09-22T09:59:30Z', 'just now'],
    ['2026-09-22T09:55:00Z', '5 min ago'],
    ['2026-09-22T08:00:00Z', '2 h ago'],
    ['2026-09-19T10:00:00Z', '3 d ago'],
    ['2026-09-22T10:00:05Z', 'just now'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
