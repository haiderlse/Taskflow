import { describe, it, expect } from 'vitest';
import { API_HOST, apiPort, bindHost, allowedHosts, isLoopback, execDbPath } from '../config';

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

describe('bindHost', () => {
  it('defaults to loopback', () => {
    expect(bindHost({})).toBe('127.0.0.1');
  });

  it('treats an empty value as unset', () => {
    expect(bindHost({ TASKFLOW_BIND: '' })).toBe('127.0.0.1');
  });

  it('passes a tailnet address or hostname through', () => {
    expect(bindHost({ TASKFLOW_BIND: '100.64.0.7' })).toBe('100.64.0.7');
    expect(bindHost({ TASKFLOW_BIND: 'office-pc.tailnet.ts.net' })).toBe('office-pc.tailnet.ts.net');
  });

  it.each([' 100.64.0.7', 'a b', 'http://host', 'host/path'])('rejects %j', (value) => {
    expect(() => bindHost({ TASKFLOW_BIND: value })).toThrow(/TASKFLOW_BIND/);
  });
});

describe('isLoopback', () => {
  it.each(['127.0.0.1', 'localhost', '::1'])('%s is loopback', (host) => {
    expect(isLoopback(host)).toBe(true);
  });

  it('a tailnet address is not', () => {
    expect(isLoopback('100.64.0.7')).toBe(false);
  });
});

describe('allowedHosts', () => {
  it('is undefined by default so Vite keeps its own Host check', () => {
    expect(allowedHosts({})).toBeUndefined();
  });

  it('lists the configured host', () => {
    expect(allowedHosts({ TASKFLOW_ALLOWED_HOST: 'office-pc.tailnet.ts.net' })).toEqual(['office-pc.tailnet.ts.net']);
  });
});

describe('execDbPath', () => {
  it('defaults to data/execution.db', () => {
    expect(execDbPath({})).toBe('data/execution.db');
  });

  it('reads EXEC_DB_PATH', () => {
    expect(execDbPath({ EXEC_DB_PATH: '/tmp/e2e/execution.db' })).toBe('/tmp/e2e/execution.db');
  });

  it('treats an empty value as unset', () => {
    expect(execDbPath({ EXEC_DB_PATH: '' })).toBe('data/execution.db');
  });
});
