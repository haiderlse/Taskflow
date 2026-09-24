import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast.show('Captured. It is in the Inbox, not on Today.')}>go</button>;
}

afterEach(() => vi.useRealTimers());

describe('ToastProvider', () => {
  it('shows a message as a status and removes it after four seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    expect(screen.queryByRole('status')).toBeNull();
    act(() => screen.getByText('go').click());
    expect(screen.getByRole('status')).toHaveTextContent('Captured. It is in the Inbox, not on Today.');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
