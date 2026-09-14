import { describe, it, expect } from 'vitest';
import { API_HOST, apiPort } from '../config';

describe('apiPort', () => {
  it('defaults to 4100', () => {
    expect(apiPort({})).toBe(4100);
  });

  it('reads TASKFLOW_API_PORT', () => {
    expect(apiPort({ TASKFLOW_API_PORT: '4555' })).toBe(4555);
  });

  it('treats an empty value as unset', () => {
    expect(apiPort({ TASKFLOW_API_PORT: '' })).toBe(4100);
  });

  it.each(['abc', '0', '65536', '4100.5', '-1', '4100x', ' 4100'])(
    'rejects %j instead of letting the server and the proxy pick different ports',
    (value) => {
      expect(() => apiPort({ TASKFLOW_API_PORT: value })).toThrow(/TASKFLOW_API_PORT/);
    }
  );
});

describe('API_HOST', () => {
  it('is loopback only, because the API has no authentication', () => {
    expect(API_HOST).toBe('127.0.0.1');
  });
});
