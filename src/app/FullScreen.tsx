import { Outlet } from 'react-router-dom';

/** Flows that must show nothing but themselves: focus, shutdown, planning, capture. */
export function FullScreen() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-10">
      <Outlet />
    </div>
  );
}
