import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../utils/ThemeContext';
import { createQueryClient } from '../api/queryClient';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
