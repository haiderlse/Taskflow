/** Every query key prefix in one place, so hooks can refresh each other without import cycles. */
export const tasksKey = ['exec', 'tasks'] as const;
export const settingsKey = ['exec', 'settings'] as const;
export const projectsKey = ['exec', 'projects'] as const;
export const weeksKey = ['exec', 'weeks'] as const;
export const mustShipsKey = ['exec', 'mustShips'] as const;
export const daysKey = ['exec', 'days'] as const;
export const deepWorkKey = ['exec', 'deepWork'] as const;
