import { Task, TaskFilterOptions, ColumnId, Priority } from '../types';

export const DEFAULT_FILTER_OPTIONS: TaskFilterOptions = {
  searchQuery: '',
  assigneeIds: [],
  statuses: [],
  priorities: [],
  dueDatePreset: 'all',
  taskType: 'all',
  tags: [],
  sortBy: 'order',
  sortDirection: 'asc',
  groupBy: 'none'
};

export const filterAndSortTasks = (
  tasks: Task[],
  filters: TaskFilterOptions,
  currentUserId?: string
): Task[] => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  return tasks
    .filter((task) => {
      // 1. Search Query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = task.title?.toLowerCase().includes(query);
        const matchesDesc = task.description?.toLowerCase().includes(query);
        const matchesTags = task.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesTitle && !matchesDesc && !matchesTags) {
          return false;
        }
      }

      // 2. Assignee Filter
      if (filters.assigneeIds && filters.assigneeIds.length > 0) {
        const hasMe = filters.assigneeIds.includes('me') && currentUserId && task.assigneeId === currentUserId;
        const hasUnassigned = filters.assigneeIds.includes('unassigned') && (!task.assigneeId || task.assigneeId === null);
        const matchesSpecificUser = task.assigneeId && filters.assigneeIds.includes(task.assigneeId);

        if (!hasMe && !hasUnassigned && !matchesSpecificUser) {
          return false;
        }
      }

      // 3. Status Filter
      if (filters.statuses && filters.statuses.length > 0) {
        if (!filters.statuses.includes(task.status)) {
          return false;
        }
      }

      // 4. Priority Filter
      if (filters.priorities && filters.priorities.length > 0) {
        if (!task.priority || !filters.priorities.includes(task.priority)) {
          return false;
        }
      }

      // 5. Due Date Presets
      if (filters.dueDatePreset && filters.dueDatePreset !== 'all') {
        const taskDue = task.dueDate ? new Date(task.dueDate) : null;

        if (filters.dueDatePreset === 'no_due_date') {
          if (taskDue !== null) return false;
        } else if (!taskDue) {
          // If a specific date preset is selected and task has no due date, filter it out
          return false;
        } else {
          switch (filters.dueDatePreset) {
            case 'overdue':
              if (taskDue >= now || task.status === 'Done') return false;
              break;
            case 'today':
              if (taskDue < todayStart || taskDue > todayEnd) return false;
              break;
            case 'due_24h':
              if (taskDue < now || taskDue > next24h) return false;
              break;
            case 'next_7_days':
              if (taskDue < todayStart || taskDue > next7Days) return false;
              break;
            case 'this_month':
              if (taskDue < todayStart || taskDue > monthEnd) return false;
              break;
            case 'custom':
              if (filters.customDateStart && taskDue < new Date(filters.customDateStart)) return false;
              if (filters.customDateEnd) {
                const end = new Date(filters.customDateEnd);
                end.setHours(23, 59, 59, 999);
                if (taskDue > end) return false;
              }
              break;
            default:
              break;
          }
        }
      }

      // 6. Task Type (Milestones, Approvals, Blocked, etc.)
      if (filters.taskType && filters.taskType !== 'all') {
        switch (filters.taskType) {
          case 'milestones_only':
            if (!task.isMilestone) return false;
            break;
          case 'tasks_only':
            if (task.isMilestone || task.approval) return false;
            break;
          case 'approvals_only':
            if (!task.approval) return false;
            break;
          case 'blocked_only': {
            const blockers = task.blockedBy || task.dependencies || [];
            if (blockers.length === 0) return false;
            break;
          }
          case 'blocking_only': {
            const blocking = task.blocking || [];
            if (blocking.length === 0) return false;
            break;
          }
          default:
            break;
        }
      }

      // 7. Tags Filter
      if (filters.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some((tag) => task.tags?.includes(tag));
        if (!hasTag) return false;
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'dueDate': {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
        }
        case 'priority': {
          const priorityWeights: Record<Priority, number> = {
            critical: 4,
            high: 3,
            medium: 2,
            low: 1
          };
          const weightA = a.priority ? priorityWeights[a.priority] || 0 : 0;
          const weightB = b.priority ? priorityWeights[b.priority] || 0 : 0;
          comparison = weightB - weightA; // High priority first by default
          break;
        }
        case 'title': {
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        }
        case 'assignee': {
          comparison = (a.assigneeId || '').localeCompare(b.assigneeId || '');
          break;
        }
        case 'timeTracked': {
          comparison = (b.timeTracked || 0) - (a.timeTracked || 0);
          break;
        }
        case 'createdAt': {
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = createdB - createdA;
          break;
        }
        case 'order':
        default:
          comparison = (a.order || 0) - (b.order || 0);
          break;
      }

      return filters.sortDirection === 'desc' ? -comparison : comparison;
    });
};

export const countActiveFilters = (filters: TaskFilterOptions): number => {
  let count = 0;
  if (filters.searchQuery.trim()) count++;
  if (filters.assigneeIds && filters.assigneeIds.length > 0) count += filters.assigneeIds.length;
  if (filters.statuses && filters.statuses.length > 0) count += filters.statuses.length;
  if (filters.priorities && filters.priorities.length > 0) count += filters.priorities.length;
  if (filters.dueDatePreset && filters.dueDatePreset !== 'all') count++;
  if (filters.taskType && filters.taskType !== 'all') count++;
  if (filters.tags && filters.tags.length > 0) count += filters.tags.length;
  return count;
};
