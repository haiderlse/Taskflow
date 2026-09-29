import { useSettings } from '../api/settings';
import { toCalendarDate } from '../shared/exec/dates';
import { localClock } from '../shared/exec/time';
import type { Settings } from '../shared/exec/schemas';
import { useNow } from './useNow';

type TodayContext = { today: string; weekStartDay: number; ready: boolean; now: Date; settings: Settings | undefined };

/**
 * Today's calendar date in the settings time zone, ticking each minute so it rolls over at local midnight.
 * Until settings arrive `ready` is false and the date is the UTC one; callers wait for `ready` before reading data by date.
 */
export function useToday(): TodayContext {
  const settings = useSettings();
  const now = useNow();
  const zone = settings.data?.timezone;
  return {
    today: zone ? localClock(now, zone).date : toCalendarDate(now),
    weekStartDay: settings.data?.weekStartDay ?? 0,
    ready: settings.data !== undefined,
    now,
    settings: settings.data,
  };
}
