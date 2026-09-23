import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError, EXEC_API_BASE } from './client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('prefixes the exec base path and unwraps a successful envelope', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { status: 'ok', schemaVersion: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/health')).resolves.toEqual({ status: 'ok', schemaVersion: 1 });
    expect(fetchMock).toHaveBeenCalledWith(`${EXEC_API_BASE}/health`, expect.objectContaining({ method: 'GET' }));
  });

  it('sends JSON bodies with the JSON content type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { id: 't1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/tasks', { title: 'Call the supplier', context: 'work' })).resolves.toEqual({ id: 't1' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'Call the supplier', context: 'work' }));
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('turns a failure envelope into an ApiError carrying status, code and details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ success: false, error: 'the week already has three outcomes', code: 'WEEK_FULL', details: { outcomes: [] } }, 409)
      )
    );

    const error = await api.post('/weeks/w1/outcomes', { title: 'A fourth' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'WEEK_FULL', message: 'the week already has three outcomes', details: { outcomes: [] } });
  });

  it('reports an unreachable API as a NETWORK error, carrying the cause not the details', async () => {
    const thrown = new TypeError('fetch failed');
    vi.stubGlobal('fetch', vi.fn(async () => { throw thrown; }));

    const error = await api.get('/health').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK', details: undefined, cause: thrown });
  });

  it('reports a response that is not the envelope as INTERNAL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>proxy error</html>', { status: 502 })));

    const error = await api.get('/health').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL' });
  });
});
