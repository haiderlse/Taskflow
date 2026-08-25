import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, Task, User, ColumnId, Priority, TaskFilterOptions } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import TaskModal from './TaskModal';
import CalendarView from './CalendarView';
import TimelineView from './TimelineView';
import DependencyGraph from './DependencyGraph';
import KanbanAnalytics from './KanbanAnalytics';
import GanttView from './GanttView';
import ProjectNotesView from './ProjectNotesView';
import WorkloadView from './WorkloadView';
import TimeTracking from './TimeTracking';
import BulkActionsBar from './BulkActionsBar';
import { TaskContextMenu } from './ContextMenu';
import { TaskIndicators, TaskDependencyIndicators } from './VisualIndicators';
import TaskFilterBar from './TaskFilterBar';
import TimesheetsModal from './TimesheetsModal';
import AutomationRulesModal from './AutomationRulesModal';
import ProjectFormModal from './ProjectFormModal';
import { filterAndSortTasks, DEFAULT_FILTER_OPTIONS } from '../utils/filterUtils';
import {
  ListIcon,
  BoardIcon,
  TimelineIcon,
  DashboardIcon,
  GanttIcon,
  CalendarIcon,
  NoteIcon,
  WorkloadIcon,
  NetworkIcon,
  PlusIcon,
  StarIcon,
  ChevronDownIcon,
  ShareIcon,
  CustomizeIcon,
  UserIcon as AssigneeIcon,
  CheckCircleIcon,
  ClockIcon,
  DiamondIcon,
  BoltIcon,
  FileTextIcon,
  TagIcon
} from './icons';

// --- Board View Component ---
interface ProjectBoardViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskCreate: (title: string, projectId: string, status: ColumnId) => Promise<void>;
}

const ProjectBoardView: React.FC<ProjectBoardViewProps> = ({ 
  project, 
  tasks, 
  users, 
  onTaskClick, 
  onTaskUpdate, 
  onTaskCreate 
}) => {
  const [newTaskInputs, setNewTaskInputs] = useState<Record<ColumnId, boolean>>({
    'To Do': false,
    'In Progress': false,
    'Done': false
  });
  const [newTaskTitles, setNewTaskTitles] = useState<Record<ColumnId, string>>({
    'To Do': '',
    'In Progress': '',
    'Done': ''
  });
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null);

  const columns: ColumnId[] = ['To Do', 'In Progress', 'Done'];
  
  const getTasksForColumn = (column: ColumnId) => {
    return tasks.filter(task => task.status === column);
  };

  const getAssignee = (assigneeId: string | null) => {
    return users.find(u => u.uid === assigneeId);
  };

  const handleCreateTask = async (column: ColumnId) => {
    const title = newTaskTitles[column].trim();
    if (!title) return;

    try {
      await onTaskCreate(title, project.id, column);
      setNewTaskTitles(prev => ({ ...prev, [column]: '' }));
      setNewTaskInputs(prev => ({ ...prev, [column]: false }));
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>, column: ColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== column) {
      setDragOverColumn(column);
    }
  };

  const handleDragLeaveColumn = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDropOnColumn = async (e: React.DragEvent<HTMLDivElement>, column: ColumnId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDragOverColumn(null);
    setDraggedTaskId(null);

    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== column) {
        onTaskUpdate(taskId, { status: column });
      }
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-blue-500';
      case 'low': return 'border-l-slate-400';
      default: return 'border-l-slate-300 dark:border-l-slate-600';
    }
  };

  const formatTimeTracked = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleTaskSelect = (taskId: string, selected: boolean) => {
    setSelectedTasks(prev => 
      selected 
        ? [...prev, taskId]
        : prev.filter(id => id !== taskId)
    );
  };

  const handleSelectAll = (columnTasks: Task[], selectAll: boolean) => {
    const taskIds = columnTasks.map(t => t.id);
    setSelectedTasks(prev => 
      selectAll 
        ? [...new Set([...prev, ...taskIds])]
        : prev.filter(id => !taskIds.includes(id))
    );
  };

  const handleTaskContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  const handleBulkDeleteTasks = async (taskIds: string[]) => {
    try {
      for (const taskId of taskIds) {
        await enhancedApi.deleteTask(taskId);
      }
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to delete tasks:', error);
    }
  };

  const handleBulkAssignTasks = async (taskIds: string[], assigneeId: string) => {
    try {
      for (const taskId of taskIds) {
        await onTaskUpdate(taskId, { assigneeId });
      }
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to assign tasks:', error);
    }
  };

  const handleBulkUpdateTaskStatus = async (taskIds: string[], status: string) => {
    try {
      for (const taskId of taskIds) {
        await onTaskUpdate(taskId, { status: status as ColumnId });
      }
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleBulkUpdateTaskPriority = async (taskIds: string[], priority: string) => {
    try {
      for (const taskId of taskIds) {
        await onTaskUpdate(taskId, { priority: priority as any });
      }
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to update task priority:', error);
    }
  };

  const handleBulkMoveTasksToProject = async (taskIds: string[], targetProjectId: string) => {
    try {
      for (const taskId of taskIds) {
        await onTaskUpdate(taskId, { projectId: targetProjectId });
      }
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to move tasks:', error);
    }
  };

  return (
    <>
      <div className="flex h-full gap-4 p-4 overflow-x-auto bg-slate-100/60 dark:bg-slate-950 transition-colors">
        {columns.map(column => {
          const columnTasks = getTasksForColumn(column);
          const allColumnTasksSelected = columnTasks.length > 0 && columnTasks.every(t => selectedTasks.includes(t.id));
          const someColumnTasksSelected = columnTasks.some(t => selectedTasks.includes(t.id));
          const isOver = dragOverColumn === column;
          
          return (
            <div 
              key={column} 
              onDragOver={(e) => handleDragOverColumn(e, column)}
              onDragLeave={handleDragLeaveColumn}
              onDrop={(e) => handleDropOnColumn(e, column)}
              className={`flex-shrink-0 w-80 flex flex-col bg-gray-50 dark:bg-slate-900 rounded-2xl border transition-all ${
                isOver 
                  ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-950/30' 
                  : 'border-gray-200 dark:border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {showBulkActions && (
                      <input
                        type="checkbox"
                        checked={allColumnTasksSelected}
                        ref={input => {
                          if (input) input.indeterminate = someColumnTasksSelected && !allColumnTasksSelected;
                        }}
                        onChange={(e) => handleSelectAll(columnTasks, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded"
                      />
                    )}
                    <h3 className="font-bold text-sm text-gray-900 dark:text-slate-100">{column}</h3>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300">
                      {columnTasks.length}
                    </span>
                    <button
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className={`p-1 rounded-lg ${showBulkActions ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-400'}`}
                      title="Toggle bulk actions"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setNewTaskInputs(prev => ({ ...prev, [column]: true }))}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-lg text-gray-400 dark:hover:text-slate-200"
                      title="Add task to column"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks List / Drop Area */}
              <div className="p-2 space-y-2 flex-1 max-h-[calc(100vh-250px)] overflow-y-auto">
                {isOver && (
                  <div className="p-2.5 border-2 border-dashed border-blue-400 bg-blue-50/70 dark:bg-blue-950/60 rounded-xl text-center text-xs font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                    Drop to move to {column}
                  </div>
                )}

                {columnTasks.map(task => {
                  const assignee = getAssignee(task.assigneeId);
                  const isSelected = selectedTasks.includes(task.id);
                  const isDragging = draggedTaskId === task.id;
                  const completedSubtasks = (task.subtaskItems || []).filter(s => s.isCompleted).length;
                  const totalSubtasks = (task.subtaskItems || []).length;
                  
                  return (
                    <div
                      key={task.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onTaskClick(task)}
                      onContextMenu={(e) => handleTaskContextMenu(e, task)}
                      className={`bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-md transition-all select-none ${
                        isSelected ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-slate-750' : ''
                      } ${isDragging ? 'opacity-40 scale-95 ring-2 ring-blue-400' : ''} ${getPriorityColor(task.priority)} border-l-4`}
                    >
                      {showBulkActions && (
                        <div className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleTaskSelect(task.id, e.target.checked);
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded mr-2"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="flex items-center space-x-1.5 flex-1 min-w-0">
                          {task.isMilestone && (
                            <span className="shrink-0 text-emerald-500" title="Milestone">
                              <DiamondIcon className="w-3.5 h-3.5 fill-emerald-500/20" />
                            </span>
                          )}
                          <h4 className="text-xs font-bold text-gray-900 dark:text-slate-100 line-clamp-2">
                            {task.title}
                          </h4>
                        </div>
                        {task.priority && task.priority !== 'medium' && (
                          <div className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black flex-shrink-0 uppercase ${
                            task.priority === 'critical' ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300' :
                            task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300' :
                            'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                          }`}>
                            {task.priority}
                          </div>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-[11px] text-gray-500 dark:text-slate-400 mb-2 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {/* Subtasks Progress */}
                      {totalSubtasks > 0 && (
                        <div className="mb-2 flex items-center space-x-1.5 text-[10px] text-gray-500 dark:text-slate-400 font-semibold">
                          <span className="text-blue-600 dark:text-blue-400">✓ {completedSubtasks}/{totalSubtasks} subtasks</span>
                          <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-1">
                            <div
                              className="bg-blue-600 h-1 rounded-full"
                              style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="mb-2">
                        <TaskIndicators task={task} allTasks={tasks} compact={true} />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-slate-400 pt-1 border-t border-gray-100 dark:border-slate-700/60">
                        <div className="flex items-center space-x-2">
                          {task.dueDate && (
                            <div className="flex items-center space-x-1">
                              <span className="text-[10px]">📅</span>
                              <span className={new Date(task.dueDate) < new Date() && task.status !== 'Done' ? 'text-red-500 font-bold' : ''}>
                                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                          {task.timeTracked > 0 && (
                            <div className="flex items-center space-x-1 font-mono">
                              <ClockIcon className="w-3 h-3 text-blue-500" />
                              <span>{formatTimeTracked(task.timeTracked)}</span>
                            </div>
                          )}
                        </div>

                        {assignee && (
                          <div
                            title={assignee.displayName}
                            className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-[9px] shadow-2xs"
                          >
                            {assignee.displayName.charAt(0)}
                          </div>
                        )}
                      </div>

                      {task.tags && task.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {columnTasks.length === 0 && !isOver && (
                  <div className="p-6 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-center text-xs text-gray-400 dark:text-slate-500">
                    No tasks in {column}
                  </div>
                )}

                {/* Add Task Input */}
                {newTaskInputs[column] && (
                  <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                    <input
                      type="text"
                      placeholder="Enter task title..."
                      value={newTaskTitles[column]}
                      onChange={(e) => setNewTaskTitles(prev => ({ ...prev, [column]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateTask(column);
                        } else if (e.key === 'Escape') {
                          setNewTaskInputs(prev => ({ ...prev, [column]: false }));
                          setNewTaskTitles(prev => ({ ...prev, [column]: '' }));
                        }
                      }}
                      onBlur={() => {
                        if (newTaskTitles[column].trim()) {
                          handleCreateTask(column);
                        } else {
                          setNewTaskInputs(prev => ({ ...prev, [column]: false }));
                        }
                      }}
                      className="w-full text-xs font-medium border-0 focus:ring-0 focus:outline-none bg-transparent text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
                      autoFocus
                    />
                  </div>
                )}

                {/* Add Task Button */}
                {!newTaskInputs[column] && (
                  <button
                    onClick={() => setNewTaskInputs(prev => ({ ...prev, [column]: true }))}
                    className="w-full p-2.5 text-left text-xs font-semibold text-gray-500 dark:text-slate-400 hover:bg-gray-200/70 dark:hover:bg-slate-800/80 rounded-xl transition-colors flex items-center space-x-1.5"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Add task</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={(t) => onTaskClick(t)}
          onDelete={async (id) => { await enhancedApi.deleteTask(id); }}
          onDuplicate={async (t) => { await onTaskCreate(`${t.title} (Copy)`, t.projectId, t.status); }}
          onAssign={(id) => { onTaskUpdate(id, { assigneeId: users[0]?.uid || null }); }}
          onChangeStatus={(id, s) => { onTaskUpdate(id, { status: s as ColumnId }); }}
          onChangePriority={(id, p) => { onTaskUpdate(id, { priority: p as any }); }}
        />
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedTasks={selectedTasks}
        selectedProjects={[]}
        onClearSelection={() => setSelectedTasks([])}
        onBulkDeleteTasks={handleBulkDeleteTasks}
        onBulkDeleteProjects={() => {}}
        onBulkAssignTasks={handleBulkAssignTasks}
        onBulkUpdateTaskStatus={handleBulkUpdateTaskStatus}
        onBulkUpdateTaskPriority={handleBulkUpdateTaskPriority}
        onBulkMoveTasksToProject={handleBulkMoveTasksToProject}
        users={users}
        projects={[project]}
      />
    </>
  );
};

// --- List View Component ---
interface ProjectListViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskCreate: (title: string, projectId: string, status: ColumnId) => Promise<void>;
  groupBy?: TaskFilterOptions['groupBy'];
}

const ProjectListView: React.FC<ProjectListViewProps> = ({ 
  tasks, 
  users, 
  project, 
  onTaskClick, 
  onTaskUpdate, 
  onTaskCreate,
  groupBy = 'none'
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleTaskCreate = useCallback(async () => {
    if (newTaskTitle.trim() === '') return;
    try {
      await onTaskCreate(newTaskTitle.trim(), project.id, 'To Do');
      setNewTaskTitle('');
      setIsAddingTask(false);
    } catch (error) {
      console.error("Failed to create task from list view:", error);
    }
  }, [project.id, newTaskTitle, onTaskCreate]);

  const getAssignee = useCallback((assigneeId: string | null) => {
    return users.find(u => u.uid === assigneeId);
  }, [users]);

  // Grouping partitions
  const taskGroups = useMemo(() => {
    if (groupBy === 'status') {
      return [
        { key: 'To Do', title: 'To Do', tasks: tasks.filter(t => t.status === 'To Do') },
        { key: 'In Progress', title: 'In Progress', tasks: tasks.filter(t => t.status === 'In Progress') },
        { key: 'Done', title: 'Done', tasks: tasks.filter(t => t.status === 'Done') }
      ];
    }
    if (groupBy === 'priority') {
      return [
        { key: 'critical', title: '🔥 Critical Priority', tasks: tasks.filter(t => t.priority === 'critical') },
        { key: 'high', title: '⚡ High Priority', tasks: tasks.filter(t => t.priority === 'high') },
        { key: 'medium', title: '📌 Medium Priority', tasks: tasks.filter(t => t.priority === 'medium') },
        { key: 'low', title: '🌱 Low Priority', tasks: tasks.filter(t => !t.priority || t.priority === 'low') }
      ];
    }
    if (groupBy === 'assignee') {
      const groups = users.map(u => ({
        key: u.uid,
        title: u.displayName,
        tasks: tasks.filter(t => t.assigneeId === u.uid)
      }));
      groups.push({
        key: 'unassigned',
        title: 'Unassigned',
        tasks: tasks.filter(t => !t.assigneeId)
      });
      return groups;
    }

    // Default: Incomplete vs Completed
    return [
      { key: 'active', title: 'Active Tasks', tasks: tasks.filter(t => t.status !== 'Done') },
      { key: 'completed', title: 'Completed Tasks', tasks: tasks.filter(t => t.status === 'Done') }
    ];
  }, [tasks, groupBy, users]);

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100">
      <div className="p-3">
        {/* Quick Add Row Button */}
        <div className="flex items-center space-x-2 mb-3">
          <button 
            onClick={() => setIsAddingTask(true)} 
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5"/>
            <span>Add task</span>
          </button>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-[minmax(0,_1fr)_140px_130px_100px_100px] gap-4 text-[11px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-slate-800 pb-2 px-3 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <span className="pl-7">Task Name</span>
          <span>Assignee</span>
          <span>Due Date</span>
          <span>Priority</span>
          <span>Time Logged</span>
        </div>

        {/* Inline Task Adder */}
        {isAddingTask && (
          <div className="grid grid-cols-[minmax(0,_1fr)_140px_130px_100px_100px] gap-4 items-center px-3 py-2 bg-blue-50/50 dark:bg-slate-800/60 rounded-xl border border-blue-200 dark:border-blue-800 my-1">
            <div className="flex items-center space-x-2">
              <span className="w-4 h-4 rounded-full border border-dashed border-gray-400 text-center text-[10px] text-gray-400" />
              <input 
                type="text"
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTaskCreate()}
                onBlur={() => { if(newTaskTitle) { handleTaskCreate() } else { setIsAddingTask(false) } }}
                placeholder="Write a task name and press Enter..."
                className="w-full text-xs font-semibold focus:outline-none bg-transparent text-gray-900 dark:text-slate-100 placeholder-gray-400"
              />
            </div>
            <span className="text-[11px] text-gray-400">Unassigned</span>
            <span className="text-[11px] text-gray-400">No due date</span>
            <span className="text-[11px] text-gray-400">Medium</span>
            <span className="text-[11px] text-gray-400">0m</span>
          </div>
        )}

        {/* Grouped Task Rows */}
        <div className="space-y-4 mt-2">
          {taskGroups.map(group => {
            if (group.tasks.length === 0 && groupBy !== 'status') return null;

            return (
              <div key={group.key} className="space-y-1">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/70 dark:bg-slate-800/40 rounded-lg text-xs font-bold text-gray-700 dark:text-slate-300">
                  <span>{group.title} ({group.tasks.length})</span>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {group.tasks.map(task => {
                    const assignee = getAssignee(task.assigneeId);
                    const isDone = task.status === 'Done';

                    return (
                      <div 
                        key={task.id} 
                        onClick={() => onTaskClick(task)} 
                        className="grid grid-cols-[minmax(0,_1fr)_140px_130px_100px_100px] gap-4 items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/60 px-3 py-2 transition-colors rounded-lg"
                      >
                        {/* Task Title & Milestone & Blockers */}
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskUpdate(task.id, { status: isDone ? 'To Do' : 'Done' });
                            }} 
                            className="flex-shrink-0 p-0.5 text-gray-300 dark:text-slate-600 hover:text-emerald-500 transition-colors"
                          >
                            <CheckCircleIcon className={`w-4 h-4 ${isDone ? 'text-emerald-500' : ''}`} />
                          </button>

                          {task.isMilestone && (
                            <span title="Milestone">
                              <DiamondIcon className="w-3.5 h-3.5 text-emerald-500" />
                            </span>
                          )}

                          <span className={`truncate text-xs font-semibold ${isDone ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-white'}`}>
                            {task.title}
                          </span>

                          <TaskDependencyIndicators task={task} allTasks={tasks} />
                        </div>

                        {/* Assignee */}
                        <div className="flex items-center space-x-2">
                          {assignee ? (
                            <>
                              <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-[9px] shrink-0">
                                {assignee.displayName.charAt(0)}
                              </div>
                              <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{assignee.displayName}</span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Unassigned</span>
                          )}
                        </div>

                        {/* Due Date */}
                        <div className="text-xs">
                          {task.dueDate ? (
                            <span className={new Date(task.dueDate) < new Date() && !isDone ? 'text-red-500 font-bold' : 'text-gray-600 dark:text-slate-400'}>
                              {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>

                        {/* Priority */}
                        <div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                            task.priority === 'critical' ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' :
                            task.priority === 'high' ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300' :
                            task.priority === 'medium' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                            'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400'
                          }`}>
                            {task.priority || 'medium'}
                          </span>
                        </div>

                        {/* Time Tracked */}
                        <div className="flex items-center space-x-1 text-xs font-mono text-gray-600 dark:text-slate-400">
                          {task.timeTracked > 0 ? (
                            <>
                              <ClockIcon className="w-3 h-3 text-amber-500" />
                              <span>{Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m</span>
                            </>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Main Project View Component ---
interface ProjectViewProps {
  project: Project;
  currentUser: User;
  users: User[];
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project, currentUser, users }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('List');
  const [filterOptions, setFilterOptions] = useState<TaskFilterOptions>(DEFAULT_FILTER_OPTIONS);

  // Modals
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    enhancedApi.getTasksForProject(project.id)
      .then(fetchedTasks => {
        setTasks(fetchedTasks.sort((a, b) => a.order - b.order));
      })
      .finally(() => setLoading(false));

    const unsubscribe = enhancedApi.subscribeToTasks(project.id, (updatedTasks) => {
      setTasks(updatedTasks.sort((a, b) => a.order - b.order));
    });

    return () => unsubscribe();
  }, [project.id]);

  const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      await enhancedApi.updateTask(taskId, updates);
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  }, [selectedTask]);

  const handleTaskCreate = useCallback(async (title: string, projectId: string, status: ColumnId) => {
    try {
      await enhancedApi.createTask(title, projectId, status);
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  }, []);

  const handleFormTaskCreated = async (taskData: any) => {
    try {
      await enhancedApi.createTask(taskData.title, taskData.projectId, taskData.status || 'To Do', taskData);
    } catch (e) {
      console.error("Failed to create form task:", e);
    }
  };

  // Compute filtered tasks
  const filteredTasks = useMemo(() => {
    return filterAndSortTasks(tasks, filterOptions, currentUser?.uid);
  }, [tasks, filterOptions, currentUser]);

  // Extract all unique tags
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => (t.tags || []).forEach(tag => set.add(tag)));
    return Array.from(set);
  }, [tasks]);

  const handleExportCsv = () => {
    const headers = ['Title', 'Status', 'Priority', 'Assignee', 'Due Date', 'Time Tracked (mins)', 'Milestone'];
    const rows = filteredTasks.map(t => {
      const u = users.find(x => x.uid === t.assigneeId);
      return [
        `"${t.title.replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        `"${u?.displayName || 'Unassigned'}"`,
        t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
        t.timeTracked || 0,
        t.isMilestone ? 'Yes' : 'No'
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${project.name.toLowerCase().replace(/\s+/g, '-')}-tasks.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const NavTab = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center space-x-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors ${active ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' : 'text-gray-500 dark:text-slate-400 border-transparent hover:text-gray-900 dark:hover:text-slate-200'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );

  const renderActiveView = () => {
    if (loading) {
      return <div className="text-center p-12 text-gray-500 dark:text-slate-400">Loading project data...</div>;
    }
    
    switch (activeTab) {
      case 'List':
        return (
          <ProjectListView 
            project={project}
            tasks={filteredTasks}
            users={users}
            onTaskClick={setSelectedTask}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
            groupBy={filterOptions.groupBy}
          />
        );
      case 'Board': 
        return (
          <ProjectBoardView 
            project={project}
            tasks={filteredTasks}
            users={users}
            onTaskClick={setSelectedTask}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
          />
        );
      case 'Timeline': 
        return (
          <TimelineView 
            project={project}
            currentUser={currentUser}
            users={users}
          />
        );
      case 'Calendar': 
        return (
          <CalendarView 
            project={project}
            currentUser={currentUser}
            users={users}
          />
        );
      case 'Graph':
        return (
          <DependencyGraph
            project={project}
            tasks={filteredTasks}
            users={users}
            currentUser={currentUser}
            onTaskClick={setSelectedTask}
            onTaskUpdate={handleTaskUpdate}
          />
        );
      case 'Dashboard': 
        return (
          <KanbanAnalytics
            project={project}
            tasks={tasks}
            users={users}
            currentUser={currentUser}
            onTaskClick={setSelectedTask}
          />
        );
      case 'Gantt': 
        return (
          <GanttView
            project={project}
            tasks={filteredTasks}
            users={users}
            currentUser={currentUser}
            onTaskClick={setSelectedTask}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
          />
        );
      case 'Note': 
        return (
          <ProjectNotesView
            project={project}
            currentUser={currentUser}
            users={users}
            tasks={tasks}
          />
        );
      case 'Workload': 
        return (
          <WorkloadView
            project={project}
            tasks={tasks}
            users={users}
            currentUser={currentUser}
            onTaskClick={setSelectedTask}
            onTaskUpdate={handleTaskUpdate}
          />
        );
      default:
        return (
          <ProjectListView
            project={project}
            tasks={filteredTasks}
            users={users}
            onTaskClick={setSelectedTask}
            onTaskUpdate={handleTaskUpdate}
            onTaskCreate={handleTaskCreate}
            groupBy={filterOptions.groupBy}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 transition-colors">
      {/* Project Header */}
      <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 flex-shrink-0 bg-white dark:bg-slate-900">
        <div className="flex items-center space-x-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${project.color || 'bg-blue-600'} text-white shadow-xs`}>
            <ListIcon className="w-5 h-5"/>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black text-gray-900 dark:text-white">{project.name}</h1>
              <button className="text-gray-400 hover:text-amber-500 transition-colors">
                <StarIcon className="w-4 h-4"/>
              </button>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              {tasks.length} total tasks • {tasks.filter(t => t.status === 'Done').length} completed
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Asana Tools Links */}
          <button
            onClick={() => setShowRulesModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors shadow-xs"
            title="Workflow Automations"
          >
            <BoltIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Automate</span>
          </button>

          <button
            onClick={() => setShowFormModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors shadow-xs"
            title="Intake Form"
          >
            <FileTextIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Form</span>
          </button>

          <button
            onClick={() => setShowTimesheetModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 text-xs font-bold rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors shadow-xs"
            title="Project Timesheets"
          >
            <ClockIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Timesheet</span>
          </button>

          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Project link copied to clipboard!");
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <ShareIcon className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center justify-between px-4 border-b border-gray-200 dark:border-slate-800 flex-shrink-0 bg-gray-50/50 dark:bg-slate-900/50">
        <nav className="flex items-center space-x-1 overflow-x-auto -mb-px">
          <NavTab icon={<ListIcon className="w-3.5 h-3.5"/>} label="List" active={activeTab === 'List'} onClick={() => setActiveTab('List')} />
          <NavTab icon={<BoardIcon className="w-3.5 h-3.5"/>} label="Board" active={activeTab === 'Board'} onClick={() => setActiveTab('Board')} />
          <NavTab icon={<TimelineIcon className="w-3.5 h-3.5"/>} label="Timeline" active={activeTab === 'Timeline'} onClick={() => setActiveTab('Timeline')} />
          <NavTab icon={<NetworkIcon className="w-3.5 h-3.5"/>} label="Dependencies" active={activeTab === 'Graph'} onClick={() => setActiveTab('Graph')} />
          <NavTab icon={<DashboardIcon className="w-3.5 h-3.5"/>} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
          <NavTab icon={<GanttIcon className="w-3.5 h-3.5"/>} label="Gantt" active={activeTab === 'Gantt'} onClick={() => setActiveTab('Gantt')} />
          <NavTab icon={<CalendarIcon className="w-3.5 h-3.5"/>} label="Calendar" active={activeTab === 'Calendar'} onClick={() => setActiveTab('Calendar')} />
          <NavTab icon={<WorkloadIcon className="w-3.5 h-3.5"/>} label="Workload" active={activeTab === 'Workload'} onClick={() => setActiveTab('Workload')} />
          <NavTab icon={<NoteIcon className="w-3.5 h-3.5"/>} label="Project Notes" active={activeTab === 'Note'} onClick={() => setActiveTab('Note')} />
        </nav>
      </div>

      {/* Full Task Filter & Controls Bar */}
      <TaskFilterBar
        filters={filterOptions}
        onFilterChange={setFilterOptions}
        users={users}
        availableTags={availableTags}
        currentUser={currentUser}
        totalTaskCount={tasks.length}
        filteredTaskCount={filteredTasks.length}
        onExportCsv={handleExportCsv}
        onOpenRules={() => setShowRulesModal(true)}
        onOpenForms={() => setShowFormModal(true)}
        onOpenTimesheet={() => setShowTimesheetModal(true)}
      />
      
      {/* Active Main View Area */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {renderActiveView()}
      </main>

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          users={users}
          currentUser={currentUser}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleTaskUpdate}
          onNavigateToTask={(targetTask) => setSelectedTask(targetTask)}
        />
      )}

      {/* Timesheets Modal */}
      <TimesheetsModal
        isOpen={showTimesheetModal}
        onClose={() => setShowTimesheetModal(false)}
        tasks={tasks}
        users={users}
        currentUser={currentUser}
        selectedProjectId={project.id}
      />

      {/* Automations & Rules Modal */}
      <AutomationRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        project={project}
        users={users}
        currentUser={currentUser}
      />

      {/* Intake Forms Modal */}
      <ProjectFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        project={project}
        users={users}
        currentUser={currentUser}
        onTaskCreated={handleFormTaskCreated}
      />
    </div>
  );
};

export default ProjectView;
