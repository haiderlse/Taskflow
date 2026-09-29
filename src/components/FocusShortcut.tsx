import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDay } from '../api/days';
import { useFocusKey } from '../lib/useFocusKey';
import { useToday } from '../lib/useToday';

/** `f` opens focus when today has a work or build Must Ship to focus on; otherwise it does nothing. */
export function FocusShortcut() {
  const navigate = useNavigate();
  const { today, ready } = useToday();
  const day = useDay(today, { enabled: ready });
  const available = Boolean(day.data?.mustShip ?? day.data?.buildMustShip);
  const trigger = useCallback(() => {
    if (available) navigate('/focus');
  }, [available, navigate]);
  useFocusKey(trigger);
  return null;
}
