import { Task, TaskRecurrence, TaskActivity, CustomField, User } from '../types';

/**
 * Calculates the next due date for a recurring task.
 */
export function calculateNextRecurrenceDate(
  currentDueDate: Date | null,
  recurrence: TaskRecurrence,
  completedDate: Date = new Date()
): Date {
  const baseDate = recurrence.repeatAfterCompletion
    ? new Date(completedDate)
    : currentDueDate
    ? new Date(currentDueDate)
    : new Date();

  const next = new Date(baseDate);
  const interval = recurrence.interval || 1;

  switch (recurrence.frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        // Find next day in daysOfWeek (0=Sun, 1=Mon, ..., 6=Sat)
        let found = false;
        for (let i = 1; i <= 7; i++) {
          const checkDate = new Date(baseDate);
          checkDate.setDate(checkDate.getDate() + i);
          const day = checkDate.getDay();
          if (recurrence.daysOfWeek.includes(day)) {
            next.setTime(checkDate.getTime());
            found = true;
            break;
          }
        }
        if (!found) {
          next.setDate(next.getDate() + interval * 7);
        }
      } else {
        next.setDate(next.getDate() + interval * 7);
      }
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }

  return next;
}

/**
 * Creates the next iteration of a recurring task
 */
export function generateNextRecurringTask(completedTask: Task, completedByUserId: string): Task | null {
  if (!completedTask.recurrence) return null;

  const nextDueDate = calculateNextRecurrenceDate(
    completedTask.dueDate ? new Date(completedTask.dueDate) : null,
    completedTask.recurrence,
    new Date()
  );

  const durationDays = completedTask.startDate && completedTask.dueDate
    ? Math.max(1, Math.round((new Date(completedTask.dueDate).getTime() - new Date(completedTask.startDate).getTime()) / 86400000))
    : 1;

  const nextStartDate = new Date(nextDueDate);
  nextStartDate.setDate(nextStartDate.getDate() - durationDays);

  const newId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const activity: TaskActivity = {
    id: `act-${Date.now()}`,
    taskId: newId,
    userId: completedByUserId,
    action: 'recurrence_spawned',
    details: `Auto-generated from completed recurring task "${completedTask.title}" (Next due: ${nextDueDate.toLocaleDateString()})`,
    timestamp: new Date()
  };

  return {
    ...completedTask,
    id: newId,
    title: completedTask.title,
    status: 'To Do',
    taskStatus: 'not_started',
    dueDate: nextDueDate,
    startDate: nextStartDate,
    completedDate: null,
    timeTracked: 0,
    subtaskItems: (completedTask.subtaskItems || []).map(st => ({
      ...st,
      id: `st-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      isCompleted: false
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    activities: [activity]
  };
}

/**
 * Calculates the Critical Path across a list of tasks.
 * Critical Path = set of tasks whose dependency sequence forms the longest path to completion.
 */
export function computeCriticalPath(tasks: Task[]): Set<string> {
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const criticalTaskIds = new Set<string>();

  // Helper to estimate duration in days
  const getDuration = (t: Task): number => {
    if (t.startDate && t.dueDate) {
      const diff = Math.ceil((new Date(t.dueDate).getTime() - new Date(t.startDate).getTime()) / 86400000);
      return Math.max(1, diff);
    }
    if (t.estimatedTime) {
      return Math.max(1, Math.ceil((t.estimatedTime / 60) / 8)); // 8 hours per day
    }
    return 1;
  };

  // Build adjacency list for dependents (task -> tasks it blocks)
  const dependentsMap = new Map<string, string[]>();
  tasks.forEach(t => {
    dependentsMap.set(t.id, []);
  });

  tasks.forEach(t => {
    const blockers = [...(t.blockedBy || []), ...(t.dependencies || [])];
    blockers.forEach(bId => {
      if (dependentsMap.has(bId)) {
        dependentsMap.get(bId)!.push(t.id);
      }
    });
  });

  // Calculate longest path from each task to an end task
  const memoPathLength = new Map<string, { duration: number; path: string[] }>();

  function findLongestPath(taskId: string, visited = new Set<string>()): { duration: number; path: string[] } {
    if (visited.has(taskId)) {
      return { duration: 0, path: [taskId] }; // prevent cycle
    }
    if (memoPathLength.has(taskId)) {
      return memoPathLength.get(taskId)!;
    }

    visited.add(taskId);
    const currentTask = taskMap.get(taskId);
    const selfDuration = currentTask ? getDuration(currentTask) : 1;
    const dependents = dependentsMap.get(taskId) || [];

    if (dependents.length === 0) {
      const result = { duration: selfDuration, path: [taskId] };
      memoPathLength.set(taskId, result);
      visited.delete(taskId);
      return result;
    }

    let maxChildDuration = 0;
    let bestChildPath: string[] = [];

    for (const childId of dependents) {
      const childRes = findLongestPath(childId, new Set(visited));
      if (childRes.duration > maxChildDuration) {
        maxChildDuration = childRes.duration;
        bestChildPath = childRes.path;
      }
    }

    const result = {
      duration: selfDuration + maxChildDuration,
      path: [taskId, ...bestChildPath]
    };
    memoPathLength.set(taskId, result);
    visited.delete(taskId);
    return result;
  }

  // Find root tasks (tasks with no blockers)
  let maxTotalDuration = 0;
  let criticalPathList: string[] = [];

  tasks.forEach(t => {
    const blockers = [...(t.blockedBy || []), ...(t.dependencies || [])];
    if (blockers.length === 0) {
      const pathRes = findLongestPath(t.id);
      if (pathRes.duration > maxTotalDuration) {
        maxTotalDuration = pathRes.duration;
        criticalPathList = pathRes.path;
      }
    }
  });

  // If no dependency chain found, pick tasks with critical priority and latest due dates
  if (criticalPathList.length <= 1) {
    tasks.filter(t => t.priority === 'critical' || t.isMilestone).forEach(t => criticalTaskIds.add(t.id));
  } else {
    criticalPathList.forEach(id => criticalTaskIds.add(id));
  }

  return criticalTaskIds;
}

/**
 * Generates an iCalendar (.ics) format string for the given project tasks.
 */
export function generateIcsCalendar(tasks: Task[], projectName: string): string {
  const formatDateToICS = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const escapeIcs = (str: string) => {
    return (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const events = tasks
    .filter(t => t.dueDate || t.startDate)
    .map(t => {
      const start = t.startDate ? new Date(t.startDate) : new Date(t.dueDate!);
      const end = t.dueDate ? new Date(t.dueDate) : new Date(start.getTime() + 3600000 * 2);
      const created = t.createdAt ? new Date(t.createdAt) : new Date();

      return [
        'BEGIN:VEVENT',
        `UID:${t.id}@flowenterprise.asana`,
        `DTSTAMP:${formatDateToICS(new Date())}`,
        `DTSTART:${formatDateToICS(start)}`,
        `DTEND:${formatDateToICS(end)}`,
        `SUMMARY:${escapeIcs(t.title)} [${t.priority.toUpperCase()}]`,
        `DESCRIPTION:${escapeIcs(t.description || 'No description provided.')}\\nStatus: ${t.status}\\nProject: ${projectName}`,
        `STATUS:${t.status === 'Done' ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT'
      ].join('\r\n');
    })
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FlowEnterprise//Asana Workspace Calendar//EN',
    `X-WR-CALNAME:${escapeIcs(projectName)} Schedule`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR'
  ].join('\r\n');
}

/**
 * Generates a direct Google Calendar template web link
 */
export function createGoogleCalendarUrl(task: Task, projectName: string = 'Workspace'): string {
  const title = encodeURIComponent(`${task.title} (${projectName})`);
  const details = encodeURIComponent(
    `${task.description || ''}\n\nPriority: ${task.priority}\nStatus: ${task.status}\nFlowEnterprise Workspace`
  );

  const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '');

  const start = task.startDate ? new Date(task.startDate) : (task.dueDate ? new Date(task.dueDate) : new Date());
  const end = task.dueDate ? new Date(task.dueDate) : new Date(start.getTime() + 3600000);

  const dates = `${formatGCalDate(start)}/${formatGCalDate(end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${dates}`;
}

export const generateIcsFeed = generateIcsCalendar;

/**
 * Downloads a generated ICS calendar file for a single task
 */
export function downloadIcsFile(task: Task, projectName: string = 'Task'): void {
  const icsData = generateIcsCalendar([task], projectName);
  const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${task.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Helper to compute rollups & statistics for custom fields
 */
export function calculateCustomFieldRollups(tasks: Task[], customField: CustomField): { sum?: number; avg?: number; count: number } {
  const values = tasks
    .map(t => t.customFields?.[customField.id])
    .filter(v => v !== undefined && v !== null && v !== '');

  if (customField.type === 'number' || customField.type === 'currency' || customField.type === 'percentage') {
    const numValues = values.map(v => Number(v)).filter(v => !isNaN(v));
    if (numValues.length === 0) return { count: 0 };
    const sum = numValues.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / numValues.length) * 10) / 10;
    return { sum: Math.round(sum * 100) / 100, avg, count: numValues.length };
  }

  return { count: values.length };
}

/**
 * Creates an activity log entry
 */
export function createActivityLog(
  taskId: string,
  userId: string,
  action: string,
  details: string
): TaskActivity {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    taskId,
    userId,
    action,
    details,
    timestamp: new Date()
  };
}
