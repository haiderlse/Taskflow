import { useState } from 'react';
import { readStorage, writeStorage } from '../../lib/safeStorage';

export const NOTICE_ASKED_KEY = 'taskflow.noticeAsked';

/** Permission is asked once, from Today (spec C "Deep Work"): a choice either way is remembered and the prompt never returns. */
export function NoticePrompt() {
  const [asked, setAsked] = useState(() => readStorage(NOTICE_ASKED_KEY) === 'yes');
  if (asked || typeof Notification === 'undefined' || Notification.permission !== 'default') return null;
  const answer = (allow: boolean) => {
    writeStorage(NOTICE_ASKED_KEY, 'yes');
    setAsked(true);
    if (allow) void Notification.requestPermission();
  };
  return (
    <section aria-label="Deep work notice" className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
      <p className="flex-1">Get a notice 5 minutes before deep work?</p>
      <button type="button" onClick={() => answer(true)} className="rounded border border-line px-2 py-1 dark:border-ink-muted">Turn on</button>
      <button type="button" onClick={() => answer(false)} className="rounded border border-line px-2 py-1 dark:border-ink-muted">Not now</button>
    </section>
  );
}
