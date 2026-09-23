import '../../index.css';
import LegacyApp from 'legacy-app';

/** The old workspace, kept reachable at /legacy until the MVP has proven itself. */
export default function Legacy() {
  return <LegacyApp />;
}
