import React, { useState, useEffect } from 'react';
import { Task, User, Project } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from './icons';

interface CalendarViewProps {
  project?: Project;
  currentUser: User;
  users: User[];
}

interface CalendarTask extends Task {
  user?: User;
}

const CalendarView: React.FC<CalendarViewProps> = ({ project, currentUser, users }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  useEffect(() => {
    const loadTasks = async () => {
      setLoading(true);
      try {
        let allTasks: Task[] = [];
        if (project) {
          allTasks = await enhancedApi.getTasksForProject(project.id);
        } else {
          allTasks = await enhancedApi.getTasksForUser(currentUser.uid);
        }
        
        // Filter tasks with due dates and enrich with user data
        const tasksWithDates = allTasks
          .filter(task => task.dueDate)
          .map(task => ({
            ...task,
            user: users.find(u => u.uid === task.assigneeId)
          }));
        
        setTasks(tasksWithDates);
      } catch (error) {
        console.error('Failed to load tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [project, currentUser, users]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    const days = [];
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 border-red-600';
      case 'high': return 'bg-orange-500 border-orange-600';
      case 'medium': return 'bg-blue-500 border-blue-600';
      case 'low': return 'bg-gray-500 border-gray-600';
      default: return 'bg-gray-500 border-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading calendar...</div>
      </div>
    );
  }

  const days = viewMode === 'month' ? getDaysInMonth(currentDate) : getWeekDays(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-semibold text-gray-900">
              {project ? `${project.name} Calendar` : 'My Calendar'}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                viewMode === 'week'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Week
            </button>
          </div>

          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => viewMode === 'month' ? navigateMonth('prev') : navigateWeek('prev')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            
            <div className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
              {viewMode === 'month' 
                ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                : `Week of ${currentDate.toLocaleDateString()}`
              }
            </div>
            
            <button
              onClick={() => viewMode === 'month' ? navigateMonth('next') : navigateWeek('next')}
              className="p-2 hover:bg-gray-100 rounded-md"
            >
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-4">
        {/* Day Headers */}
        <div className={`grid grid-cols-7 gap-px mb-2`}>
          {dayNames.slice(0, viewMode === 'week' ? 7 : 7).map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-700 bg-gray-50">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className={`grid grid-cols-7 gap-px bg-gray-200 ${viewMode === 'month' ? 'grid-rows-6' : 'grid-rows-1'} h-full`}>
          {days.map((day, index) => {
            const dayTasks = getTasksForDate(day);
            const isCurrentMonthDay = isCurrentMonth(day);
            const isTodayDay = isToday(day);

            return (
              <div
                key={index}
                className={`bg-white p-2 ${viewMode === 'month' ? 'min-h-[120px]' : 'min-h-[400px]'} ${
                  !isCurrentMonthDay && viewMode === 'month' ? 'bg-gray-50 text-gray-400' : ''
                } ${isTodayDay ? 'bg-blue-50 ring-2 ring-blue-200' : ''}`}
              >
                <div className={`text-sm font-medium mb-2 ${isTodayDay ? 'text-blue-600' : 'text-gray-900'}`}>
                  {day.getDate()}
                </div>
                
                <div className="space-y-1">
                  {dayTasks.slice(0, viewMode === 'month' ? 3 : 10).map(task => (
                    <div
                      key={task.id}
                      className={`text-xs p-1 rounded text-white truncate ${getPriorityColor(task.priority)}`}
                      title={`${task.title} - ${task.user?.displayName || 'Unassigned'}`}
                    >
                      <div className="flex items-center space-x-1">
                        {task.user && (
                          <div className="w-3 h-3 rounded-full bg-white bg-opacity-30 flex items-center justify-center">
                            <span className="text-[8px] font-bold">
                              {task.user.displayName.charAt(0)}
                            </span>
                          </div>
                        )}
                        <span className="truncate">{task.title}</span>
                      </div>
                    </div>
                  ))}
                  
                  {dayTasks.length > (viewMode === 'month' ? 3 : 10) && (
                    <div className="text-xs text-gray-500 font-medium">
                      +{dayTasks.length - (viewMode === 'month' ? 3 : 10)} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarView;