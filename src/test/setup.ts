import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only auto-registers cleanup when vitest exposes afterEach globally; this repo keeps globals off.
afterEach(() => {
  cleanup();
});
