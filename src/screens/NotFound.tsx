import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';

export default function NotFound() {
  return (
    <ScreenShell title="Nothing here">
      <Link to="/" className="underline">
        Back to Today
      </Link>
    </ScreenShell>
  );
}
