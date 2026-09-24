import { NavLink, Outlet } from 'react-router-dom';
import { ApiStatus } from '../components/ApiStatus';
import { CaptureShortcut } from '../components/CaptureShortcut';

const NAV = [
  { to: '/', label: 'Today', end: true },
  { to: '/week', label: 'Week', end: false },
  { to: '/inbox', label: 'Inbox', end: false },
  { to: '/projects', label: 'Projects', end: false },
  { to: '/review', label: 'Review', end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-ink text-paper dark:bg-paper dark:text-ink' : 'text-ink-muted hover:text-ink dark:hover:text-paper'}`;

/** The five-entry navigation: a left rail on desktop, a bottom bar on phones. */
export function Shell() {
  return (
    <div className="min-h-screen md:flex">
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-line bg-paper-raised p-2 md:static md:w-44 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-4 dark:border-ink-muted dark:bg-ink"
      >
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 space-y-4 px-4 pb-24 pt-6 md:px-10 md:pb-10">
        <ApiStatus />
        <CaptureShortcut />
        <Outlet />
      </main>
    </div>
  );
}
