import type { DeepWorkBlock, MustShipStatus } from '../shared/exec/todaySchemas';
import type { Outcome, OutcomeCategory, ProjectStatus, ReviewReason } from '../shared/exec/schemas';

export const CATEGORY_LABELS: Record<OutcomeCategory, string> = {
  office: 'Office',
  business: 'Business',
  career: 'Career',
  personal: 'Personal',
};

export const REASON_LABELS: Record<ReviewReason, string> = {
  insufficient_time: 'Not enough time',
  unexpected_urgent_work: 'Urgent work came up',
  dependency_blocker: 'Blocked by a dependency',
  poor_estimation: 'Underestimated',
  too_many_meetings: 'Too many meetings',
  priority_changed: 'Priority changed',
  procrastination: 'Put it off',
  unclear_outcome: 'Outcome was unclear',
  delegated_dependency: 'Waiting on someone',
  no_longer_important: 'No longer important',
  other: 'Other',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  done: 'Done',
  archived: 'Archived',
};

export const MUST_SHIP_STATUS_LABELS: Record<MustShipStatus, string> = {
  planned: 'Planned',
  shipped: 'Shipped',
  partial: 'Partial',
  missed: 'Missed',
  blocked: 'Blocked',
  killed: 'Killed',
};

export const WEEKDAY_NAMES: readonly string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const BLOCK_RESULT_LABELS: Record<NonNullable<DeepWorkBlock['result']>, string> = {
  completed: 'Completed',
  progress: 'Made progress',
  blocked: 'Blocked',
  abandoned: 'Abandoned',
};

export const GRADE_LABELS: Record<NonNullable<Outcome['reviewGrade']>, string> = {
  done: 'Done',
  partial: 'Partial',
  missed: 'Missed',
};

export const DISPOSITION_LABELS: Record<NonNullable<Outcome['reviewDisposition']>, string> = {
  roll_forward: 'Roll into next week',
  reschedule: 'Reschedule',
  delegate: 'Delegate',
  kill: 'Kill',
};
