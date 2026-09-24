import { useCallback, useState } from 'react';
import { useCaptureKey } from '../lib/useCaptureKey';
import { CaptureDialog } from './CaptureDialog';

/** Rendered by both layouts: `c` focuses a pinned capture bar when one is on screen, else opens the dialog. */
export function CaptureShortcut() {
  const [open, setOpen] = useState(false);
  const trigger = useCallback(() => {
    const pinned = document.getElementById('capture-input');
    if (pinned instanceof HTMLInputElement) pinned.focus();
    else setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  useCaptureKey(trigger);
  return <CaptureDialog open={open} onClose={close} />;
}
