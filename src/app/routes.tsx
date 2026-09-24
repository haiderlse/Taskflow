import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Shell } from './Shell';
import { FullScreen } from './FullScreen';
import Today from '../screens/Today';
import Week from '../screens/Week';
import Inbox from '../screens/Inbox';
import Projects from '../screens/Projects';
import Review from '../screens/Review';
import Focus from '../screens/Focus';
import Shutdown from '../screens/Shutdown';
import Plan from '../screens/Plan';
import Capture from '../screens/Capture';
import NotFound from '../screens/NotFound';

// Loaded only when someone types /legacy, so its bundle never rides along with the new app.
const Legacy = lazy(() => import('./Legacy'));

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Today /> },
      { path: 'week', element: <Week /> },
      { path: 'inbox', element: <Inbox /> },
      { path: 'projects', element: <Projects /> },
      { path: 'review', element: <Review /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    element: <FullScreen />,
    children: [
      { path: '/focus', element: <Focus /> },
      { path: '/shutdown', element: <Shutdown /> },
      { path: '/plan', element: <Plan /> },
      { path: '/capture', element: <Capture /> },
    ],
  },
  {
    path: '/legacy/*',
    element: (
      <Suspense fallback={<p className="p-6 text-ink-muted">Loading the old workspace…</p>}>
        <Legacy />
      </Suspense>
    ),
  },
];
