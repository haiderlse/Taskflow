import React, { useState, useEffect, useCallback } from 'react';
import { Project, Task, User, ColumnId } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import TaskModal from './TaskModal';
import CalendarView from './CalendarView';
import TimelineView from './TimelineView';
import TimeTracking from './TimeTracking';
import BulkActionsBar from './BulkActionsBar';
import { TaskContextMenu } from './ContextMenu';
import { TaskIndicators } from './VisualIndicators';
import {
  ListIcon,
  BoardIcon,
  TimelineIcon,
  DashboardIcon,
  GanttIcon,
  CalendarIcon,
  NoteIcon,
  WorkloadIcon,
  PlusIcon,
  StarIcon,
  ChevronDownIcon,
  ShareIcon,
  CustomizeIcon,
  FilterIcon,
  SortIcon,
  GroupIcon,
  OptionsIcon,
  SearchIcon,
  UserIcon as AssigneeIcon,
  CheckCircleIcon,
  ClockIcon
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

  const columns: ColumnId[] = ['To Do', 'In Progress', 'Done'];
  
  const getTasksForColumn = (column: ColumnId) => {
    return tasks.filter(task => task.status === column).sort((a, b) => a.order - b.order);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-blue-500';
      case 'low': return 'border-l-gray-500';
      default: return 'border-l-gray-500';
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

  const handleBulkMoveTasksToProject = async (taskIds: string[], projectId: string) => {
    try {
      for (const taskId of taskIds) {
        await onTaskUpdate(taskId, { projectId });
      }
      setSelectedTasks([]);
    } catch (error) {
      console.error('Failed to move tasks:', error);
    }
  };

  const handleTaskEdit = (task: Task) => {
    onTaskClick(task);
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      await enhancedApi.deleteTask(taskId);
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleTaskDuplicate = async (task: Task) => {
    try {
      await onTaskCreate(`${task.title} (Copy)`, task.projectId, task.status);
    } catch (error) {
      console.error('Failed to duplicate task:', error);
    }
  };

  const handleTaskAssign = (taskId: string) => {
    // Open assign dialog - simplified for demo
    const assigneeId = users.length > 0 ? users[0].uid : '';
    onTaskUpdate(taskId, { assigneeId });
  };

  const handleTaskChangeStatus = (taskId: string, status: string) => {
    onTaskUpdate(taskId, { status: status as ColumnId });
  };

  const handleTaskChangePriority = (taskId: string, priority: string) => {
    onTaskUpdate(taskId, { priority: priority as any });
  };

  return (
    <>
      <div className="flex h-full gap-4 p-4 overflow-x-auto">
        {columns.map(column => {
          const columnTasks = getTasksForColumn(column);
          const allColumnTasksSelected = columnTasks.length > 0 && columnTasks.every(t => selectedTasks.includes(t.id));
          const someColumnTasksSelected = columnTasks.some(t => selectedTasks.includes(t.id));
          
          return (
            <div key={column} className="flex-shrink-0 w-80 bg-gray-50 rounded-lg">
              {/* Column Header */}
              <div className="p-4 border-b border-gray-200">
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
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    )}
                    <h3 className="font-semibold text-gray-900">{column}</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{columnTasks.length}</span>
                    <button
                      onClick={() => setShowBulkActions(!showBulkActions)}
                      className={`p-1 rounded ${showBulkActions ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200'}`}
                      title="Toggle bulk actions"
                    >
                      <CheckCircleIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setNewTaskInputs(prev => ({ ...prev, [column]: true }))}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <PlusIcon className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tasks */}
              <div className="p-2 space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {columnTasks.map(task => {
                  const assignee = getAssignee(task.assigneeId);
                  const isSelected = selectedTasks.includes(task.id);
                  
                  return (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task)}
                      onContextMenu={(e) => handleTaskContextMenu(e, task)}
                      className={`bg-white p-3 rounded-lg border border-gray-200 cursor-pointer hover:shadow-md transition-all ${
                        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      } ${getPriorityColor(task.priority)} border-l-4`}
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
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">
                          {task.title}
                        </h4>
                        {task.priority && task.priority !== 'medium' && (
                          <div className={`ml-2 px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                            task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                            task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {task.priority}
                          </div>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      <div className="mb-2">
                        <TaskIndicators task={task} compact={true} />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center space-x-2">
                          {task.dueDate && (
                            <div className="flex items-center space-x-1">
                              <CalendarIcon className="w-3 h-3" />
                              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                          )}
                          {task.timeTracked > 0 && (
                            <div className="flex items-center space-x-1">
                              <ClockIcon className="w-3 h-3" />
                              <span>{formatTimeTracked(task.timeTracked)}</span>
                            </div>
                          )}
                        </div>

                        {assignee && (
                          <div
                            title={assignee.displayName}
                            className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-800 font-bold text-xs"
                          >
                            {assignee.displayName.charAt(0)}
                          </div>
                        )}
                      </div>

                      {task.tags && task.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {task.tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                          {task.tags.length > 3 && (
                            <span className="text-xs text-gray-500">+{task.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add Task Input */}
                {newTaskInputs[column] && (
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
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
                      className="w-full text-sm border-0 focus:ring-0 focus:outline-none"
                      autoFocus
                    />
                  </div>
                )}

                {/* Add Task Button */}
                {!newTaskInputs[column] && (
                  <button
                    onClick={() => setNewTaskInputs(prev => ({ ...prev, [column]: true }))}
                    className="w-full p-3 text-left text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    + Add a task
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
          onEdit={handleTaskEdit}
          onDelete={handleTaskDelete}
          onDuplicate={handleTaskDuplicate}
          onAssign={handleTaskAssign}
          onChangeStatus={handleTaskChangeStatus}
          onChangePriority={handleTaskChangePriority}
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
}

const ProjectListView: React.FC<ProjectListViewProps> = ({ tasks, users, project, onTaskClick, onTaskUpdate, onTaskCreate }) => {
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

  const sortedTasks = tasks.filter(t => t.status !== 'Done');
  const completedTasks = tasks.filter(t => t.status === 'Done');

  const getAssignee = useCallback((assigneeId: string | null) => {
      return users.find(u => u.uid === assigneeId);
  }, [users]);

  const ToolButton = ({icon, label}: {icon: React.ReactNode, label?: string}) => (
    <button className="flex items-center space-x-1.5 px-2.5 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700">
        {icon}
        {label && <span>{label}</span>}
    </button>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2.5 border-b border-border-color flex-shrink-0 bg-gray-50/50">
          <button onClick={() => setIsAddingTask(true)} className="flex items-center space-x-1 px-2.5 py-1 text-sm font-medium border border-transparent rounded-md hover:bg-gray-200 text-gray-700">
              <PlusIcon className="w-4 h-4"/>
              <span>Add task</span>
          </button>
          <div className="flex items-center space-x-2">
              <ToolButton icon={<FilterIcon className="w-4 h-4"/>} label="Filter" />
              <ToolButton icon={<SortIcon className="w-4 h-4"/>} label="Sort" />
              <ToolButton icon={<GroupIcon className="w-4 h-4"/>} label="Group" />
              <ToolButton icon={<OptionsIcon className="w-4 h-4"/>} label="Options" />
              <ToolButton icon={<SearchIcon className="w-4 h-4"/>} />
          </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
          <div className="p-1">
              <div className="grid grid-cols-[minmax(0,_1fr)_150px_150px_100px_40px] gap-4 text-xs text-subtle-text font-medium border-b pb-2 px-3 sticky top-0 bg-white z-10">
                  <span className="pl-8">Name</span>
                  <span>Assignee</span>
                  <span>Due date</span>
                  <span>Time tracked</span>
                  <button className="text-gray-400 hover:text-dark-text"><PlusIcon className="w-4 h-4"/></button>
              </div>
              
              <div className="divide-y divide-border-color">
                {sortedTasks.map(task => {
                    const assignee = getAssignee(task.assigneeId);
                    return (
                      <div key={task.id} onClick={() => onTaskClick(task)} className="grid grid-cols-[minmax(0,_1fr)_150px_150px_100px_40px] gap-4 items-center group cursor-pointer hover:bg-gray-50 px-3 py-1.5">
                          <div className="flex items-center space-x-3">
                              <button onClick={(e) => {
                                e.stopPropagation();
                                onTaskUpdate(task.id, { status: 'Done' });
                              }} className="flex-shrink-0 p-1 -m-1 group/btn">
                                <CheckCircleIcon className="w-5 h-5 text-gray-300 group-hover/btn:text-green-500 transition-colors"/>
                              </button>
                              <span className="truncate text-sm py-1">{task.title}</span>
                              {task.priority && task.priority !== 'medium' && (
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.priority}
                                </span>
                              )}
                          </div>
                          <div className="flex items-center justify-start">
                              {assignee ? (
                                  <div title={assignee.displayName} className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-primary font-bold text-xs border-2 border-white">
                                      {assignee.displayName.charAt(0)}
                                  </div>
                              ) : <AssigneeIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full"/>}
                          </div>
                          <div>
                              {task.dueDate ? (
                                    <span className="text-sm text-gray-600">{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric' })}</span>
                              ) : <CalendarIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full" />}
                          </div>
                          <div className="flex items-center space-x-1">
                              {task.timeTracked > 0 ? (
                                <div className="flex items-center space-x-1 text-sm text-gray-600">
                                  <ClockIcon className="w-4 h-4" />
                                  <span>{Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m</span>
                                </div>
                              ) : (
                                <ClockIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full" />
                              )}
                          </div>
                          <div></div>
                      </div>
                    )
                })}

                {isAddingTask && (
                <div className="grid grid-cols-[minmax(0,_1fr)_150px_150px_100px_40px] gap-4 items-center px-3 py-1.5">
                      <div className="flex items-center space-x-3">
                        <CheckCircleIcon className="w-5 h-5 text-gray-300 flex-shrink-0"/>
                        <input 
                          type="text"
                          autoFocus
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTaskCreate()}
                          onBlur={() => { if(newTaskTitle) { handleTaskCreate() } else { setIsAddingTask(false) } }}
                          placeholder="Write a task name"
                          className="w-full text-sm focus:outline-none focus:ring-0 border-0 p-1 bg-transparent"
                        />
                      </div>
                  </div>
                )}
              </div>
              {completedTasks.length > 0 && (
                <div className="pt-4">
                    <h4 className="px-3 mb-1 text-sm font-medium text-gray-500">Completed</h4>
                    {completedTasks.map(task => {
                        const assignee = getAssignee(task.assigneeId);
                        return (
                          <div key={task.id} onClick={() => onTaskClick(task)} className="grid grid-cols-[minmax(0,_1fr)_150px_150px_100px_40px] gap-4 items-center group cursor-pointer hover:bg-gray-50 px-3 py-1.5 text-gray-500">
                              <div className="flex items-center space-x-3">
                                  <button onClick={(e) => {
                                      e.stopPropagation();
                                      onTaskUpdate(task.id, { status: 'To Do' });
                                  }} className="flex-shrink-0 p-1 -m-1">
                                      <CheckCircleIcon className="w-5 h-5 text-green-500"/>
                                  </button>
                                  <span className="truncate text-sm py-1 line-through">{task.title}</span>
                              </div>
                              <div className="flex items-center justify-start">
                                  {assignee ? (
                                      <div title={assignee.displayName} className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-primary font-bold text-xs border-2 border-white opacity-70">
                                          {assignee.displayName.charAt(0)}
                                      </div>
                                  ) : <AssigneeIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full"/>}
                              </div>
                              <div>
                                  {task.dueDate ? (
                                        <span className="text-sm line-through">{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric' })}</span>
                                  ) : <CalendarIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full" />}
                              </div>
                              <div className="flex items-center space-x-1">
                                  {task.timeTracked > 0 ? (
                                    <div className="flex items-center space-x-1 text-sm opacity-70">
                                      <ClockIcon className="w-4 h-4" />
                                      <span>{Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m</span>
                                    </div>
                                  ) : (
                                    <ClockIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full" />
                                  )}
                              </div>
                              <div></div>
                          </div>
                        )
                    })}
                </div>
              )}
               <button className="flex items-center space-x-2 text-sm text-gray-500 hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors m-2">
                <PlusIcon className="w-4 h-4"/>
                <span>Add section</span>
              </button>
          </div>
      </div>
    </>
  );
};


// This component has been repurposed to show the Project "List View" inspired by the Asana design.
// The original Kanban board UI has been replaced.

interface ProjectViewProps {
  project: Project;
  currentUser: User;
  users: User[];
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, currentUser, users }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('List');

  useEffect(() => {
    setLoading(true);
    enhancedApi.getTasksForProject(project.id)
      .then(tasks => {
        setTasks(tasks.sort((a, b) => a.order - b.order));
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
        throw error; // Re-throw to be caught by caller
    }
  }, []);

  const NavTab = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center space-x-2 px-2 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-dark-text hover:border-gray-300'}`}>
        {icon}
        <span>{label}</span>
    </button>
  );

  const renderActiveView = () => {
    if (loading) {
        return <div className="text-center p-10">Loading tasks...</div>
    }
    
    switch (activeTab) {
        case 'List':
            return <ProjectListView 
                project={project}
                tasks={tasks}
                users={users}
                onTaskClick={setSelectedTask}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreate}
            />;
        case 'Board': 
            return <ProjectBoardView 
                project={project}
                tasks={tasks}
                users={users}
                onTaskClick={setSelectedTask}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreate}
            />;
        case 'Timeline': 
            return <TimelineView 
                project={project}
                currentUser={currentUser}
                users={users}
            />;
        case 'Calendar': 
            return <CalendarView 
                project={project}
                currentUser={currentUser}
                users={users}
            />;
        case 'Dashboard': return <div className="flex items-center justify-center h-full"><span className="text-gray-500">Dashboard View - Coming Soon</span></div>;
        case 'Gantt': return <div className="flex items-center justify-center h-full"><span className="text-gray-500">Gantt Chart View - Coming Soon</span></div>;
        case 'Note': return <div className="flex items-center justify-center h-full"><span className="text-gray-500">Note View - Coming Soon</span></div>;
        case 'Workload': return <div className="flex items-center justify-center h-full"><span className="text-gray-500">Workload View - Coming Soon</span></div>;
        default:
            return <ProjectListView
                project={project}
                tasks={tasks}
                users={users}
                onTaskClick={setSelectedTask}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreate}
            />;
    }
  };


  return (
    <div className="flex flex-col h-full bg-white text-dark-text">
        {/* Project Header */}
        <header className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
            <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${project.color}`}>
                    <ListIcon className="w-6 h-6 text-white"/>
                </div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <button className="text-gray-400 hover:text-yellow-500"><StarIcon className="w-5 h-5"/></button>
                <button className="text-gray-400 hover:text-dark-text"><ChevronDownIcon className="w-5 h-5"/></button>
            </div>
            <div className="flex items-center space-x-2">
                <div className="flex -space-x-2">
                     <div title={currentUser.displayName} className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white border-2 border-white">
                        {currentUser.displayName.slice(0, 2).toUpperCase()}
                    </div>
                     <div title="Another User" className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold text-white border-2 border-white">
                        RD
                    </div>
                </div>
                <button className="flex items-center space-x-1.5 px-4 py-1.5 text-sm font-semibold border rounded-md bg-primary text-white hover:bg-primary-hover">
                  <ShareIcon className="w-4 h-4" />
                  <span>Share</span>
                </button>
                 <button className="flex items-center space-x-1.5 px-3 py-1.5 text-sm border rounded-md bg-white hover:bg-gray-50 text-gray-700">
                    <CustomizeIcon className="w-4 h-4"/>
                    <span>Customize</span>
                </button>
            </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center justify-between px-4 border-b border-border-color flex-shrink-0">
            <nav className="flex items-center -mb-px">
                <NavTab icon={<ListIcon className="w-4 h-4"/>} label="List" active={activeTab === 'List'} onClick={() => setActiveTab('List')} />
                <NavTab icon={<BoardIcon className="w-4 h-4"/>} label="Board" active={activeTab === 'Board'} onClick={() => setActiveTab('Board')} />
                <NavTab icon={<TimelineIcon className="w-4 h-4"/>} label="Timeline" active={activeTab === 'Timeline'} onClick={() => setActiveTab('Timeline')} />
                <NavTab icon={<DashboardIcon className="w-4 h-4"/>} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
                <NavTab icon={<GanttIcon className="w-4 h-4"/>} label="Gantt" active={activeTab === 'Gantt'} onClick={() => setActiveTab('Gantt')} />
                <NavTab icon={<CalendarIcon className="w-4 h-4"/>} label="Calendar" active={activeTab === 'Calendar'} onClick={() => setActiveTab('Calendar')} />
                <NavTab icon={<NoteIcon className="w-4 h-4"/>} label="Note" active={activeTab === 'Note'} onClick={() => setActiveTab('Note')} />
                <NavTab icon={<WorkloadIcon className="w-4 h-4"/>} label="Workload" active={activeTab === 'Workload'} onClick={() => setActiveTab('Workload')} />
                 <button className="text-gray-400 hover:text-dark-text p-3"><PlusIcon className="w-4 h-4"/></button>
            </nav>
        </div>
        
        <main className="flex-1 flex flex-col overflow-y-auto">
            {renderActiveView()}
        </main>

        {selectedTask && (
            <TaskModal
            task={selectedTask}
            users={users}
            currentUser={currentUser}
            onClose={() => setSelectedTask(null)}
            onUpdateTask={handleTaskUpdate}
            />
        )}
    </div>
  );
};

export default ProjectView;