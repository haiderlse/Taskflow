import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';
import { CAPTURED_MESSAGE } from './CaptureBar';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast.show(CAPTURED_MESSAGE)}>go</button>;
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
    expect(screen.getByRole('status')).toHaveTextContent(CAPTURED_MESSAGE);
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
