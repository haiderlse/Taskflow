import { useEffect, useRef, useState } from 'react';
import { isEditableTarget } from '../../lib/keys';

export type InboxAction = 'this_week' | 'later' | 'delegate' | 'schedule' | 'project' | 'delete';

export const KEY_ACTIONS: Record<string, InboxAction> = {
  t: 'this_week',
  l: 'later',
  d: 'delegate',
  s: 'schedule',
  p: 'project',
  x: 'delete',
};

const clamp = (index: number, count: number) => Math.min(Math.max(index, 0), Math.max(count - 1, 0));

/** Selection plus the six processing keys (spec C "Inbox"). Disabled while a panel has the keyboard. */
export function useInboxKeys(count: number, onAction: (action: InboxAction, index: number) => void, enabled: boolean) {
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    setSelected((current) => clamp(current, count));
  }, [count]);

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        setSelected((current) => clamp(current + 1, count));
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        setSelected((current) => clamp(current - 1, count));
        return;
      }
      const action = KEY_ACTIONS[event.key];
      if (action && count > 0) {
        event.preventDefault();
        onAction(action, selectedRef.current);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [count, enabled, onAction]);

  return { selected, setSelected };
}
