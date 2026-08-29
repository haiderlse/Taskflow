import React, { useState, useEffect } from 'react';
import { Task, User, Project } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { TimelineIcon, ChevronLeftIcon, ChevronRightIcon, DiamondIcon, LockClosedIcon } from './icons';
import { computeCriticalPath } from '../utils/asanaUtils';
import { TaskModal } from './TaskModal';

interface TimelineViewProps {
  project: Project;
  currentUser: User;
  users: User[];
  onTaskClick?: (task: Task) => void;
}

interface TimelineTask extends Task {
  user?: User;
  startX: number;
  width: number;
  row: number;
  isCritical?: boolean;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ 
  project, 
  currentUser, 
  users, 
  onTaskClick 
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timelineTasks, setTimelineTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('month');
  const [highlightCriticalPath, setHighlightCriticalPath] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    loadTasks();
  }, [project.id]);

  useEffect(() => {
    if (tasks.length > 0) {
      calculateTimeline();
    }
  }, [tasks, startDate, viewMode, highlightCriticalPath]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const projectTasks = await enhancedApi.getTasksForProject(project.id);
      const tasksWithDates = projectTasks.filter(task => task.startDate || task.dueDate);
      setTasks(tasksWithDates);
      
      if (tasksWithDates.length > 0) {
        const earliestDate = tasksWithDates.reduce((earliest, task) => {
          const taskStart = task.startDate || task.dueDate;
          if (!taskStart) return earliest;
          return !earliest || new Date(taskStart) < earliest ? new Date(taskStart) : earliest;
        }, null as Date | null);
        
        if (earliestDate) {
          setStartDate(new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1));
        }
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeline = () => {
    const timelineStart = new Date(startDate);
    const timelineEnd = new Date(startDate);
    
    switch (viewMode) {
      case 'week':
        timelineEnd.setDate(timelineEnd.getDate() + 28); // 4 weeks
        break;
      case 'month':
        timelineEnd.setMonth(timelineEnd.getMonth() + 3); // 3 months
        break;
      case 'quarter':
        timelineEnd.setMonth(timelineEnd.getMonth() + 12); // 12 months
        break;
    }

    const totalDays = Math.max(1, Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
    const dayWidth = 1200 / totalDays;

    const criticalTaskIds = computeCriticalPath(tasks);

    const assignedRows: { [key: number]: { start: Date; end: Date }[] } = {};
    
    const processedTasks: TimelineTask[] = tasks.map(task => {
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
      const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(taskStart.getTime() + 24 * 60 * 60 * 1000);
      
      let row = 0;
      while (assignedRows[row]) {
        const hasOverlap = assignedRows[row].some(existing => 
          (taskStart <= existing.end && taskEnd >= existing.start)
        );
        if (!hasOverlap) break;
        row++;
      }
      
      if (!assignedRows[row]) assignedRows[row] = [];
      assignedRows[row].push({ start: taskStart, end: taskEnd });

      const startX = Math.max(0, (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24) * dayWidth);
      const endX = Math.min(1200, (taskEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24) * dayWidth);
      const width = task.isMilestone ? 28 : Math.max(36, endX - startX);

      return {
        ...task,
        user: users.find(u => u.uid === task.assigneeId),
        startX,
        width,
        row,
        isCritical: criticalTaskIds.has(task.id)
      };
    });

    setTimelineTasks(processedTasks);
  };

  const navigateTime = (direction: 'prev' | 'next') => {
    const newDate = new Date(startDate);
    switch (viewMode) {
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'next' ? 28 : -28));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3));
        break;
      case 'quarter':
        newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 12 : -12));
        break;
    }
    setStartDate(newDate);
  };

  const generateTimeMarkers = () => {
    const markers = [];
    const timelineStart = new Date(startDate);
    const timelineEnd = new Date(startDate);
    
    switch (viewMode) {
      case 'week':
        timelineEnd.setDate(timelineEnd.getDate() + 28);
        for (let date = new Date(timelineStart); date <= timelineEnd; date.setDate(date.getDate() + 7)) {
          const position = ((date.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
          markers.push({
            position,
            label: `${date.getMonth() + 1}/${date.getDate()}`,
            isMonth: false
          });
        }
        break;
      case 'month':
        timelineEnd.setMonth(timelineEnd.getMonth() + 3);
        for (let date = new Date(timelineStart); date <= timelineEnd; date.setMonth(date.getMonth() + 1)) {
          const position = ((date.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
          markers.push({
            position,
            label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            isMonth: true
          });
        }
        break;
      case 'quarter':
        timelineEnd.setMonth(timelineEnd.getMonth() + 12);
        for (let date = new Date(timelineStart); date <= timelineEnd; date.setMonth(date.getMonth() + 3)) {
          const position = ((date.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
          markers.push({
            position,
            label: `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`,
            isMonth: true
          });
        }
        break;
    }
    
    return markers;
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'bg-rose-500';
      case 'high': return 'bg-amber-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-slate-400';
      default: return 'bg-slate-400';
    }
  };

  const getStatusColor = (status: string, isCritical?: boolean) => {
    if (highlightCriticalPath && isCritical) {
      return 'bg-rose-600 dark:bg-rose-700 ring-2 ring-rose-400 dark:ring-rose-300';
    }
    switch (status) {
      case 'Done': return 'bg-emerald-600 dark:bg-emerald-700';
      case 'In Progress': return 'bg-blue-600 dark:bg-blue-700';
      case 'To Do': return 'bg-slate-500 dark:bg-slate-600';
      default: return 'bg-slate-500 dark:bg-slate-600';
    }
  };

  const handleTaskClickInternal = (task: Task) => {
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      setSelectedTask(task);
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    await enhancedApi.updateTask(taskId, updates);
    loadTasks();
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-xs font-semibold">Loading Gantt & Timeline chart...</div>
      </div>
    );
  }

  const timeMarkers = generateTimeMarkers();
  const maxRows = Math.max(...timelineTasks.map(t => t.row), 0) + 1;
  const criticalPath = computeCriticalPath(tasks);

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-slate-900 text-gray-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 gap-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <TimelineIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-black text-gray-900 dark:text-white">
              Gantt & Timeline View
            </h2>
          </div>

          {/* Critical Path Toggle Button */}
          <button
            onClick={() => setHighlightCriticalPath(!highlightCriticalPath)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center space-x-1.5 ${
              highlightCriticalPath
                ? 'bg-rose-500 text-white border-rose-600 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            <span>🔥</span>
            <span>Critical Path ({criticalPath.size})</span>
          </button>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1 border border-gray-200 dark:border-slate-700">
            {(['week', 'month', 'quarter'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => navigateTime('prev')}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-600 dark:text-slate-400"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            
            <div className="text-xs font-black text-gray-800 dark:text-slate-200 min-w-[140px] text-center">
              {startDate.toLocaleDateString('en-US', { 
                month: 'short', 
                year: 'numeric',
                ...(viewMode === 'week' ? { day: 'numeric' } : {})
              })}
            </div>
            
            <button
              onClick={() => navigateTime('next')}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-600 dark:text-slate-400"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setStartDate(new Date())}
            className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors border border-gray-200 dark:border-slate-700"
          >
            Today
          </button>
        </div>
      </div>

      {/* Timeline Body */}
      <div className="flex-1 overflow-auto p-6">
        <div className="relative min-w-[1200px] bg-white dark:bg-slate-800/80 rounded-2xl border border-gray-200 dark:border-slate-700/80 p-6 shadow-xs">
          
          {/* Time markers header */}
          <div className="relative h-9 mb-6 border-b border-gray-200 dark:border-slate-700">
            {timeMarkers.map((marker, index) => (
              <div
                key={index}
                className="absolute flex flex-col items-center"
                style={{ left: `${marker.position}%` }}
              >
                <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                  {marker.label}
                </div>
                <div className="w-px h-3 bg-gray-300 dark:bg-slate-700" />
              </div>
            ))}
          </div>

          {/* Task bars container */}
          <div 
            className="relative"
            style={{ height: `${Math.max(maxRows * 56, 240)}px` }}
          >
            {timelineTasks.map(task => {
              const isMilestone = !!task.isMilestone;
              const hasBlockers = (task.blockedBy || task.dependencies || []).length > 0;

              return (
                <div
                  key={task.id}
                  onClick={() => handleTaskClickInternal(task)}
                  className={`absolute rounded-xl shadow-xs cursor-pointer hover:shadow-md transition-all flex items-center ${
                    isMilestone 
                      ? 'w-7 h-7 -rotate-45 bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-600 justify-center'
                      : `h-9 ${getStatusColor(task.status, task.isCritical)}`
                  }`}
                  style={{
                    left: `${(task.startX / 1200) * 100}%`,
                    width: isMilestone ? '28px' : `${(task.width / 1200) * 100}%`,
                    top: `${task.row * 56 + 8}px`
                  }}
                  title={`${task.title}\nAssigned: ${task.user?.displayName || 'Unassigned'}\nStatus: ${task.status}\nPriority: ${task.priority || 'medium'}`}
                >
                  {isMilestone ? (
                    <DiamondIcon className="w-4 h-4 text-white rotate-45" />
                  ) : (
                    <>
                      {/* Priority left stripe */}
                      <div className={`w-1.5 h-full rounded-l-xl ${getPriorityColor(task.priority)} shrink-0`} />

                      <div className="flex items-center justify-between w-full px-2.5 text-white text-xs font-bold truncate">
                        <div className="flex items-center space-x-1.5 truncate">
                          {hasBlockers && (
                            <LockClosedIcon className="w-3 h-3 text-rose-200 shrink-0" />
                          )}
                          <span className="truncate">{task.title}</span>
                        </div>

                        {task.user && (
                          <div className="ml-2 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-black text-[10px] shrink-0">
                            {task.user.displayName.charAt(0)}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Today vertical line */}
            {(() => {
              const today = new Date();
              const timelineStart = new Date(startDate);
              const timelineEnd = new Date(startDate);
              
              switch (viewMode) {
                case 'week':
                  timelineEnd.setDate(timelineEnd.getDate() + 28);
                  break;
                case 'month':
                  timelineEnd.setMonth(timelineEnd.getMonth() + 3);
                  break;
                case 'quarter':
                  timelineEnd.setMonth(timelineEnd.getMonth() + 12);
                  break;
              }
              
              if (today >= timelineStart && today <= timelineEnd) {
                const position = ((today.getTime() - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
                return (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none"
                    style={{ left: `${position}%` }}
                  >
                    <div className="absolute -top-3 -left-5 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                      Today
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Timeline Legend */}
          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-slate-700 flex flex-wrap items-center justify-between text-xs gap-4">
            <div className="flex items-center space-x-4">
              <span className="font-bold text-gray-500 dark:text-slate-400">Workflow:</span>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-slate-500 rounded-md" />
                <span className="font-semibold text-gray-700 dark:text-slate-300">To Do</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-blue-600 rounded-md" />
                <span className="font-semibold text-gray-700 dark:text-slate-300">In Progress</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-emerald-600 rounded-md" />
                <span className="font-semibold text-gray-700 dark:text-slate-300">Done</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-amber-500 rotate-45 rounded-xs" />
                <span className="font-semibold text-gray-700 dark:text-slate-300">Milestone</span>
              </div>
            </div>

            {highlightCriticalPath && (
              <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold">
                <span className="w-3 h-3 bg-rose-600 rounded-md ring-2 ring-rose-400" />
                <span>Critical Path: {criticalPath.size} tasks control total schedule</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Task Modal when clicking a task bar */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          project={project}
          users={users}
          currentUser={currentUser}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onUpdateTask={handleUpdateTask}
        />
      )}
    </div>
  );
};

export default TimelineView;
