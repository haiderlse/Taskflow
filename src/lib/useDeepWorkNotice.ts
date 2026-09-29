import { useEffect } from 'react';
import { noticeDue } from '../shared/exec/notice';
import { readStorage, writeStorage } from './safeStorage';
import { useToday } from './useToday';

export const NOTICE_FIRED_KEY = 'taskflow.noticeFired';

/** While a tab is open, a browser notification five minutes before deep work, once a day, if permission was given (no service worker). */
export function useDeepWorkNotice(): void {
  const { now, settings } = useToday();
  useEffect(() => {
    if (!settings || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const date = noticeDue(now, settings);
    if (date === null || readStorage(NOTICE_FIRED_KEY) === date) return;
    writeStorage(NOTICE_FIRED_KEY, date);
    new Notification('Deep work begins in 5 minutes');
  }, [now, settings]);
}
