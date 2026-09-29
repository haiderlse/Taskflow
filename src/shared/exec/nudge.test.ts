import { describe, it, expect } from 'vitest';
import { isActivityTitle, needsNudge, NUDGE_MESSAGE } from './nudge';

describe('isActivityTitle', () => {
  it.each(['Work on supplier meetings', 'look into the Haleon gap', 'Continue', 'REVIEW pricing', 'follow up with Bilal', 'think about hiring', 'Research POS vendors', '  discuss   margins '])(
    'flags %j',
    (title) => {
      expect(isActivityTitle(title)).toBe(true);
    }
  );

  it.each(['Complete the September supplier delivery plan', 'Reviewed pricing sheet shared', 'Workshop agenda published', ''])(
    'accepts %j',
    (title) => {
      expect(isActivityTitle(title)).toBe(false);
    }
  );
});

describe('needsNudge', () => {
  it('nudges an activity title or a missing definition of done, never an empty title', () => {
    expect(needsNudge('Work on Pinkbox', 'P&L dashboard live')).toBe(true);
    expect(needsNudge('Pinkbox P&L dashboard live', '   ')).toBe(true);
    expect(needsNudge('Pinkbox P&L dashboard live', 'Dashboard shows live franchise data')).toBe(false);
    expect(needsNudge('', '')).toBe(false);
  });

  it('has the spec wording', () => {
    expect(NUDGE_MESSAGE).toBe('This sounds like an activity. What will exist when it is finished?');
  });
});
