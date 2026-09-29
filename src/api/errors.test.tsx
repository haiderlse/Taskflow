import { describe, it, expect } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from './client';
import { dayTakenMustShip, errorMessage, useReportError, weekFullOutcomes } from './errors';
import { ToastProvider } from '../components/Toast';
import { makeOutcome } from '../test/fixtures';

describe('errorMessage', () => {
  it('uses friendly text for the codes a person can act on and the server text otherwise', () => {
    expect(errorMessage(new ApiError(0, 'NETWORK', 'The local API is not reachable'))).toBe('the local API is not reachable');
    expect(errorMessage(new ApiError(409, 'WEEK_FULL', 'the week already has three outcomes'))).toBe('this week already has three outcomes');
    expect(errorMessage(new ApiError(400, 'VALIDATION', 'invalid request body'))).toBe('invalid request body');
  });
});

describe('useReportError', () => {
  it('returns an onError that toasts what failed and why', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
    const { result } = renderHook(() => useReportError(), { wrapper });
    act(() => result.current('save')(new ApiError(500, 'INTERNAL', 'internal server error')));
    expect(screen.getByRole('status')).toHaveTextContent('Could not save: internal server error');
  });
});

describe('weekFullOutcomes', () => {
  it('extracts the three outcomes from a WEEK_FULL refusal and nothing from anything else', () => {
    const outcomes = [makeOutcome(), makeOutcome({ slot: 2 }), makeOutcome({ slot: 3 })];
    expect(weekFullOutcomes(new ApiError(409, 'WEEK_FULL', 'full', { outcomes }))).toEqual(outcomes);
    expect(weekFullOutcomes(new ApiError(400, 'VALIDATION', 'bad'))).toBeNull();
    expect(weekFullOutcomes(new Error('boom'))).toBeNull();
  });
});

describe('DAY_TAKEN and SLOT_LIMIT', () => {
  it('speaks plainly and hands back the Must Ship holding the day', () => {
    const taken = new ApiError(409, 'DAY_TAKEN', 'that day already has a must ship', { mustShip: { title: 'First' } });
    expect(errorMessage(taken)).toBe('that day already has a Must Ship');
    expect(errorMessage(new ApiError(400, 'SLOT_LIMIT', 'x'))).toBe('a day holds at most two secondary tasks');
    expect(dayTakenMustShip(taken)).toEqual({ title: 'First' });
    expect(dayTakenMustShip(new ApiError(409, 'WEEK_FULL', 'x'))).toBeNull();
  });
});
