import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadError } from './LoadError';
import { ApiError } from '../api/client';

describe('LoadError', () => {
  it('says what failed in plain words and offers to try again', async () => {
    const onRetry = vi.fn();
    render(<LoadError what="today" error={new ApiError(0, 'NETWORK', 'x')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load today: the local API is not reachable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
