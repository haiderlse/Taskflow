import { useEffect } from 'react';
import { CaptureBar } from './CaptureBar';

type Props = { open: boolean; onClose: () => void };

/** The `c` key away from Today: one input in the middle of the screen, nothing else. */
export function CaptureDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-ink/40 p-4 pt-24" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Capture"
        className="w-full max-w-lg rounded-lg bg-paper p-4 shadow-lg dark:bg-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <CaptureBar inputId="capture-dialog-input" autoFocus onCaptured={onClose} />
      </div>
    </div>
  );
}
