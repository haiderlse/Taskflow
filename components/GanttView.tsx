import React, { useState, useMemo } from 'react';
import { Project, Task, User, Priority } from '../types';
import { 
  CalendarIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  PlusIcon, 
  FilterIcon, 
  CheckCircleIcon, 
  LockClosedIcon, 
  LinkIcon 
} from './icons';

interface GanttViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  currentUser?: User;
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (task: Task) => void;
  onTaskCreate?: (taskData: Partial<Task>) => void;
}

type GanttScale = 'day' | 'week' | 'month';

export const GanttView: React.FC<GanttViewProps> = ({
  project,
  tasks,
  users,
  currentUser,
  onTaskClick,
  onTaskUpdate,
  onTaskCreate,
}) => {
  const [scale, setScale] = useState<GanttScale>('day');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [currentStartDate, setCurrentStartDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return d;
  });

  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.uid, u));
    return map;
  }, [users]);

  // Compute days to display (e.g. 21 days for day scale, 12 weeks for week scale)
  const columnsCount = scale === 'day' ? 21 : scale === 'week' ? 12 : 6;

  const dates = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < columnsCount; i++) {
      const d = new Date(currentStartDate);
      if (scale === 'day') {
        d.setDate(d.getDate() + i);
      } else if (scale === 'week') {
        d.setDate(d.getDate() + i * 7);
      } else {
        d.setMonth(d.getMonth() + i);
      }
      arr.push(d);
    }
    return arr;
  }, [currentStartDate, columnsCount, scale]);

  const viewStartMs = dates[0].getTime();
  const viewEndMs = dates[dates.length - 1].getTime() + (scale === 'day' ? 86400000 : scale === 'week' ? 86400000 * 7 : 86400000 * 30);
  const totalViewDuration = Math.max(1, viewEndMs - viewStartMs);

  // Filter tasks
  const visibleTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterAssignee !== 'all' && t.assigneeId !== filterAssignee) return false;
      return true;
    });
  }, [tasks, filterPriority, filterAssignee]);

  const handlePrev = () => {
    const d = new Date(currentStartDate);
    if (scale === 'day') d.setDate(d.getDate() - 7);
    else if (scale === 'week') d.setDate(d.getDate() - 28);
    else d.setMonth(d.getMonth() - 3);
    setCurrentStartDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentStartDate);
    if (scale === 'day') d.setDate(d.getDate() + 7);
    else if (scale === 'week') d.setDate(d.getDate() + 28);
    else d.setMonth(d.getMonth() + 3);
    setCurrentStartDate(d);
  };

  const handleToday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    setCurrentStartDate(d);
  };

  const priorityColors: Record<Priority, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-slate-400',
  };

  return (
    <div className="flex flex-col h-full bg-white select-none">
      {/* Gantt Toolbar */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-wrap gap-3 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1 bg-white border border-gray-300 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              title="Previous"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1 text-gray-600 hover:text-gray-900 rounded"
              title="Next"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Scale picker */}
          <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg text-xs font-medium">
            {(['day', 'week', 'month'] as GanttScale[]).map(s => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-3 py-1 rounded-md capitalize transition-all ${
                  scale === s
                    ? 'bg-white text-blue-600 font-bold shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 text-xs">
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 font-medium"
          >
            <option value="all">All Assignees</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{u.displayName}</option>
            ))}
          </select>

          <span className="text-gray-500 font-medium">
            {visibleTasks.length} task{visibleTasks.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Gantt Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Task Names & Meta Column */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white shrink-0">
          <div className="h-12 border-b border-gray-200 px-4 flex items-center font-bold text-xs text-gray-500 uppercase tracking-wider bg-slate-50">
            Task Name & Assignee
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {visibleTasks.map(task => {
              const assignee = task.assigneeId ? usersMap.get(task.assigneeId) : null;
              const hasBlockers = (task.blockedBy && task.blockedBy.length > 0) || (task.dependencies && task.dependencies.length > 0);

              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick && onTaskClick(task)}
                  className="h-12 px-4 flex items-center justify-between hover:bg-blue-50/60 cursor-pointer transition-colors"
                >
                  <div className="flex items-center space-x-2 truncate flex-1 min-w-0 pr-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      task.status === 'Done' ? 'bg-emerald-500' :
                      task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'
                    }`} />
                    <span className={`text-xs font-semibold truncate ${
                      task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-900'
                    }`}>
                      {task.title}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    {hasBlockers && (
                      <LockClosedIcon className="w-3 h-3 text-red-500" title="Has dependencies" />
                    )}
                    {assignee ? (
                      <div className="w-5 h-5 bg-yellow-400 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                        {assignee.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic">None</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Timeline Gantt Bars */}
        <div className="flex-1 overflow-x-auto overflow-y-auto flex flex-col bg-slate-50/50">
          {/* Header Row: Dates */}
          <div className="h-12 border-b border-gray-200 flex shrink-0 bg-slate-50 sticky top-0 z-10">
            {dates.map((date, idx) => {
              const isToday = new Date().toDateString() === date.toDateString();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <div
                  key={idx}
                  className={`flex-1 min-w-[70px] border-r border-gray-200 p-1 flex flex-col items-center justify-center text-xs ${
                    isToday ? 'bg-blue-50/80 font-bold text-blue-700' :
                    isWeekend ? 'bg-slate-100/50 text-gray-400' : 'text-gray-600'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold">
                    {date.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                  <span className="font-bold">
                    {date.getDate()} {scale !== 'day' ? date.toLocaleDateString(undefined, { month: 'short' }) : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rows with Schedule Bars */}
          <div className="flex-1 divide-y divide-gray-100 relative">
            {visibleTasks.map(task => {
              const taskStart = task.startDate ? new Date(task.startDate).getTime() : new Date(task.createdAt).getTime();
              const taskEnd = task.dueDate ? new Date(task.dueDate).getTime() : taskStart + (86400000 * 2);

              // Calculate bar position percentage
              const leftRatio = Math.max(0, Math.min(1, (taskStart - viewStartMs) / totalViewDuration));
              const rightRatio = Math.max(0, Math.min(1, (taskEnd - viewStartMs) / totalViewDuration));
              const widthRatio = Math.max(0.04, rightRatio - leftRatio);

              const leftPct = `${leftRatio * 100}%`;
              const widthPct = `${widthRatio * 100}%`;

              return (
                <div key={task.id} className="h-12 relative flex items-center group hover:bg-blue-50/30">
                  {/* Grid background lines */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    {dates.map((d, i) => (
                      <div key={i} className="flex-1 min-w-[70px] border-r border-gray-100" />
                    ))}
                  </div>

                  {/* Gantt Bar */}
                  <div
                    onClick={() => onTaskClick && onTaskClick(task)}
                    style={{ left: leftPct, width: widthPct }}
                    className={`absolute h-7 rounded-lg shadow-sm cursor-pointer transition-all flex items-center px-2.5 overflow-hidden text-white text-xs font-semibold ${
                      task.status === 'Done' ? 'bg-emerald-600 opacity-90' :
                      priorityColors[task.priority] || 'bg-blue-600'
                    } hover:ring-2 hover:ring-blue-400 hover:brightness-110`}
                  >
                    <span className="truncate">{task.title}</span>
                    {task.status === 'Done' && (
                      <CheckCircleIcon className="w-3.5 h-3.5 ml-auto shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttView;
