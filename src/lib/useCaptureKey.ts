import { useEffect } from 'react';
import { isEditableTarget } from './keys';

/** A bare `c` anywhere, except while typing, triggers capture (spec C "Keyboard"). */
export function useCaptureKey(onTrigger: () => void): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'c' || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
      event.preventDefault();
      onTrigger();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onTrigger]);
}
