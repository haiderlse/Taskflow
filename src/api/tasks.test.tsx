import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useTasks, useCaptureTask, useUpdateTask, useDeleteTask, useRollTask, taskListPath } from './tasks';
import { useSettings } from './settings';
import { useProjects } from './projects';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';
import { vi } from 'vitest';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('taskListPath', () => {
  it('builds the list path from filters', () => {
    expect(taskListPath({})).toBe('/tasks');
    expect(taskListPath({ status: ['inbox'], context: 'build' })).toBe('/tasks?status=inbox&context=build');
  });
});

describe('useTasks', () => {
  it('fetches the filtered list', async () => {
    const task = makeTask({ title: 'Call the supplier' });
    const calls = stubFetch(() => json([task]));
    const { result } = renderHook(() => useTasks({ status: ['inbox'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([task]);
    expect(calls[0]).toMatchObject({ url: '/api/exec/tasks?status=inbox', method: 'GET' });
  });
});

describe('mutations', () => {
  it('captures with a POST and refetches every tasks query', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? json(makeTask(), 201) : json([])));
    const { result } = renderHook(() => ({ list: useTasks({ status: ['inbox'] }), capture: useCaptureTask() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => {
      await result.current.capture.mutateAsync({ title: 'Call the supplier', context: 'work' });
    });
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2));
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/tasks', body: { title: 'Call the supplier', context: 'work' } });
  });

  it('updates with PATCH, rolls with POST and deletes with DELETE', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'DELETE' ? json({ id: 't1' }) : json(makeTask())));
    const { result } = renderHook(() => ({ update: useUpdateTask(), roll: useRollTask(), remove: useDeleteTask() }), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({ id: 't1', patch: { status: 'later' } });
      await result.current.roll.mutateAsync({ id: 't1', date: '2026-09-23' });
      await result.current.remove.mutateAsync('t1');
    });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['PATCH', '/api/exec/tasks/t1'],
      ['POST', '/api/exec/tasks/t1/roll'],
      ['DELETE', '/api/exec/tasks/t1'],
    ]);
    expect(calls[0].body).toEqual({ status: 'later' });
    expect(calls[1].body).toEqual({ date: '2026-09-23' });
  });
});

describe('useSettings and useProjects', () => {
  it('fetch their resources', async () => {
    const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([])));
    const { result } = renderHook(() => ({ settings: useSettings(), projects: useProjects() }), { wrapper });
    await waitFor(() => expect(result.current.settings.isSuccess && result.current.projects.isSuccess).toBe(true));
    expect(result.current.settings.data).toEqual(SETTINGS);
    expect(result.current.projects.data).toEqual([]);
    expect(calls.map((c) => c.url).sort()).toEqual(['/api/exec/projects', '/api/exec/settings']);
  });
});
