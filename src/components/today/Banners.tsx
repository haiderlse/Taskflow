import { Link } from 'react-router-dom';
import type { Banner } from '../../shared/exec/today';

type Props = { banners: Banner[]; firstWeek: boolean };

const BANNER = 'block rounded-lg border border-line bg-paper-raised px-4 py-3 text-lg font-medium hover:border-ink dark:border-ink-muted dark:bg-ink';

/** Spec C "Today is time-aware": banners sit above the primary card whenever their condition holds. */
export function Banners({ banners, firstWeek }: Props) {
  return (
    <>
      {banners.includes('plan') && (
        <Link to="/plan" className={BANNER}>
          {firstWeek ? 'Plan your first week' : 'Plan this week'}
        </Link>
      )}
      {banners.includes('close') && (
        <Link to="/shutdown" className={BANNER}>
          Close the day
        </Link>
      )}
    </>
  );
}
