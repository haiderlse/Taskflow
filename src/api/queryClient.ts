import { QueryClient } from '@tanstack/react-query';

/**
 * refetchOnWindowFocus is the point: a capture made on the phone shows up on the
 * desktop the moment its tab regains focus. Tests pass retry: false.
 */
export function createQueryClient(overrides: { retry?: number | boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: true, staleTime: 0, retry: overrides.retry ?? 1 },
    },
  });
}
