import { Outlet } from 'react-router-dom';
import { ApiStatus } from '../components/ApiStatus';
import { CaptureShortcut } from '../components/CaptureShortcut';

/** Flows that must show nothing but themselves: focus, shutdown, planning, capture. */
export function FullScreen() {
  return (
    <div className="min-h-screen space-y-4 px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:px-10 md:py-6">
      <ApiStatus />
      <CaptureShortcut />
      <Outlet />
    </div>
  );
}
