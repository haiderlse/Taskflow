import { Outlet } from 'react-router-dom';
import { ApiStatus } from '../components/ApiStatus';
import { CaptureShortcut } from '../components/CaptureShortcut';

/** Flows that must show nothing but themselves: focus, shutdown, planning, capture. */
export function FullScreen() {
  return (
    <div className="min-h-screen space-y-4 px-4 py-6 md:px-10">
      <ApiStatus />
      <CaptureShortcut />
      <Outlet />
    </div>
  );
}
