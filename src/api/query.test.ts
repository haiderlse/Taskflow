import { describe, it, expect } from 'vitest';
import { toQueryString } from './query';

describe('toQueryString', () => {
  it('is empty when nothing is set and skips undefined values', () => {
    expect(toQueryString({})).toBe('');
    expect(toQueryString({ status: undefined, context: undefined })).toBe('');
  });

  it('encodes values and joins arrays with commas', () => {
    expect(toQueryString({ status: ['inbox', 'later'], context: 'work' })).toBe('?status=inbox%2Clater&context=work');
    expect(toQueryString({ week: '2026-09-20' })).toBe('?week=2026-09-20');
    expect(toQueryString({ q: 'a b&c' })).toBe('?q=a%20b%26c');
  });
});
