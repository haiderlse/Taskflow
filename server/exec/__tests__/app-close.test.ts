import { describe, it, expect } from 'vitest';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';

describe('createApp().locals.closeDatabases', () => {
  it('closes both database connections', () => {
    const legacy = openDb(':memory:');
    initSchema(legacy);
    const exec = prepareExecDb(':memory:');
    const app = createApp(legacy, exec);
    expect(typeof app.locals.closeDatabases).toBe('function');
    app.locals.closeDatabases();
    expect(legacy.open).toBe(false);
    expect(exec.open).toBe(false);
  });
});
