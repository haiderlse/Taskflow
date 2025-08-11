import React from 'react';
import { Task, Project, Priority } from '../types';
import { 
  ClockIcon, 
  FlagIcon, 
  CheckCircleIcon, 
  AlertTriangleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UserIcon,
  CalendarIcon
} from './icons';

interface TaskIndicatorsProps {
  task: Task;
  compact?: boolean;
}

interface ProjectIndicatorsProps {
  project: Project;
  taskCount?: number;
  completedTaskCount?: number;
  overdueTaskCount?: number;
  compact?: boolean;
}

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'sm' | 'md' | 'lg';
}

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

interface OverdueBadgeProps {
  dueDate: Date | null;
  size?: 'sm' | 'md' | 'lg';
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const priorityConfig = {
    low: { 
      color: 'bg-gray-100 text-gray-700 border-gray-200', 
      icon: <FlagIcon className="w-3 h-3" />,
      label: 'Low'
    },
    medium: { 
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
      icon: <FlagIcon className="w-3 h-3" />,
      label: 'Medium'
    },
    high: { 
      color: 'bg-orange-100 text-orange-700 border-orange-200', 
      icon: <FlagIcon className="w-3 h-3" />,
      label: 'High'
    },
    critical: { 
      color: 'bg-red-100 text-red-700 border-red-200', 
      icon: <AlertTriangleIcon className="w-3 h-3" />,
      label: 'Critical'
    }
  };

  const config = priorityConfig[priority];

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-md border ${config.color} ${sizeClasses[size]}`}>
      {config.icon}
      {size !== 'sm' && config.label}
    </span>
  );
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  const statusConfig = {
    'To Do': { 
      color: 'bg-gray-100 text-gray-700 border-gray-200', 
      icon: <ClockIcon className="w-3 h-3" />
    },
    'In Progress': { 
      color: 'bg-blue-100 text-blue-700 border-blue-200', 
      icon: <TrendingUpIcon className="w-3 h-3" />
    },
    'Done': { 
      color: 'bg-green-100 text-green-700 border-green-200', 
      icon: <CheckCircleIcon className="w-3 h-3" />
    },
    'active': { 
      color: 'bg-green-100 text-green-700 border-green-200', 
      icon: <TrendingUpIcon className="w-3 h-3" />
    },
    'on_hold': { 
      color: 'bg-yellow-100 text-yellow-700 border-yellow-200', 
      icon: <ClockIcon className="w-3 h-3" />
    },
    'completed': { 
      color: 'bg-green-100 text-green-700 border-green-200', 
      icon: <CheckCircleIcon className="w-3 h-3" />
    },
    'archived': { 
      color: 'bg-gray-100 text-gray-700 border-gray-200', 
      icon: <ClockIcon className="w-3 h-3" />
    }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['To Do'];

  return (
    <span className={`inline-flex items-center gap-1 font-medium rounded-md border ${config.color} ${sizeClasses[size]}`}>
      {config.icon}
      {size !== 'sm' && status}
    </span>
  );
};

export const OverdueBadge: React.FC<OverdueBadgeProps> = ({ dueDate, size = 'md' }) => {
  if (!dueDate) return null;

  const now = new Date();
  const due = new Date(dueDate);
  const isOverdue = due < now;
  const isDueToday = due.toDateString() === now.toDateString();

  if (!isOverdue && !isDueToday) return null;

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  if (isOverdue) {
    const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return (
      <span className={`inline-flex items-center gap-1 font-medium rounded-md border bg-red-100 text-red-700 border-red-200 ${sizeClasses[size]}`}>
        <AlertTriangleIcon className="w-3 h-3" />
        {size !== 'sm' && `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`}
      </span>
    );
  }

  if (isDueToday) {
    return (
      <span className={`inline-flex items-center gap-1 font-medium rounded-md border bg-yellow-100 text-yellow-700 border-yellow-200 ${sizeClasses[size]}`}>
        <CalendarIcon className="w-3 h-3" />
        {size !== 'sm' && 'Due today'}
      </span>
    );
  }

  return null;
};

export const TaskIndicators: React.FC<TaskIndicatorsProps> = ({ task, compact = false }) => {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
      <PriorityBadge priority={task.priority} size={compact ? 'sm' : 'md'} />
      <OverdueBadge dueDate={task.dueDate} size={compact ? 'sm' : 'md'} />
      
      {task.approval && (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md border ${
          task.approval.status === 'approved' 
            ? 'bg-green-100 text-green-700 border-green-200'
            : task.approval.status === 'rejected'
            ? 'bg-red-100 text-red-700 border-red-200'
            : 'bg-yellow-100 text-yellow-700 border-yellow-200'
        } ${compact ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'}`}>
          <CheckCircleIcon className="w-3 h-3" />
          {!compact && `Approval ${task.approval.status}`}
        </span>
      )}

      {task.timeTracked > 0 && (
        <span className={`inline-flex items-center gap-1 text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
          <ClockIcon className="w-3 h-3" />
          {Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m
        </span>
      )}
    </div>
  );
};

export const ProjectIndicators: React.FC<ProjectIndicatorsProps> = ({ 
  project, 
  taskCount = 0, 
  completedTaskCount = 0, 
  overdueTaskCount = 0, 
  compact = false 
}) => {
  const completionPercentage = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;
  const isHealthy = overdueTaskCount === 0 && completionPercentage >= 75;
  const needsAttention = overdueTaskCount > 0 || completionPercentage < 50;

  return (
    <div className={`flex items-center gap-2 ${compact ? 'flex-wrap' : ''}`}>
      <StatusBadge status={project.status} size={compact ? 'sm' : 'md'} />
      
      {taskCount > 0 && (
        <span className={`inline-flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>
          <CheckCircleIcon className="w-3 h-3" />
          {completedTaskCount}/{taskCount} tasks
        </span>
      )}

      {overdueTaskCount > 0 && (
        <span className={`inline-flex items-center gap-1 font-medium rounded-md border bg-red-100 text-red-700 border-red-200 ${
          compact ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
        }`}>
          <AlertTriangleIcon className="w-3 h-3" />
          {!compact && `${overdueTaskCount} overdue`}
        </span>
      )}

      {taskCount > 0 && (
        <div className={`flex items-center gap-1 ${compact ? 'text-xs' : 'text-sm'}`}>
          {isHealthy ? (
            <span className="text-green-600 flex items-center gap-1">
              <TrendingUpIcon className="w-3 h-3" />
              {!compact && 'Healthy'}
            </span>
          ) : needsAttention ? (
            <span className="text-red-600 flex items-center gap-1">
              <TrendingDownIcon className="w-3 h-3" />
              {!compact && 'Needs attention'}
            </span>
          ) : (
            <span className="text-yellow-600 flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {!compact && 'On track'}
            </span>
          )}
        </div>
      )}

      {taskCount > 0 && !compact && (
        <div className="flex items-center gap-1">
          <div className="w-16 bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                completionPercentage >= 75 ? 'bg-green-500' :
                completionPercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{completionPercentage}%</span>
        </div>
      )}
    </div>
  );
};

export default { TaskIndicators, ProjectIndicators, PriorityBadge, StatusBadge, OverdueBadge };