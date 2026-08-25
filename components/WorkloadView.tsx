import React, { useState, useMemo } from 'react';
import { Project, Task, User, Priority } from '../types';
import { 
  UsersIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  LockClosedIcon, 
  CalendarIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon 
} from './icons';

interface WorkloadViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  currentUser?: User;
  onTaskClick?: (task: Task) => void;
  onTaskUpdate?: (task: Task) => void;
}

export const WorkloadView: React.FC<WorkloadViewProps> = ({
  project,
  tasks,
  users,
  currentUser,
  onTaskClick,
  onTaskUpdate,
}) => {
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);

  const currentWeekDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + selectedWeekOffset * 7);
    return d;
  }, [selectedWeekOffset]);

  // Compute workload statistics per team member
  const memberWorkloads = useMemo(() => {
    return users.map(user => {
      const userTasks = tasks.filter(t => t.assigneeId === user.uid);
      const activeTasks = userTasks.filter(t => t.status !== 'Done');
      const completedTasks = userTasks.filter(t => t.status === 'Done');

      const estimatedHours = activeTasks.reduce((acc, t) => acc + (t.estimatedTime ? t.estimatedTime / 60 : 4), 0);
      const trackedHours = userTasks.reduce((acc, t) => acc + (t.timeTracked ? t.timeTracked / 60 : 0), 0);

      // Max capacity is user workload or 40h standard
      const capacityHours = user.workload || 40;
      const utilizationPct = Math.round((estimatedHours / capacityHours) * 100);

      const status: 'overallocated' | 'optimal' | 'available' = 
        utilizationPct > 100 ? 'overallocated' :
        utilizationPct >= 70 ? 'optimal' : 'available';

      return {
        user,
        userTasks,
        activeTasks,
        completedTasks,
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        trackedHours: Math.round(trackedHours * 10) / 10,
        capacityHours,
        utilizationPct,
        status,
      };
    });
  }, [users, tasks]);

  // Unassigned tasks
  const unassignedTasks = useMemo(() => {
    return tasks.filter(t => !t.assigneeId);
  }, [tasks]);

  const handleReassign = (task: Task, newAssigneeId: string) => {
    if (!onTaskUpdate) return;
    const updated = {
      ...task,
      assigneeId: newAssigneeId === 'unassigned' ? null : newAssigneeId,
      updatedAt: new Date(),
    };
    onTaskUpdate(updated);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Top Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-wrap gap-4 sticky top-0 z-20 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <UsersIcon className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Team Workload & Capacity Management</h2>
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-semibold">
              {project.name}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Balance task loads, prevent burnout, and reassign tasks across team members.
          </p>
        </div>

        {/* Week Navigator */}
        <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-semibold">
          <button
            onClick={() => setSelectedWeekOffset(prev => prev - 1)}
            className="p-1 text-gray-600 hover:text-gray-900 rounded"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          <span className="px-2 text-gray-800">
            {selectedWeekOffset === 0 ? 'Current Week' : `Week of ${currentWeekDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
          </span>
          <button
            onClick={() => setSelectedWeekOffset(prev => prev + 1)}
            className="p-1 text-gray-600 hover:text-gray-900 rounded"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Unassigned Tasks Alert Bar if any */}
        {unassignedTasks.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-amber-200 text-amber-800 rounded-xl text-xs font-bold">⚠️</span>
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  {unassignedTasks.length} Unassigned Task{unassignedTasks.length === 1 ? '' : 's'}
                </h4>
                <p className="text-xs text-amber-700">
                  Assign these tasks to available team members to ensure balanced execution.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {unassignedTasks.slice(0, 3).map(t => (
                <button
                  key={t.id}
                  onClick={() => onTaskClick && onTaskClick(t)}
                  className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 rounded-lg text-xs font-medium text-amber-900 truncate max-w-[160px]"
                >
                  {t.title}
                </button>
              ))}
              {unassignedTasks.length > 3 && (
                <span className="text-xs font-bold text-amber-800">+{unassignedTasks.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {/* Member Workload Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {memberWorkloads.map(item => {
            const statusBadgeColors = {
              overallocated: 'bg-red-100 text-red-800 border-red-200',
              optimal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
              available: 'bg-blue-100 text-blue-800 border-blue-200',
            };

            const progressBarColors = {
              overallocated: 'bg-red-500',
              optimal: 'bg-emerald-500',
              available: 'bg-blue-500',
            };

            return (
              <div
                key={item.user.uid}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
              >
                {/* Member Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
                      {item.user.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">{item.user.displayName}</h3>
                      <p className="text-xs text-gray-500 capitalize">{item.user.role} • {item.user.department || 'Engineering'}</p>
                    </div>
                  </div>

                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider ${statusBadgeColors[item.status]}`}>
                    {item.status}
                  </span>
                </div>

                {/* Capacity Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-600">Workload Allocated:</span>
                    <span className="font-bold text-gray-900">
                      {item.estimatedHours}h / {item.capacityHours}h ({item.utilizationPct}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, item.utilizationPct)}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${progressBarColors[item.status]}`}
                    />
                  </div>
                </div>

                {/* Tasks List Assigned */}
                <div className="space-y-2 pt-2 border-t border-gray-100 flex-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                    <span>Active Tasks ({item.activeTasks.length})</span>
                    <span>{item.completedTasks.length} done</span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {item.activeTasks.length > 0 ? (
                      item.activeTasks.map(task => (
                        <div
                          key={task.id}
                          className="p-2 bg-slate-50 hover:bg-blue-50/60 rounded-lg border border-gray-100 flex items-center justify-between gap-2 text-xs group transition-colors"
                        >
                          <div
                            onClick={() => onTaskClick && onTaskClick(task)}
                            className="flex items-center space-x-1.5 truncate flex-1 cursor-pointer"
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'
                            }`} />
                            <span className="font-medium text-gray-800 truncate group-hover:text-blue-600">
                              {task.title}
                            </span>
                          </div>

                          {/* Quick re-assign dropdown */}
                          <select
                            value={task.assigneeId || 'unassigned'}
                            onChange={e => handleReassign(task, e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 shrink-0 font-medium"
                            title="Reassign to another teammate"
                          >
                            <option value="unassigned">Unassign</option>
                            {users.map(u => (
                              <option key={u.uid} value={u.uid}>{u.displayName}</option>
                            ))}
                          </select>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-center text-xs text-gray-400">
                        No active tasks. Available for new assignments!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkloadView;
