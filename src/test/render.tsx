import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '../../utils/ThemeContext';
import { createQueryClient } from '../api/queryClient';
import { routes } from '../app/routes';

/** Renders inside the app's providers with retries off, so failures surface at once. */
export function renderWithProviders(ui: ReactElement) {
  const client = createQueryClient({ retry: false });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

/** Renders the real route table at a path, without a browser history. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

export const healthOk = () =>
  new Response(JSON.stringify({ success: true, data: { status: 'ok', schemaVersion: 1 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
