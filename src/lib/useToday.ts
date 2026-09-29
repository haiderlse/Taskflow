import { useSettings } from '../api/settings';
import { toCalendarDate } from '../shared/exec/dates';
import { localClock } from '../shared/exec/time';

/** Today's calendar date in the settings time zone (the UTC date until settings arrive) and the week's first weekday. */
export function useToday(): { today: string; weekStartDay: number } {
  const settings = useSettings();
  const zone = settings.data?.timezone;
  const now = new Date();
  return {
    today: zone ? localClock(now, zone).date : toCalendarDate(now),
    weekStartDay: settings.data?.weekStartDay ?? 0,
  };
}
