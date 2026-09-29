import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useFocusKey } from './useFocusKey';

describe('useFocusKey', () => {
  it('answers f and F, and nothing else', () => {
    const onTrigger = vi.fn();
    renderHook(() => useFocusKey(onTrigger));
    fireEvent.keyDown(document.body, { key: 'f' });
    fireEvent.keyDown(document.body, { key: 'F' });
    fireEvent.keyDown(document.body, { key: 'g' });
    expect(onTrigger).toHaveBeenCalledTimes(2);
  });

  it('ignores a held key repeating', () => {
    const onTrigger = vi.fn();
    renderHook(() => useFocusKey(onTrigger));
    fireEvent.keyDown(document.body, { key: 'f', repeat: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });
});
