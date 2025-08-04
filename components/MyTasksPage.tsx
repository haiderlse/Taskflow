
import React, { useState, useEffect } from 'react';
import { Task, Project, User, Priority } from '../types';
import { enhancedApi } from '../services/enhancedApi';
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
  CalendarIcon,
  UserIcon,
  CheckCircleIcon,
  ClockIcon,
  DotsHorizontalIcon,
  XIcon
} from './icons';

interface MyTasksPageProps {
  currentUser: User;
  users: User[];
  projects: Project[];
}

interface TaskGroup {
  title: string;
  count: number;
  tasks: Task[];
  isCollapsed?: boolean;
}

const MyTasksPage: React.FC<MyTasksPageProps> = ({ currentUser, users, projects }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'calendar' | 'dashboard' | 'files'>('list');
  const [groupBy, setGroupBy] = useState<'project' | 'status' | 'priority' | 'dueDate' | 'none'>('project');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created' | 'updated' | 'name'>('dueDate');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadTasks = async () => {
      try {
        setLoading(true);
        const userTasks = await enhancedApi.getTasksForUser(currentUser.uid);
        setTasks(userTasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [currentUser.uid]);

  const getUserById = (userId: string): User | undefined => {
    return users.find(user => user.uid === userId);
  };

  const getProjectById = (projectId: string): Project | undefined => {
    return projects.find(project => project.id === projectId);
  };

  const getPriorityColor = (priority: Priority): string => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Done':
        return <CheckCircleIcon className="w-4 h-4 text-green-600" />;
      case 'In Progress':
        return <div className="w-4 h-4 rounded-full bg-blue-500"></div>;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300"></div>;
    }
  };

  const formatDueDate = (date: Date | null): string => {
    if (!date) return '';
    const now = new Date();
    const dueDate = new Date(date);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
    if (diffDays < 7) return `${diffDays} days`;
    
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDueDateColor = (date: Date | null): string => {
    if (!date) return 'text-gray-500';
    const now = new Date();
    const dueDate = new Date(date);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-red-600'; // Overdue
    if (diffDays <= 1) return 'text-orange-600'; // Due today or tomorrow
    if (diffDays <= 7) return 'text-yellow-600'; // Due this week
    return 'text-gray-600'; // Due later
  };

  const groupTasks = (tasks: Task[]): TaskGroup[] => {
    if (groupBy === 'none') {
      return [{
        title: 'All Tasks',
        count: tasks.length,
        tasks: tasks
      }];
    }

    const groups: { [key: string]: Task[] } = {};

    tasks.forEach(task => {
      let groupKey = '';
      
      switch (groupBy) {
        case 'project':
          const project = getProjectById(task.projectId);
          groupKey = project ? project.name : 'No Project';
          break;
        case 'status':
          groupKey = task.status;
          break;
        case 'priority':
          groupKey = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
          break;
        case 'dueDate':
          if (!task.dueDate) {
            groupKey = 'No Due Date';
          } else {
            const dueDate = new Date(task.dueDate);
            const today = new Date();
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) groupKey = 'Overdue';
            else if (diffDays === 0) groupKey = 'Due Today';
            else if (diffDays === 1) groupKey = 'Due Tomorrow';
            else if (diffDays <= 7) groupKey = 'Due This Week';
            else groupKey = 'Due Later';
          }
          break;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });

    return Object.entries(groups).map(([title, tasks]) => ({
      title,
      count: tasks.length,
      tasks: tasks.sort((a, b) => {
        switch (sortBy) {
          case 'dueDate':
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          case 'priority':
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          case 'name':
            return a.title.localeCompare(b.title);
          case 'created':
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          case 'updated':
            return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          default:
            return 0;
        }
      }),
      isCollapsed: collapsedGroups.has(title)
    }));
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const taskGroups = groupTasks(filteredTasks);

  const toggleGroup = (groupTitle: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupTitle)) {
      newCollapsed.delete(groupTitle);
    } else {
      newCollapsed.add(groupTitle);
    }
    setCollapsedGroups(newCollapsed);
  };

  const handleTaskClick = (task: Task) => {
    // In a real app, this would open a task detail modal or navigate to task page
    console.log('Task clicked:', task);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading your tasks...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CheckCircleIcon className="w-6 h-6 text-orange-500" />
            <h1 className="text-xl font-semibold text-gray-900">My tasks</h1>
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            <ShareIcon className="w-4 h-4" />
            <span>Share</span>
          </button>
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            <CustomizeIcon className="w-4 h-4" />
            <span>Customize</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded ${viewMode === 'list' ? 'bg-white shadow-sm border' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <span>List</span>
          </button>
          <button 
            onClick={() => setViewMode('board')}
            className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded ${viewMode === 'board' ? 'bg-white shadow-sm border' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <span>Board</span>
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded ${viewMode === 'calendar' ? 'bg-white shadow-sm border' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <span>Calendar</span>
          </button>
          <button 
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded ${viewMode === 'dashboard' ? 'bg-white shadow-sm border' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setViewMode('files')}
            className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded ${viewMode === 'files' ? 'bg-white shadow-sm border' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <span>Files</span>
          </button>
          
          <div className="h-4 border-l border-gray-300 mx-2"></div>
          
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            <PlusIcon className="w-4 h-4" />
            <span>Add task</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            <FilterIcon className="w-4 h-4" />
            <span>Filter</span>
          </button>
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            <SortIcon className="w-4 h-4" />
            <span>Sort</span>
          </button>
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded bg-white border">
            <GroupIcon className="w-4 h-4" />
            <span>Groups: 1</span>
            <XIcon className="w-3 h-3" />
          </button>
          <button className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded">
            <span>Options</span>
          </button>
          <button className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Search tasks">
            <SearchIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-4 py-2 border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <div className="flex-1 min-w-0">Name</div>
        <div className="w-24 text-center">Due date</div>
        <div className="w-24 text-center">Collaborators</div>
        <div className="w-24 text-center">Projects</div>
        <div className="w-24 text-center">Task visibility</div>
        <div className="w-8"></div>
      </div>

      {/* Task Groups */}
      <div className="flex-1 overflow-y-auto">
        {taskGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {/* Group Header */}
            <div 
              className="flex items-center px-4 py-2 bg-gray-50 border-t border-gray-200 cursor-pointer hover:bg-gray-100"
              onClick={() => toggleGroup(group.title)}
            >
              {group.isCollapsed ? (
                <ChevronRightIcon className="w-4 h-4 text-gray-400 mr-2" />
              ) : (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 mr-2" />
              )}
              <span className="font-medium text-gray-900">{group.title} ({group.count})</span>
            </div>

            {/* Group Tasks */}
            {!group.isCollapsed && (
              <div>
                {group.tasks.map((task, index) => {
                  const assignee = task.assigneeId ? getUserById(task.assigneeId) : null;
                  const project = getProjectById(task.projectId);

                  return (
                    <div 
                      key={task.id}
                      className="flex items-center px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer group"
                      onClick={() => handleTaskClick(task)}
                    >
                      {/* Task Name and Status */}
                      <div className="flex-1 min-w-0 flex items-center space-x-3">
                        {getStatusIcon(task.status)}
                        <span className={`font-medium ${task.status === 'Done' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {task.title}
                        </span>
                        {task.description && (
                          <span className="text-xs text-gray-500 truncate">
                            {task.description.length > 50 ? `${task.description.substring(0, 50)}...` : task.description}
                          </span>
                        )}
                      </div>

                      {/* Due Date */}
                      <div className="w-24 text-center">
                        {task.dueDate && (
                          <span className={`text-sm ${getDueDateColor(task.dueDate)}`}>
                            {formatDueDate(task.dueDate)}
                          </span>
                        )}
                      </div>

                      {/* Collaborators */}
                      <div className="w-24 text-center">
                        {assignee && (
                          <div className="flex items-center justify-center">
                            <div className={`w-6 h-6 rounded-full bg-${project?.color || 'gray-500'} flex items-center justify-center text-white text-xs font-medium`}>
                              {assignee.displayName.charAt(0)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Projects */}
                      <div className="w-24 text-center">
                        {project && (
                          <div className="flex items-center justify-center space-x-1">
                            <div className={`w-2 h-2 rounded-full ${project.color}`}></div>
                            <span className="text-sm text-gray-600 truncate">{project.name}</span>
                          </div>
                        )}
                      </div>

                      {/* Task Visibility */}
                      <div className="w-24 text-center">
                        <div className="flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-500 ml-1">Only me</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="w-8 text-center">
                        <button className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600" title="Add subtask">
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Task Row */}
                <div className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300"></div>
                    <span className="text-sm">Add task...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <CheckCircleIcon className="w-12 h-12 mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No tasks found</h3>
            <p className="text-sm">Get started by creating your first task!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTasksPage;
