/** The verbs that make a title an activity rather than an output (spec C "The activity nudge", §9). */
export const ACTIVITY_VERBS = ['work on', 'look into', 'continue', 'review', 'discuss', 'follow up', 'think about', 'research'] as const;

export const NUDGE_MESSAGE = 'This sounds like an activity. What will exist when it is finished?';

export function isActivityTitle(title: string): boolean {
  const normalised = title.trim().toLowerCase().replace(/\s+/g, ' ');
  return ACTIVITY_VERBS.some((verb) => normalised === verb || normalised.startsWith(`${verb} `));
}

/** Lightweight coaching: shown under the field, never a reason to refuse the save. */
export const needsNudge = (title: string, definitionOfDone: string): boolean =>
  title.trim() !== '' && (isActivityTitle(title) || definitionOfDone.trim() === '');
