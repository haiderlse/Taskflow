// The old workspace is loaded only at /legacy and is not type-checked under the
// strict config. Vite and Vitest resolve 'legacy-app' to ./App.tsx (see their configs).
declare module 'legacy-app' {
  import type { ComponentType } from 'react';
  const LegacyApp: ComponentType;
  export default LegacyApp;
}
