import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoticePrompt } from './NoticePrompt';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function notification(permission: string) {
  const request = vi.fn().mockResolvedValue('granted');
  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission, requestPermission: request }));
  return request;
}

describe('NoticePrompt', () => {
  it('asks once: Turn on requests permission and never shows again', async () => {
    const request = notification('default');
    const { unmount } = render(<NoticePrompt />);
    expect(screen.getByRole('region', { name: 'Deep work notice' })).toHaveTextContent('Get a notice 5 minutes before deep work?');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
    unmount();
    render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
  });

  it('Not now asks the browser nothing and is remembered', async () => {
    const request = notification('default');
    const { unmount } = render(<NoticePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(request).not.toHaveBeenCalled();
    unmount();
    render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
  });

  it('shows nothing once permission is decided, or where notifications do not exist', () => {
    notification('granted');
    const { unmount } = render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
    unmount();
    vi.stubGlobal('Notification', undefined);
    render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
  });
});
