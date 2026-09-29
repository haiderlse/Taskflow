import { useEffect } from 'react';
import { isEditableTarget } from './keys';

/** A bare `f` or `F` (not a held repeat) anywhere, except while typing, opens focus (spec C "Keyboard"). */
export function useFocusKey(onTrigger: () => void): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.repeat || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
      event.preventDefault();
      onTrigger();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onTrigger]);
}
