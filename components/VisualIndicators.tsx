import React, { useState } from 'react';
import { Task, Project, Priority } from '../types';
import { 
  ClockIcon, 
  FlagIcon, 
  CheckCircleIcon, 
  AlertTriangleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  UserIcon,
  CalendarIcon,
  LinkIcon,
  LockClosedIcon,
  LockOpenIcon,
  BanIcon
} from './icons';

interface TaskIndicatorsProps {
  task: Task;
  allTasks?: Task[];
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

interface DependencyBadgeProps {
  task: Task;
  allTasks?: Task[];
  compact?: boolean;
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

export const TaskDependencyIndicators: React.FC<DependencyBadgeProps> = ({ task, allTasks = [], compact = false }) => {
  const [showTooltip, setShowTooltip] = useState<'blocked' | 'blocking' | null>(null);

  const blockedByIds = task.blockedBy || task.dependencies || [];
  const blockingIds = task.blocking || [];

  if (blockedByIds.length === 0 && blockingIds.length === 0) {
    return null;
  }

  // Resolve blocker details
  const blockerTasks = blockedByIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[];
  const unresolvedBlockers = blockerTasks.filter(t => t.status !== 'Done');
  const isBlocked = unresolvedBlockers.length > 0 || (blockerTasks.length === 0 && blockedByIds.length > 0);

  // Resolve dependent details
  const dependentTasks = blockingIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean) as Task[];

  return (
    <div className="relative inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {/* Blocked By Badge */}
      {blockedByIds.length > 0 && (
        <div 
          className="relative inline-block"
          onMouseEnter={() => setShowTooltip('blocked')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          {isBlocked ? (
            <span
              className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-red-50 text-red-700 border-red-200 ${
                compact ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
              }`}
              title={`Blocked by ${unresolvedBlockers.length || blockedByIds.length} incomplete tasks`}
            >
              <BanIcon className="w-3 h-3 text-red-600 shrink-0" />
              <span>
                Blocked{unresolvedBlockers.length > 0 ? ` (${unresolvedBlockers.length})` : ` (${blockedByIds.length})`}
              </span>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 font-medium rounded-md border bg-emerald-50 text-emerald-700 border-emerald-200 ${
                compact ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
              }`}
              title="All prerequisite dependencies completed"
            >
              <LockOpenIcon className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>Unblocked</span>
            </span>
          )}

          {/* Blocked Tooltip Popover */}
          {showTooltip === 'blocked' && blockerTasks.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1.5 z-30 w-56 p-2 bg-gray-900 text-white rounded-lg shadow-xl text-xs space-y-1.5 pointer-events-none">
              <div className="font-semibold text-gray-200 border-b border-gray-700 pb-1 flex items-center justify-between">
                <span>Blocked by ({blockerTasks.length})</span>
                <span className={isBlocked ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                  {isBlocked ? `${unresolvedBlockers.length} open` : 'All done'}
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {blockerTasks.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate flex-1 text-gray-300">{b.title}</span>
                    <span className={`px-1 rounded text-[10px] shrink-0 ${
                      b.status === 'Done' ? 'bg-emerald-900 text-emerald-300' :
                      b.status === 'In Progress' ? 'bg-blue-900 text-blue-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Blocking Badge */}
      {blockingIds.length > 0 && (
        <div 
          className="relative inline-block"
          onMouseEnter={() => setShowTooltip('blocking')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          <span
            className={`inline-flex items-center gap-1 font-medium rounded-md border bg-purple-50 text-purple-700 border-purple-200 ${
              compact ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5'
            }`}
            title={`Blocks ${blockingIds.length} downstream tasks`}
          >
            <LinkIcon className="w-3 h-3 text-purple-600 shrink-0" />
            <span>Blocks ({blockingIds.length})</span>
          </span>

          {/* Blocking Tooltip Popover */}
          {showTooltip === 'blocking' && dependentTasks.length > 0 && (
            <div className="absolute left-0 bottom-full mb-1.5 z-30 w-56 p-2 bg-gray-900 text-white rounded-lg shadow-xl text-xs space-y-1.5 pointer-events-none">
              <div className="font-semibold text-purple-300 border-b border-gray-700 pb-1">
                Blocks {dependentTasks.length} {dependentTasks.length === 1 ? 'task' : 'tasks'}:
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {dependentTasks.map(d => (
                  <div key={d.id} className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="truncate flex-1 text-gray-300">{d.title}</span>
                    <span className="text-[10px] text-gray-400 shrink-0">{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const TaskIndicators: React.FC<TaskIndicatorsProps> = ({ task, allTasks = [], compact = false }) => {
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'flex-wrap' : ''}`}>
      <PriorityBadge priority={task.priority} size={compact ? 'sm' : 'md'} />
      <OverdueBadge dueDate={task.dueDate} size={compact ? 'sm' : 'md'} />
      <TaskDependencyIndicators task={task} allTasks={allTasks} compact={compact} />
      
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