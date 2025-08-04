import React, { useState, useEffect } from 'react';
import { Task, User, Project } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { TimelineIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

interface TimelineViewProps {
  project: Project;
  currentUser: User;
  users: User[];
}

interface TimelineTask extends Task {
  user?: User;
  startX: number;
  width: number;
  row: number;
}

const TimelineView: React.FC<TimelineViewProps> = ({ project, currentUser, users }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timelineTasks, setTimelineTasks] = useState<TimelineTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'quarter'>('month');

  useEffect(() => {
    loadTasks();
  }, [project.id]);

  useEffect(() => {
    if (tasks.length > 0) {
      calculateTimeline();
    }
  }, [tasks, startDate, viewMode]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const projectTasks = await enhancedApi.getTasksForProject(project.id);
      const tasksWithDates = projectTasks.filter(task => task.startDate || task.dueDate);
      setTasks(tasksWithDates);
      
      // Set start date to earliest task start date or current date
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
    
    // Calculate timeline duration based on view mode
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

    const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = 1200 / totalDays; // 1200px total width

    // Assign rows to avoid overlaps
    const assignedRows: { [key: number]: { start: Date; end: Date }[] } = {};
    
    const processedTasks: TimelineTask[] = tasks.map(task => {
      const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
      const taskEnd = task.dueDate ? new Date(task.dueDate) : new Date(taskStart.getTime() + 24 * 60 * 60 * 1000);
      
      // Find available row
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

      // Calculate position and width
      const startX = Math.max(0, (taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24) * dayWidth);
      const endX = Math.min(1200, (taskEnd.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24) * dayWidth);
      const width = Math.max(20, endX - startX); // Minimum width of 20px

      return {
        ...task,
        user: users.find(u => u.uid === task.assigneeId),
        startX,
        width,
        row
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
        // Weekly markers
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
        // Monthly markers
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
        // Quarterly markers
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done': return 'bg-green-500';
      case 'In Progress': return 'bg-yellow-500';
      case 'To Do': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading timeline...</div>
      </div>
    );
  }

  const timeMarkers = generateTimeMarkers();
  const maxRows = Math.max(...timelineTasks.map(t => t.row), 0) + 1;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <TimelineIcon className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-semibold text-gray-900">
              {project.name} Timeline
            </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['week', 'month', 'quarter'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize ${
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigateTime('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
              {startDate.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric',
                ...(viewMode === 'week' ? { day: 'numeric' } : {})
              })}
            </div>
            
            <button
              onClick={() => navigateTime('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => setStartDate(new Date())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Today
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto p-4">
        <div className="relative">
          {/* Time markers */}
          <div className="relative h-10 mb-4 border-b border-gray-200">
            {timeMarkers.map((marker, index) => (
              <div
                key={index}
                className="absolute flex flex-col items-center"
                style={{ left: `${marker.position}%` }}
              >
                <div className="text-xs font-medium text-gray-700 mb-1">
                  {marker.label}
                </div>
                <div className="w-px h-4 bg-gray-300"></div>
              </div>
            ))}
          </div>

          {/* Task bars */}
          <div 
            className="relative"
            style={{ height: `${Math.max(maxRows * 60, 200)}px` }}
          >
            {timelineTasks.map(task => (
              <div
                key={task.id}
                className={`absolute h-8 rounded-md shadow-sm cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(task.status)}`}
                style={{
                  left: `${(task.startX / 1200) * 100}%`,
                  width: `${(task.width / 1200) * 100}%`,
                  top: `${task.row * 60 + 10}px`
                }}
                title={`${task.title}\nAssigned to: ${task.user?.displayName || 'Unassigned'}\nStatus: ${task.status}\nPriority: ${task.priority}`}
              >
                <div className="flex items-center h-full px-2 text-white text-sm font-medium truncate">
                  <span className="truncate">{task.title}</span>
                  {task.user && (
                    <div className="ml-2 w-5 h-5 rounded-full bg-white bg-opacity-30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold">
                        {task.user.displayName.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Priority indicator */}
                <div className={`absolute left-0 top-0 w-1 h-full rounded-l-md ${getPriorityColor(task.priority)}`}></div>
              </div>
            ))}

            {/* Today line */}
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
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                    style={{ left: `${position}%` }}
                  >
                    <div className="absolute -top-2 -left-8 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      Today
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          {/* Legend */}
          <div className="mt-8 flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700">Status:</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-400 rounded"></div>
                <span className="text-gray-600">To Do</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span className="text-gray-600">In Progress</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">Done</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700">Priority:</span>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-500 rounded"></div>
                <span className="text-gray-600">Low</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Medium</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-600">High</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-gray-600">Critical</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;