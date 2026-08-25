import React, { useState, useEffect, useMemo } from 'react';
import { Task, Project, User, Priority, ColumnId } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import TaskModal from './TaskModal';
import { 
  PlusIcon, 
  FilterIcon, 
  SortIcon, 
  GroupIcon, 
  CustomizeIcon, 
  ShareIcon, 
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  DotsHorizontalIcon,
  XIcon,
  CheckIcon,
  TrashIcon,
  CopyIcon,
  AlertTriangleIcon,
  PaperclipIcon,
  DownloadIcon,
  EyeIcon,
  RefreshCwIcon,
  TagIcon,
  FolderIcon,
  BellIcon,
  FlameIcon
} from './icons';

interface MyTasksPageProps {
  currentUser: User;
  users: User[];
  projects: Project[];
  onNavigateToProject?: (projectId: string) => void;
}

interface TaskGroup {
  id: string;
  title: string;
  count: number;
  tasks: Task[];
  color?: string;
}

interface UrgencyInfo {
  isUrgent: boolean;
  type: 'overdue' | 'due_24h' | 'due_soon';
  label: string;
  hoursLeft: number;
}

const MyTasksPage: React.FC<MyTasksPageProps> = ({ currentUser, users, projects, onNavigateToProject }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar' | 'dashboard' | 'files'>('list');
  const [scope, setScope] = useState<'assigned' | 'created' | 'all'>('assigned');
  
  // Group, Sort & Filter
  const [groupBy, setGroupBy] = useState<'project' | 'status' | 'priority' | 'dueDate' | 'none'>('project');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created' | 'name'>('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterDueDate, setFilterDueDate] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // UI state
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showCustomizeMenu, setShowCustomizeMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    dueDate: true,
    collaborators: true,
    projects: true,
    priority: true,
    dependencies: true,
    time: true,
  });

  // Drag and Drop state for Board view
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragOverColumn = (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeaveColumn = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnColumn = async (e: React.DragEvent, columnId: ColumnId) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === columnId) return;

    await handleUpdateTask(taskId, { status: columnId });
    showToast(`Task moved to ${columnId}`);
  };

  // Inline task creation state
  const [inlineTaskGroup, setInlineTaskGroup] = useState<string | null>(null);
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [activeActionMenuTaskId, setActiveActionMenuTaskId] = useState<string | null>(null);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Files state simulation
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    id: string;
    name: string;
    size: string;
    type: string;
    taskTitle: string;
    projectName: string;
    uploadedAt: string;
  }>>([
    { id: 'f-1', name: 'Q2_Financial_Report.pdf', size: '2.4 MB', type: 'pdf', taskTitle: 'Follow up on Pharma Receivables Plan', projectName: 'Pharma Strategy', uploadedAt: '2 days ago' },
    { id: 'f-2', name: 'Architecture_Blueprint_v3.png', size: '4.1 MB', type: 'image', taskTitle: 'Deploy staging server', projectName: 'Engineering Core', uploadedAt: '3 days ago' },
    { id: 'f-3', name: 'Client_Meeting_Notes.docx', size: '850 KB', type: 'doc', taskTitle: 'Follow up on FW: MOM Route 2 Health', projectName: 'Pharma Strategy', uploadedAt: 'Yesterday' },
  ]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const allFetchedTasks = await enhancedApi.getTasks();
      setTasks(allFetchedTasks);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [currentUser.uid]);

  const getUserById = (userId: string | null): User | undefined => {
    if (!userId) return undefined;
    return users.find(user => user.uid === userId);
  };

  const getProjectById = (projectId: string): Project | undefined => {
    return projects.find(project => project.id === projectId);
  };

  const showToast = (msg: string) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(null), 3000);
  };

  // Scope filter (Assigned to user, Created by user, or Workspace)
  const scopedTasks = useMemo(() => {
    return tasks.filter(t => {
      if (scope === 'assigned') {
        return t.assigneeId === currentUser.uid || (!t.assigneeId && t.createdBy === currentUser.uid);
      }
      if (scope === 'created') {
        return t.createdBy === currentUser.uid;
      }
      return true;
    });
  }, [tasks, scope, currentUser.uid]);

  // Urgency calculator: detects upcoming due dates within 24 hours & overdue tasks
  const getTaskUrgency = (task: Task): UrgencyInfo | null => {
    if (task.status === 'Done' || !task.dueDate) return null;
    
    const now = Date.now();
    const taskDueTime = new Date(task.dueDate).getTime();
    const diffMs = taskDueTime - now;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    if (diffMs < 0) {
      return {
        isUrgent: true,
        type: 'overdue',
        label: 'Overdue',
        hoursLeft: diffHours
      };
    }

    // Within 24 hours
    if (diffMs <= 24 * 60 * 60 * 1000) {
      let label = 'Due in <1h';
      if (diffHours >= 1) {
        label = `Due in ${diffHours}h`;
      }
      return {
        isUrgent: true,
        type: 'due_24h',
        label,
        hoursLeft: diffHours
      };
    }

    return null;
  };

  // Tasks due within 24h count
  const tasksDueWithin24h = useMemo(() => {
    return scopedTasks.filter(t => {
      const urgency = getTaskUrgency(t);
      return urgency && urgency.type === 'due_24h';
    });
  }, [scopedTasks]);

  // Overdue tasks count
  const overdueTasksList = useMemo(() => {
    return scopedTasks.filter(t => {
      const urgency = getTaskUrgency(t);
      return urgency && urgency.type === 'overdue';
    });
  }, [scopedTasks]);

  // Priority helpers
  const priorityOrder: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  
  const getPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'critical':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">Critical</span>;
      case 'high':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">High</span>;
      case 'medium':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Medium</span>;
      case 'low':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">Low</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">Normal</span>;
    }
  };

  const cyclePriority = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = priorities.indexOf(task.priority || 'medium');
    const nextPriority = priorities[(currentIndex + 1) % priorities.length];
    await handleUpdateTask(task.id, { priority: nextPriority });
  };

  const formatDueDate = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays < 7) return `in ${diffDays} days`;
    
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDueDateStyle = (date: Date | null, isDone: boolean) => {
    if (isDone) return 'text-gray-400 bg-gray-50';
    if (!date) return 'text-gray-400';
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-red-700 bg-red-50 border border-red-200 font-semibold';
    if (diffDays === 0) return 'text-amber-800 bg-amber-100 border border-amber-300 font-bold';
    if (diffDays <= 2) return 'text-amber-700 bg-amber-50 border border-amber-200';
    return 'text-gray-700 bg-gray-100';
  };

  // Toggle completion
  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const isDone = task.status === 'Done';
    const newStatus: ColumnId = isDone ? 'In Progress' : 'Done';
    const updates: Partial<Task> = {
      status: newStatus,
      completedDate: isDone ? null : new Date(),
    };

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t));
    try {
      await enhancedApi.updateTask(task.id, updates);
    } catch (err) {
      console.error('Failed to toggle completion:', err);
      loadTasks();
    }
  };

  // Update Task handler
  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
    try {
      const updated = await enhancedApi.updateTask(taskId, updates);
      if (updated) {
        setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
        if (selectedTask && selectedTask.id === taskId) {
          setSelectedTask(updated);
        }
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      loadTasks();
    }
  };

  // Delete task
  const handleDeleteTask = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task?')) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (selectedTask?.id === taskId) setSelectedTask(null);
    try {
      await enhancedApi.deleteTask(taskId);
      showToast('Task deleted');
    } catch (err) {
      console.error('Failed to delete task:', err);
      loadTasks();
    }
  };

  // Duplicate task
  const handleDuplicateTask = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const duplicated = await enhancedApi.createTask(
        `${task.title} (Copy)`,
        task.projectId,
        task.status
      );
      if (duplicated) {
        await enhancedApi.updateTask(duplicated.id, {
          assigneeId: task.assigneeId,
          priority: task.priority,
          description: task.description,
          dueDate: task.dueDate
        });
        showToast('Task duplicated');
        await loadTasks();
      }
    } catch (err) {
      console.error('Failed to duplicate task:', err);
    }
  };

  // Create inline task
  const handleCreateInlineTask = async (groupContextKey: string, fallbackProjectId?: string) => {
    if (!inlineTaskTitle.trim()) {
      setInlineTaskGroup(null);
      return;
    }

    const defaultProjectId = fallbackProjectId || projects[0]?.id || 'proj-1';
    let status: ColumnId = 'To Do';
    let priority: Priority = 'medium';
    let dueDate: Date | null = null;

    if (groupBy === 'status') {
      if (groupContextKey === 'In Progress') status = 'In Progress';
      else if (groupContextKey === 'Done') status = 'Done';
      else status = 'To Do';
    } else if (groupBy === 'priority') {
      const p = groupContextKey.toLowerCase() as Priority;
      if (['critical', 'high', 'medium', 'low'].includes(p)) priority = p;
    } else if (groupBy === 'dueDate') {
      if (groupContextKey === 'Due in 24 Hours' || groupContextKey === 'Due Today') dueDate = new Date();
      else if (groupContextKey === 'Due Tomorrow') dueDate = new Date(Date.now() + 86400000);
    }

    try {
      const created = await enhancedApi.createTask(inlineTaskTitle.trim(), defaultProjectId, status);
      await enhancedApi.updateTask(created.id, {
        assigneeId: currentUser.uid,
        priority,
        dueDate,
      });
      setInlineTaskTitle('');
      setInlineTaskGroup(null);
      await loadTasks();
      showToast('Task created');
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Quick Add task at the top
  const handleQuickAddTask = async () => {
    const title = prompt('Enter task name:');
    if (!title || !title.trim()) return;
    const defaultProjectId = projects[0]?.id || 'proj-1';
    try {
      const created = await enhancedApi.createTask(title.trim(), defaultProjectId, 'To Do');
      await enhancedApi.updateTask(created.id, {
        assigneeId: currentUser.uid,
        dueDate: new Date(Date.now() + 86400000 * 2)
      });
      await loadTasks();
      showToast('Task created and assigned to you');
    } catch (err) {
      console.error('Failed to quick add task:', err);
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return scopedTasks.filter(task => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = (task.description || '').toLowerCase().includes(query);
        const project = getProjectById(task.projectId);
        const matchesProject = project ? project.name.toLowerCase().includes(query) : false;
        if (!matchesTitle && !matchesDesc && !matchesProject) return false;
      }

      // Status
      if (filterStatus !== 'all') {
        if (filterStatus === 'completed' && task.status !== 'Done') return false;
        if (filterStatus === 'incomplete' && task.status === 'Done') return false;
        if (filterStatus === 'in_progress' && task.status !== 'In Progress') return false;
        if (filterStatus === 'to_do' && task.status !== 'To Do') return false;
      }

      // Priority
      if (filterPriority !== 'all' && task.priority !== filterPriority) {
        return false;
      }

      // Project
      if (filterProject !== 'all' && task.projectId !== filterProject) {
        return false;
      }

      // Due Date Filter (including 24-hour urgency filter)
      if (filterDueDate !== 'all') {
        if (filterDueDate === 'no_date' && task.dueDate) return false;
        if (filterDueDate !== 'no_date' && !task.dueDate) return false;
        
        if (task.dueDate) {
          const now = Date.now();
          const dueTime = new Date(task.dueDate).getTime();
          const diffMs = dueTime - now;
          const diffHours = Math.round(diffMs / (1000 * 60 * 60));

          if (filterDueDate === 'due_24h') {
            // Must be within 0 to 24 hours and not completed
            if (task.status === 'Done' || diffMs < 0 || diffMs > 24 * 60 * 60 * 1000) return false;
          } else if (filterDueDate === 'overdue') {
            if (diffMs >= 0 || task.status === 'Done') return false;
          } else if (filterDueDate === 'today') {
            const today = new Date();
            const d = new Date(task.dueDate);
            if (today.toDateString() !== d.toDateString()) return false;
          } else if (filterDueDate === 'this_week') {
            const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays < 0 || diffDays > 7) return false;
          }
        }
      }

      return true;
    });
  }, [scopedTasks, searchQuery, filterStatus, filterPriority, filterProject, filterDueDate, projects]);

  // Grouping logic
  const taskGroups = useMemo((): TaskGroup[] => {
    if (groupBy === 'none') {
      return [{
        id: 'all',
        title: 'All Tasks',
        count: filteredTasks.length,
        tasks: sortTasksList(filteredTasks)
      }];
    }

    const groupsMap: { [key: string]: { title: string; color?: string; tasks: Task[] } } = {};

    filteredTasks.forEach(task => {
      let groupKey = '';
      let groupTitle = '';
      let groupColor: string | undefined = undefined;

      switch (groupBy) {
        case 'project': {
          const project = getProjectById(task.projectId);
          groupKey = task.projectId || 'no-proj';
          groupTitle = project ? project.name : 'Unassigned Project';
          groupColor = project?.color;
          break;
        }
        case 'status': {
          groupKey = task.status;
          groupTitle = task.status;
          break;
        }
        case 'priority': {
          const p = task.priority || 'medium';
          groupKey = p;
          groupTitle = p.charAt(0).toUpperCase() + p.slice(1) + ' Priority';
          break;
        }
        case 'dueDate': {
          if (!task.dueDate) {
            groupKey = 'no_date';
            groupTitle = 'No Due Date';
          } else {
            const now = Date.now();
            const taskDueTime = new Date(task.dueDate).getTime();
            const diffMs = taskDueTime - now;

            if (diffMs < 0) {
              groupKey = 'overdue';
              groupTitle = 'Overdue';
            } else if (diffMs <= 24 * 60 * 60 * 1000) {
              groupKey = 'due_24h';
              groupTitle = 'Due in 24 Hours';
            } else if (diffMs <= 48 * 60 * 60 * 1000) {
              groupKey = 'tomorrow';
              groupTitle = 'Due Tomorrow';
            } else if (diffMs <= 7 * 24 * 60 * 60 * 1000) {
              groupKey = 'this_week';
              groupTitle = 'Due This Week';
            } else {
              groupKey = 'later';
              groupTitle = 'Due Later';
            }
          }
          break;
        }
      }

      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = { title: groupTitle, color: groupColor, tasks: [] };
      }
      groupsMap[groupKey].tasks.push(task);
    });

    return Object.entries(groupsMap).map(([id, g]) => ({
      id,
      title: g.title,
      color: g.color,
      count: g.tasks.length,
      tasks: sortTasksList(g.tasks)
    }));
  }, [filteredTasks, groupBy, sortBy, sortOrder, projects]);

  function sortTasksList(list: Task[]): Task[] {
    return [...list].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) comparison = 0;
          else if (!a.dueDate) comparison = 1;
          else if (!b.dueDate) comparison = -1;
          else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          break;
        case 'priority':
          comparison = (priorityOrder[a.priority || 'medium'] ?? 2) - (priorityOrder[b.priority || 'medium'] ?? 2);
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'created':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const hasActiveFilters = filterStatus !== 'all' || filterPriority !== 'all' || filterProject !== 'all' || filterDueDate !== 'all' || searchQuery.length > 0;

  const clearAllFilters = () => {
    setFilterStatus('all');
    setFilterPriority('all');
    setFilterProject('all');
    setFilterDueDate('all');
    setSearchQuery('');
  };

  // Quick Share Task Summary
  const handleShareMyTasks = () => {
    const summary = `My Tasks Summary (${filteredTasks.length} tasks):\n` +
      filteredTasks.map(t => `- [${t.status === 'Done' ? 'X' : ' '}] ${t.title} (${t.priority})`).join('\n');
    navigator.clipboard.writeText(summary);
    showToast('Task summary copied to clipboard!');
    setShowShareModal(false);
  };

  // Performance Dashboard Calculations
  const stats = useMemo(() => {
    const total = scopedTasks.length;
    const completed = scopedTasks.filter(t => t.status === 'Done').length;
    const inProgress = scopedTasks.filter(t => t.status === 'In Progress').length;
    const toDo = scopedTasks.filter(t => t.status === 'To Do').length;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const overdue = scopedTasks.filter(t => {
      if (t.status === 'Done' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      return d < now;
    }).length;

    const dueIn24h = scopedTasks.filter(t => {
      const urgency = getTaskUrgency(t);
      return urgency && urgency.type === 'due_24h';
    }).length;

    const dueThisWeek = scopedTasks.filter(t => {
      if (t.status === 'Done' || !t.dueDate) return false;
      const d = new Date(t.dueDate);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;

    const totalMinutesTracked = scopedTasks.reduce((sum, t) => sum + (t.timeTracked || 0), 0);
    const hoursTracked = (totalMinutesTracked / 60).toFixed(1);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, toDo, overdue, dueIn24h, dueThisWeek, hoursTracked, completionRate };
  }, [scopedTasks]);

  // Calendar Calculations
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startingDayOfWeek = firstDay.getDay(); // 0 is Sun
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean; tasks: Task[] }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({ date: d, isCurrentMonth: false, tasks: [] });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const dayTasks = scopedTasks.filter(t => {
        if (!t.dueDate) return false;
        const taskDate = new Date(t.dueDate);
        return taskDate.getFullYear() === year && taskDate.getMonth() === month && taskDate.getDate() === i;
      });
      days.push({ date: d, isCurrentMonth: true, tasks: dayTasks });
    }

    // Next month padding to fill complete grid of 35 or 42
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, tasks: [] });
    }

    return days;
  }, [calendarDate, scopedTasks]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Loading your tasks...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden relative transition-colors">
      {/* Toast Notification */}
      {shareToast && (
        <div className="absolute top-4 right-4 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-2 rounded-lg shadow-lg text-sm flex items-center space-x-2 animate-bounce">
          <CheckCircleIcon className="w-4 h-4 text-green-400 dark:text-green-600" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 gap-3">
        <div className="flex items-center space-x-4 flex-wrap gap-y-2">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">My Tasks</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {scopedTasks.filter(t => t.status !== 'Done').length} open tasks · {stats.completed} completed
              </p>
            </div>
          </div>

          {/* Scope Switcher Tabs */}
          <div className="hidden sm:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 ml-2">
            <button
              onClick={() => setScope('assigned')}
              className={`px-3 py-1 rounded-md transition-all ${scope === 'assigned' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              Assigned to me ({tasks.filter(t => t.assigneeId === currentUser.uid).length})
            </button>
            <button
              onClick={() => setScope('created')}
              className={`px-3 py-1 rounded-md transition-all ${scope === 'created' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              Created by me ({tasks.filter(t => t.createdBy === currentUser.uid).length})
            </button>
            <button
              onClick={() => setScope('all')}
              className={`px-3 py-1 rounded-md transition-all ${scope === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'hover:text-slate-900 dark:hover:text-white'}`}
            >
              All Workspace ({tasks.length})
            </button>
          </div>

          {/* ⭐ 24-Hour Upcoming Due Date Notification Badge in Top Header */}
          {tasksDueWithin24h.length > 0 && (
            <button
              onClick={() => setFilterDueDate(filterDueDate === 'due_24h' ? 'all' : 'due_24h')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                filterDueDate === 'due_24h'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm ring-2 ring-amber-200 dark:ring-amber-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/60'
              }`}
              title="Click to filter tasks due in the next 24 hours"
            >
              <FlameIcon className={`w-3.5 h-3.5 ${filterDueDate === 'due_24h' ? 'text-white' : 'text-amber-600 dark:text-amber-400'} animate-pulse`} />
              <span>{tasksDueWithin24h.length} due in 24h</span>
              <span className={`w-2 h-2 rounded-full ${filterDueDate === 'due_24h' ? 'bg-white' : 'bg-amber-500'} animate-ping`}></span>
            </button>
          )}

          {/* Overdue Badge if any */}
          {overdueTasksList.length > 0 && (
            <button
              onClick={() => setFilterDueDate(filterDueDate === 'overdue' ? 'all' : 'overdue')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                filterDueDate === 'overdue'
                  ? 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-200 dark:ring-red-900'
                  : 'bg-red-50 dark:bg-red-950/60 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/60'
              }`}
              title="Click to filter overdue tasks"
            >
              <AlertTriangleIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400 mr-1" />
              <span>{overdueTasksList.length} overdue</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button 
            onClick={loadTasks} 
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Refresh tasks"
          >
            <RefreshCwIcon className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowShareModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
          >
            <ShareIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Share</span>
          </button>
          <button 
            onClick={() => setShowCustomizeMenu(!showCustomizeMenu)}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors relative"
          >
            <CustomizeIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* Main View Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 gap-2">
        {/* View Switcher buttons */}
        <div className="flex items-center space-x-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg">
          {(['list', 'board', 'calendar', 'dashboard', 'files'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-semibold capitalize rounded-md transition-all ${
                viewMode === mode 
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleQuickAddTask}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add task</span>
          </button>
        </div>

        {/* Controls: Search, Filter, Sort, Group */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Search Bar */}
          <div className="relative">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-7 py-1 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-36 sm:w-48 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Menu Toggle */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowFilterMenu(!showFilterMenu);
                setShowSortMenu(false);
                setShowGroupMenu(false);
              }}
              className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium border rounded-lg transition-colors ${
                hasActiveFilters 
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5" />
              <span>Filter</span>
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
            </button>

            {/* Filter Dropdown */}
            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-30 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Filter Tasks</span>
                  {hasActiveFilters && (
                    <button 
                      onClick={clearAllFilters}
                      className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Due Date with 24 Hours Option */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Due Date</label>
                  <select 
                    value={filterDueDate}
                    onChange={(e) => setFilterDueDate(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md p-1.5 focus:outline-none"
                  >
                    <option value="all">Any time</option>
                    <option value="due_24h">🔥 Due in 24 Hours ({tasksDueWithin24h.length})</option>
                    <option value="overdue">⚠️ Overdue ({overdueTasksList.length})</option>
                    <option value="today">Due Today</option>
                    <option value="this_week">Due This Week</option>
                    <option value="no_date">No Due Date</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Status</label>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md p-1.5 focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="incomplete">Incomplete Only</option>
                    <option value="completed">Completed Only</option>
                    <option value="in_progress">In Progress</option>
                    <option value="to_do">To Do</option>
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Priority</label>
                  <select 
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md p-1.5 focus:outline-none"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                {/* Project */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Project</label>
                  <select 
                    value={filterProject}
                    onChange={(e) => setFilterProject(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-md p-1.5 focus:outline-none"
                  >
                    <option value="all">All Projects</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Sort Menu Toggle */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowSortMenu(!showSortMenu);
                setShowFilterMenu(false);
                setShowGroupMenu(false);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <SortIcon className="w-3.5 h-3.5" />
              <span>Sort: {sortBy}</span>
            </button>

            {showSortMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30 space-y-1">
                <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sort by</span>
                {(['dueDate', 'priority', 'created', 'name'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      if (sortBy === option) {
                        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortBy(option);
                      }
                      setShowSortMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                      sortBy === option ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span className="capitalize">{option === 'dueDate' ? 'Due Date' : option}</span>
                    {sortBy === option && (
                      <span className="text-[10px] font-normal">{sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Group Menu Toggle */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowGroupMenu(!showGroupMenu);
                setShowFilterMenu(false);
                setShowSortMenu(false);
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <GroupIcon className="w-3.5 h-3.5" />
              <span>Group: {groupBy}</span>
            </button>

            {showGroupMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 z-30 space-y-1">
                <span className="block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Group by</span>
                {(['project', 'status', 'priority', 'dueDate', 'none'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => {
                      setGroupBy(g);
                      setShowGroupMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                      groupBy === g ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <span className="capitalize">{g === 'dueDate' ? 'Due Date' : g}</span>
                    {groupBy === g && <CheckIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Notification Banner if 24h filter or active filters applied */}
      {filterDueDate === 'due_24h' && (
        <div className="px-6 py-2 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center space-x-2 font-medium">
            <FlameIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-500 animate-pulse" />
            <span>Showing <strong>{filteredTasks.length}</strong> tasks with due dates in the next 24 hours</span>
          </div>
          <button 
            onClick={() => setFilterDueDate('all')}
            className="text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 font-bold underline text-xs"
          >
            Show all tasks
          </button>
        </div>
      )}

      {/* Customize Columns Dropdown Menu */}
      {showCustomizeMenu && (
        <div className="absolute right-6 top-16 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3 z-40 space-y-2">
          <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-slate-700">Table Columns</span>
          <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleColumns.dueDate} 
              onChange={e => setVisibleColumns(v => ({ ...v, dueDate: e.target.checked }))}
              className="rounded text-blue-600" 
            />
            <span>Due date</span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleColumns.projects} 
              onChange={e => setVisibleColumns(v => ({ ...v, projects: e.target.checked }))}
              className="rounded text-blue-600" 
            />
            <span>Project</span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleColumns.priority} 
              onChange={e => setVisibleColumns(v => ({ ...v, priority: e.target.checked }))}
              className="rounded text-blue-600" 
            />
            <span>Priority</span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleColumns.dependencies} 
              onChange={e => setVisibleColumns(v => ({ ...v, dependencies: e.target.checked }))}
              className="rounded text-blue-600" 
            />
            <span>Dependencies & Blockers</span>
          </label>
          <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={visibleColumns.time} 
              onChange={e => setVisibleColumns(v => ({ ...v, time: e.target.checked }))}
              className="rounded text-blue-600" 
            />
            <span>Time logged</span>
          </label>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Share Your Task List</h3>
              <button onClick={() => setShowShareModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Export or copy an active markdown report of your {filteredTasks.length} tasks to clipboard or send via email.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto">
              {filteredTasks.map(t => (
                <div key={t.id}>[{t.status === 'Done' ? 'x' : ' '}] {t.title} ({t.priority})</div>
              ))}
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button 
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button 
                onClick={handleShareMyTasks}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-y-auto">
          {/* Table Header */}
          <div className="sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-xs z-10 flex items-center px-6 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <div className="flex-1 min-w-0">Task Name</div>
            {visibleColumns.dueDate && <div className="w-32 text-center">Due Date</div>}
            {visibleColumns.projects && <div className="w-32 text-center">Project</div>}
            {visibleColumns.priority && <div className="w-24 text-center">Priority</div>}
            {visibleColumns.dependencies && <div className="w-28 text-center">Blockers</div>}
            {visibleColumns.time && <div className="w-20 text-center">Time</div>}
            <div className="w-12 text-center">Actions</div>
          </div>

          {/* Task Groups */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 pb-16">
            {taskGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.id);

              return (
                <div key={group.id} className="bg-white dark:bg-slate-950">
                  {/* Group Header */}
                  <div 
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center justify-between px-6 py-2.5 bg-slate-50/80 dark:bg-slate-900/80 hover:bg-slate-100/80 dark:hover:bg-slate-850 cursor-pointer border-b border-slate-100 dark:border-slate-800 select-none transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      {isCollapsed ? (
                        <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                      )}
                      <div className="flex items-center space-x-2">
                        {group.id === 'due_24h' && <FlameIcon className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />}
                        {group.color && <div className={`w-2.5 h-2.5 rounded-full ${group.color}`} />}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{group.title}</span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        group.id === 'due_24h' ? 'bg-amber-200 dark:bg-amber-950 text-amber-900 dark:text-amber-200' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {group.count}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInlineTaskGroup(group.id);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors"
                      title="Add task to this group"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Group Tasks */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {group.tasks.map((task) => {
                        const project = getProjectById(task.projectId);
                        const isDone = task.status === 'Done';
                        const isActionOpen = activeActionMenuTaskId === task.id;
                        const urgency = getTaskUrgency(task);
                        const isDue24h = urgency && urgency.type === 'due_24h';
                        const isOverdue = urgency && urgency.type === 'overdue';

                        return (
                          <div 
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className={`flex items-center px-6 py-2.5 hover:bg-slate-50/80 dark:hover:bg-slate-900/60 cursor-pointer transition-colors group relative ${
                              isDone 
                                ? 'bg-slate-50/40 dark:bg-slate-900/20 text-slate-400 dark:text-slate-500' 
                                : isDue24h
                                  ? 'bg-amber-50/25 dark:bg-amber-950/20 border-l-4 border-l-amber-500 text-slate-900 dark:text-slate-100'
                                  : isOverdue
                                    ? 'bg-red-50/25 dark:bg-red-950/20 border-l-4 border-l-red-500 text-slate-900 dark:text-slate-100'
                                    : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {/* Task Status & Title */}
                            <div className="flex-1 min-w-0 flex items-center space-x-3 pr-4">
                              {/* Completion Checkbox */}
                              <button
                                onClick={(e) => handleToggleComplete(task, e)}
                                className="flex-shrink-0 focus:outline-none transition-transform active:scale-90"
                                title={isDone ? "Mark Incomplete" : "Mark Complete"}
                              >
                                {isDone ? (
                                  <CheckCircleIcon className="w-5 h-5 text-emerald-500 hover:text-emerald-600 fill-emerald-50" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 transition-colors" />
                                )}
                              </button>

                              {/* Title */}
                              <span className={`text-xs font-medium truncate ${
                                isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                              }`}>
                                {task.title}
                              </span>

                              {/* ⭐ 24-Hour Visual Notification Badge */}
                              {isDue24h && !isDone && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs shrink-0">
                                  <FlameIcon className="w-3 h-3 text-amber-600 fill-amber-500 animate-pulse" />
                                  <span>{urgency.label}</span>
                                </span>
                              )}

                              {/* Overdue Badge */}
                              {isOverdue && !isDone && (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700 shrink-0">
                                  <AlertTriangleIcon className="w-3 h-3 text-red-600" />
                                  <span>Overdue</span>
                                </span>
                              )}

                              {/* Dependencies Badge */}
                              {((task.blockedBy && task.blockedBy.length > 0) || (task.dependencies && task.dependencies.length > 0)) && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  <AlertTriangleIcon className="w-3 h-3 mr-1 text-slate-500" />
                                  Blocked
                                </span>
                              )}

                              {/* Subtask count */}
                              {task.subtasks && task.subtasks.length > 0 && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  ({task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks)
                                </span>
                              )}
                            </div>

                            {/* Due Date */}
                            {visibleColumns.dueDate && (
                              <div className="w-32 text-center">
                                {task.dueDate ? (
                                  <span className={`text-[11px] px-2 py-0.5 rounded-md inline-flex items-center space-x-1 ${getDueDateStyle(task.dueDate, isDone)}`}>
                                    {isDue24h && !isDone && <FlameIcon className="w-3 h-3 text-amber-700 dark:text-amber-400" />}
                                    <span>{formatDueDate(task.dueDate)}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </div>
                            )}

                            {/* Project Badge */}
                            {visibleColumns.projects && (
                              <div className="w-32 text-center">
                                {project ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onNavigateToProject) onNavigateToProject(project.id);
                                    }}
                                    className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 max-w-full truncate"
                                  >
                                    <div className={`w-2 h-2 rounded-full ${project.color}`} />
                                    <span className="truncate">{project.name}</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-300 dark:text-slate-600">No project</span>
                                )}
                              </div>
                            )}

                            {/* Priority Pill */}
                            {visibleColumns.priority && (
                              <div className="w-24 text-center" onClick={(e) => cyclePriority(task, e)}>
                                {getPriorityBadge(task.priority || 'medium')}
                              </div>
                            )}

                            {/* Dependencies status */}
                            {visibleColumns.dependencies && (
                              <div className="w-28 text-center text-[11px] text-slate-500 dark:text-slate-400">
                                {task.dependencies && task.dependencies.length > 0 ? (
                                  <span className="text-amber-700 dark:text-amber-400 font-semibold">{task.dependencies.length} link(s)</span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </div>
                            )}

                            {/* Time Tracked */}
                            {visibleColumns.time && (
                              <div className="w-20 text-center text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                {task.timeTracked ? `${(task.timeTracked / 60).toFixed(1)}h` : '-'}
                              </div>
                            )}

                            {/* Actions Dropdown */}
                            <div className="w-12 text-center relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMenuTaskId(isActionOpen ? null : task.id);
                                }}
                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                              >
                                <DotsHorizontalIcon className="w-4 h-4" />
                              </button>

                              {isActionOpen && (
                                <div className="absolute right-0 top-8 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-30 text-left">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTask(task);
                                      setActiveActionMenuTaskId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2"
                                  >
                                    <EyeIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Details</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      handleDuplicateTask(task, e);
                                      setActiveActionMenuTaskId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2"
                                  >
                                    <CopyIcon className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Duplicate</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      handleDeleteTask(task.id, e);
                                      setActiveActionMenuTaskId(null);
                                    }}
                                    className="w-full px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center space-x-2"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5 text-red-500" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Inline Task Creator Row */}
                      {inlineTaskGroup === group.id ? (
                        <div className="flex items-center px-6 py-2 bg-blue-50/50 dark:bg-blue-950/30 border-t border-b border-blue-100 dark:border-blue-900">
                          <div className="w-4 h-4 rounded-full border-2 border-dashed border-blue-400 mr-3"></div>
                          <input
                            type="text"
                            autoFocus
                            placeholder="Type a task name and press Enter..."
                            value={inlineTaskTitle}
                            onChange={(e) => setInlineTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCreateInlineTask(group.title, group.id.startsWith('proj-') ? group.id : undefined);
                              if (e.key === 'Escape') setInlineTaskGroup(null);
                            }}
                            className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                          />
                          <div className="flex items-center space-x-1.5">
                            <button
                              onClick={() => handleCreateInlineTask(group.title, group.id.startsWith('proj-') ? group.id : undefined)}
                              className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-semibold rounded hover:bg-blue-700"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setInlineTaskGroup(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setInlineTaskGroup(group.id)}
                          className="w-full flex items-center px-6 py-2 text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                        >
                          <PlusIcon className="w-3.5 h-3.5 mr-2" />
                          <span>Add task...</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <CheckCircleIcon className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">No tasks match your filters</h3>
                <p className="text-xs text-slate-400 mb-4">Try resetting filters or adding a new task</p>
                <button
                  onClick={handleQuickAddTask}
                  className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create new task
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. KANBAN BOARD VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'board' && (
        <div className="flex-1 overflow-x-auto p-6 bg-slate-100/60 dark:bg-slate-950/60">
          <div className="flex space-x-6 min-w-max h-full">
            {(['To Do', 'In Progress', 'Done'] as ColumnId[]).map((columnStatus) => {
              const colTasks = filteredTasks.filter(t => t.status === columnStatus);
              const isOver = dragOverColumn === columnStatus;

              return (
                <div 
                  key={columnStatus} 
                  onDragOver={(e) => handleDragOverColumn(e, columnStatus)}
                  onDragLeave={handleDragLeaveColumn}
                  onDrop={(e) => handleDropOnColumn(e, columnStatus)}
                  className={`w-80 flex flex-col rounded-2xl p-3 max-h-full transition-all border ${
                    isOver 
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-500 ring-2 ring-blue-400/50' 
                      : 'bg-slate-200/50 dark:bg-slate-900 border-transparent dark:border-slate-800'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-2 py-2 mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{columnStatus}</span>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full shadow-xs border border-transparent dark:border-slate-700">
                        {colTasks.length}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        const title = prompt(`Add task to ${columnStatus}:`);
                        if (title && title.trim()) {
                          const created = await enhancedApi.createTask(title.trim(), projects[0]?.id || 'proj-1', columnStatus);
                          await enhancedApi.updateTask(created.id, { assigneeId: currentUser.uid });
                          await loadTasks();
                        }
                      }}
                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded transition-colors"
                      title={`Add task to ${columnStatus}`}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Task Cards */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {colTasks.map((task) => {
                      const project = getProjectById(task.projectId);
                      const isDone = task.status === 'Done';
                      const urgency = getTaskUrgency(task);
                      const isDue24h = urgency && urgency.type === 'due_24h';
                      const isBeingDragged = draggedTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTask(task)}
                          className={`bg-white dark:bg-slate-800 p-3.5 rounded-xl border shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:border-blue-400 dark:hover:border-blue-500 group select-none ${
                            isBeingDragged ? 'opacity-40 scale-95 border-dashed border-blue-400' : ''
                          } ${
                            isDue24h && !isDone 
                              ? 'border-amber-300 dark:border-amber-700 ring-1 ring-amber-200 dark:ring-amber-900 bg-amber-50/20 dark:bg-amber-950/20' 
                              : 'border-slate-200/80 dark:border-slate-700'
                          }`}
                        >
                          {/* 24-Hour Indicator Banner in Board Card */}
                          {isDue24h && !isDone && (
                            <div className="flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 mb-2 w-fit">
                              <FlameIcon className="w-3 h-3 text-amber-600 fill-amber-500 animate-pulse" />
                              <span>{urgency.label}</span>
                            </div>
                          )}

                          <div className="flex items-start justify-between space-x-2 mb-2">
                            <div className="flex items-center space-x-2 flex-1">
                              <button
                                onClick={(e) => handleToggleComplete(task, e)}
                                className="focus:outline-none"
                              >
                                {isDone ? (
                                  <CheckCircleIcon className="w-4 h-4 text-emerald-500" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-slate-400 dark:border-slate-500 hover:border-emerald-500" />
                                )}
                              </button>
                              <h4 className={`text-xs font-bold ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                                {task.title}
                              </h4>
                            </div>
                            {getPriorityBadge(task.priority || 'medium')}
                          </div>

                          {task.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700 text-[11px]">
                            {/* Project Tag */}
                            {project && (
                              <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-400">
                                <div className={`w-2 h-2 rounded-full ${project.color}`} />
                                <span className="truncate max-w-[100px]">{project.name}</span>
                              </div>
                            )}

                            {/* Due date */}
                            {task.dueDate && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] inline-flex items-center space-x-1 ${getDueDateStyle(task.dueDate, isDone)}`}>
                                {isDue24h && !isDone && <FlameIcon className="w-3 h-3 text-amber-700 dark:text-amber-400" />}
                                <span>{formatDueDate(task.dueDate)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {colTasks.length === 0 && (
                      <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                        No tasks in {columnStatus}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CALENDAR VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'calendar' && (
        <div className="flex-1 flex flex-col p-6 bg-white dark:bg-slate-950 overflow-hidden">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex items-center space-x-1 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-white dark:bg-slate-900">
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarDate(new Date())}
                  className="px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                >
                  Today
                </button>
                <button
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Click any date to schedule a new task</span>
          </div>

          {/* Days of week header */}
          <div className="grid grid-cols-7 border-t border-l border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-center py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 flex-1 border border-slate-200 dark:border-slate-800 divide-x divide-y divide-slate-200 dark:divide-slate-800 overflow-y-auto">
            {calendarDays.map((day, idx) => {
              const isToday = day.date.toDateString() === new Date().toDateString();

              return (
                <div
                  key={idx}
                  onClick={async () => {
                    const title = prompt(`Create task for ${day.date.toLocaleDateString()}:`);
                    if (title && title.trim()) {
                      const created = await enhancedApi.createTask(title.trim(), projects[0]?.id || 'proj-1', 'To Do');
                      await enhancedApi.updateTask(created.id, {
                        assigneeId: currentUser.uid,
                        dueDate: day.date,
                      });
                      await loadTasks();
                    }
                  }}
                  className={`min-h-[100px] p-2 flex flex-col transition-colors cursor-pointer hover:bg-blue-50/30 dark:hover:bg-blue-950/20 ${
                    day.isCurrentMonth ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/50 dark:bg-slate-900/40 text-slate-300 dark:text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                      isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {day.date.getDate()}
                    </span>
                    {day.tasks.length > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">{day.tasks.length}</span>
                    )}
                  </div>

                  <div className="flex-1 space-y-1 overflow-y-auto max-h-24">
                    {day.tasks.map(task => {
                      const isDone = task.status === 'Done';
                      const urgency = getTaskUrgency(task);
                      const isDue24h = urgency && urgency.type === 'due_24h';

                      return (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-medium truncate border transition-all ${
                            isDone 
                              ? 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 line-through'
                              : isDue24h
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold flex items-center space-x-1'
                                : 'bg-blue-50 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/80 font-semibold'
                          }`}
                        >
                          {isDue24h && !isDone && <FlameIcon className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                          <span className="truncate">{task.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. DASHBOARD / PRODUCTIVITY VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="flex-1 p-6 bg-slate-50/60 dark:bg-slate-950/60 overflow-y-auto space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Tasks</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{stats.completionRate}% Done</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${stats.completionRate}%` }}></div>
              </div>
            </div>

            {/* ⭐ 24-Hour Urgent Metric Card */}
            <div 
              onClick={() => {
                setViewMode('list');
                setFilterDueDate('due_24h');
              }}
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-xs hover:border-amber-400 dark:hover:border-amber-600 cursor-pointer transition-all hover:bg-amber-50/20 dark:hover:bg-amber-950/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Due in 24 Hours</span>
                <FlameIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-pulse" />
              </div>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className={`text-2xl font-bold ${stats.dueIn24h > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{stats.dueIn24h}</span>
                <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Immediate action</span>
              </div>
              <span className="text-[11px] text-amber-800/80 dark:text-amber-400 mt-3 block font-medium">Click to filter upcoming tasks</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Overdue Tasks</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{stats.overdue}</span>
                <span className="text-xs text-slate-400">Needs attention</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 block">High SLA risk impact</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Due This Week</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{stats.dueThisWeek}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Active workload</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 block">Upcoming commitments</span>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Task Status Distribution</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Completed ({stats.completed})</span>
                    <span>{stats.completionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${stats.completionRate}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>In Progress ({stats.inProgress})</span>
                    <span>{stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>To Do ({stats.toDo})</span>
                    <span>{stats.total > 0 ? Math.round((stats.toDo / stats.total) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-slate-400 dark:bg-slate-600 h-full" style={{ width: `${stats.total > 0 ? (stats.toDo / stats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming Deadlines Queue with 24h Visual Badges */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Next Priority Deadlines</h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                {scopedTasks
                  .filter(t => t.status !== 'Done' && t.dueDate)
                  .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
                  .slice(0, 6)
                  .map(task => {
                    const urgency = getTaskUrgency(task);
                    const isDue24h = urgency && urgency.type === 'due_24h';
                    return (
                      <div 
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        className={`py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg px-2 ${
                          isDue24h ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {isDue24h ? (
                            <FlameIcon className="w-3.5 h-3.5 text-amber-600 fill-amber-500 shrink-0 animate-pulse" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{task.title}</span>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {isDue24h && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                              {urgency?.label}
                            </span>
                          )}
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {formatDueDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FILES & ATTACHMENTS VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'files' && (
        <div className="flex-1 p-6 bg-white dark:bg-slate-950 overflow-y-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Task Attachments & Deliverables</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">All assets and documents attached across your assigned tasks</p>
            </div>
            <button
              onClick={() => {
                const name = prompt('Simulate file upload. Enter file name:');
                if (name && name.trim()) {
                  setUploadedFiles(prev => [
                    {
                      id: `f-${Date.now()}`,
                      name: name.trim(),
                      size: '1.2 MB',
                      type: name.includes('.') ? name.split('.').pop()! : 'file',
                      taskTitle: 'My Tasks Deliverable',
                      projectName: projects[0]?.name || 'Workspace',
                      uploadedAt: 'Just now'
                    },
                    ...prev
                  ]);
                  showToast('File attached successfully');
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <PaperclipIcon className="w-4 h-4" />
              <span>Upload file</span>
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900 px-6 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <div className="col-span-5">File Name</div>
              <div className="col-span-3">Associated Task</div>
              <div className="col-span-2">Project</div>
              <div className="col-span-1">Size</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {uploadedFiles.map((file) => (
              <div key={file.id} className="grid grid-cols-12 px-6 py-3.5 items-center hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors text-xs text-slate-700 dark:text-slate-300">
                <div className="col-span-5 flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold uppercase text-[10px]">
                    {file.type}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 block">{file.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{file.uploadedAt}</span>
                  </div>
                </div>

                <div className="col-span-3 truncate font-medium text-slate-600 dark:text-slate-400">
                  {file.taskTitle}
                </div>

                <div className="col-span-2 truncate text-slate-500 dark:text-slate-400">
                  {file.projectName}
                </div>

                <div className="col-span-1 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                  {file.size}
                </div>

                <div className="col-span-1 flex justify-end space-x-2">
                  <button 
                    onClick={() => showToast(`Downloading ${file.name}...`)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Download file"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setUploadedFiles(prev => prev.filter(f => f.id !== file.id));
                      showToast('File removed');
                    }}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Remove file"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Modal for Inspection & Full Editing */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          users={users}
          currentUser={currentUser}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
          onNavigateToTask={(t) => setSelectedTask(t)}
        />
      )}
    </div>
  );
};

export default MyTasksPage;
