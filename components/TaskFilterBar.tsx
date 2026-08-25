import React, { useState, useRef, useEffect } from 'react';
import { TaskFilterOptions, User, ColumnId, Priority } from '../types';
import { 
  FilterIcon, 
  SortIcon, 
  GroupIcon, 
  SearchIcon, 
  XIcon, 
  CheckIcon, 
  SlidersIcon, 
  DiamondIcon, 
  ClockIcon, 
  FlameIcon, 
  TagIcon,
  DownloadIcon
} from './icons';
import { countActiveFilters, DEFAULT_FILTER_OPTIONS } from '../utils/filterUtils';

interface TaskFilterBarProps {
  filters: TaskFilterOptions;
  onFilterChange: (newFilters: TaskFilterOptions) => void;
  users: User[];
  availableTags?: string[];
  currentUser?: User | null;
  totalTaskCount: number;
  filteredTaskCount: number;
  onExportCsv?: () => void;
  onOpenRules?: () => void;
  onOpenForms?: () => void;
  onOpenTimesheet?: () => void;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({
  filters,
  onFilterChange,
  users,
  availableTags = [],
  currentUser,
  totalTaskCount,
  filteredTaskCount,
  onExportCsv,
  onOpenRules,
  onOpenForms,
  onOpenTimesheet
}) => {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
      if (groupRef.current && !groupRef.current.contains(e.target as Node)) {
        setShowGroupDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCount = countActiveFilters(filters);

  const handleResetFilters = () => {
    onFilterChange({
      ...DEFAULT_FILTER_OPTIONS,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      groupBy: filters.groupBy
    });
  };

  const toggleAssignee = (userId: string) => {
    const current = filters.assigneeIds || [];
    const updated = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    onFilterChange({ ...filters, assigneeIds: updated });
  };

  const toggleStatus = (status: ColumnId) => {
    const current = filters.statuses || [];
    const updated = current.includes(status)
      ? current.filter(s => s !== status)
      : [...current, status];
    onFilterChange({ ...filters, statuses: updated });
  };

  const togglePriority = (priority: Priority) => {
    const current = filters.priorities || [];
    const updated = current.includes(priority)
      ? current.filter(p => p !== priority)
      : [...current, priority];
    onFilterChange({ ...filters, priorities: updated });
  };

  const toggleTag = (tag: string) => {
    const current = filters.tags || [];
    const updated = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag];
    onFilterChange({ ...filters, tags: updated });
  };

  const setDueDatePreset = (preset: TaskFilterOptions['dueDatePreset']) => {
    onFilterChange({ ...filters, dueDatePreset: preset });
  };

  const setTaskType = (taskType: TaskFilterOptions['taskType']) => {
    onFilterChange({ ...filters, taskType });
  };

  const setSort = (sortBy: TaskFilterOptions['sortBy']) => {
    if (filters.sortBy === sortBy) {
      onFilterChange({
        ...filters,
        sortDirection: filters.sortDirection === 'asc' ? 'desc' : 'asc'
      });
    } else {
      onFilterChange({
        ...filters,
        sortBy,
        sortDirection: 'asc'
      });
    }
  };

  // Quick Preset Handlers
  const isMyTasksActive = currentUser && filters.assigneeIds.length === 1 && filters.assigneeIds[0] === currentUser.uid;
  const isDue24hActive = filters.dueDatePreset === 'due_24h';
  const isOverdueActive = filters.dueDatePreset === 'overdue';
  const isHighPriorityActive = filters.priorities.includes('high') && filters.priorities.includes('critical') && filters.priorities.length === 2;
  const isMilestoneActive = filters.taskType === 'milestones_only';
  const isBlockedActive = filters.taskType === 'blocked_only';
  const isIncompleteActive = filters.statuses.length === 2 && filters.statuses.includes('To Do') && filters.statuses.includes('In Progress');

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-2.5 transition-colors">
      {/* Top Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left Side: Search + Filter / Sort / Group Dropdowns */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Quick Search */}
          <div className="relative min-w-[200px] max-w-xs">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
            <input
              type="text"
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
              placeholder="Filter tasks..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {filters.searchQuery && (
              <button
                onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Button & Popover */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeCount > 0
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <FilterIcon className="w-3.5 h-3.5" />
              <span>Filter</span>
              {activeCount > 0 && (
                <span className="w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                  {activeCount}
                </span>
              )}
            </button>

            {/* Filter Dropdown Popover */}
            {showFilterDropdown && (
              <div className="absolute left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 p-4 z-50 text-xs space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-center space-x-1.5 font-bold text-gray-900 dark:text-white">
                    <SlidersIcon className="w-4 h-4 text-blue-500" />
                    <span>Filter Tasks</span>
                  </div>
                  {activeCount > 0 && (
                    <button
                      onClick={handleResetFilters}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                {/* Due Date Presets */}
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Due Date
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'all', label: 'All Dates' },
                      { id: 'due_24h', label: '⚡ Due in 24h' },
                      { id: 'overdue', label: '⚠️ Overdue' },
                      { id: 'today', label: '📅 Today' },
                      { id: 'next_7_days', label: '7 Days' },
                      { id: 'no_due_date', label: 'No Date' }
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={() => setDueDatePreset(item.id as any)}
                        className={`px-2 py-1 rounded-md text-left font-medium transition-colors ${
                          filters.dueDatePreset === item.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority Filter */}
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Priority
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['critical', 'high', 'medium', 'low'] as Priority[]).map(p => {
                      const isSelected = filters.priorities.includes(p);
                      return (
                        <button
                          key={p}
                          onClick={() => togglePriority(p)}
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold capitalize border transition-all ${
                            isSelected
                              ? p === 'critical'
                                ? 'bg-red-600 text-white border-red-600'
                                : p === 'high'
                                ? 'bg-orange-500 text-white border-orange-500'
                                : p === 'medium'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-slate-600 text-white border-slate-600'
                              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isSelected && <CheckIcon className="w-3 h-3" />}
                          <span>{p}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Status / Column
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {(['To Do', 'In Progress', 'Done'] as ColumnId[]).map(s => {
                      const isSelected = filters.statuses.includes(s);
                      return (
                        <button
                          key={s}
                          onClick={() => toggleStatus(s)}
                          className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {isSelected && <CheckIcon className="w-3 h-3" />}
                          <span>{s}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Assignees Filter */}
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Assignee
                  </label>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {currentUser && (
                      <button
                        onClick={() => toggleAssignee(currentUser.uid)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-colors ${
                          filters.assigneeIds.includes(currentUser.uid)
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                            : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                            {currentUser.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <span>Assigned to me ({currentUser.displayName})</span>
                        </div>
                        {filters.assigneeIds.includes(currentUser.uid) && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    )}

                    <button
                      onClick={() => toggleAssignee('unassigned')}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-colors ${
                        filters.assigneeIds.includes('unassigned')
                          ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full border border-dashed border-gray-400 text-gray-500 flex items-center justify-center text-[10px]">
                          ?
                        </div>
                        <span>Unassigned tasks</span>
                      </div>
                      {filters.assigneeIds.includes('unassigned') && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                    </button>

                    {users
                      .filter(u => !currentUser || u.uid !== currentUser.uid)
                      .map(user => {
                        const isSelected = filters.assigneeIds.includes(user.uid);
                        return (
                          <button
                            key={user.uid}
                            onClick={() => toggleAssignee(user.uid)}
                            className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-left transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                                : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-5 h-5 rounded-full bg-slate-500 text-white flex items-center justify-center font-bold text-[10px]">
                                {user.displayName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="truncate">{user.displayName}</span>
                            </div>
                            {isSelected && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* Special Types Filter (Milestones, Approvals, Blocked) */}
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                    Task Type & State
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'all', label: 'All Types' },
                      { id: 'milestones_only', label: '💎 Milestones' },
                      { id: 'approvals_only', label: '🛡️ Approvals' },
                      { id: 'blocked_only', label: '🚫 Blocked' },
                      { id: 'blocking_only', label: '⏳ Blocking' }
                    ].map(type => (
                      <button
                        key={type.id}
                        onClick={() => setTaskType(type.id as any)}
                        className={`px-2 py-1 rounded-md text-left font-medium transition-colors ${
                          filters.taskType === type.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tags Filter */}
                {availableTags.length > 0 && (
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1.5">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map(tag => {
                        const isSelected = filters.tags.includes(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                            }`}
                          >
                            <TagIcon className="w-2.5 h-2.5" />
                            <span>{tag}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sort Button & Popover */}
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filters.sortBy !== 'order'
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <SortIcon className="w-3.5 h-3.5" />
              <span>Sort: {filters.sortBy === 'order' ? 'Default' : filters.sortBy}</span>
              <span className="text-[10px] text-gray-400 font-mono">
                {filters.sortDirection === 'asc' ? '↑' : '↓'}
              </span>
            </button>

            {showSortDropdown && (
              <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-2 z-50 text-xs space-y-1">
                {[
                  { id: 'order', label: 'Default / Manual Order' },
                  { id: 'dueDate', label: 'Due Date' },
                  { id: 'priority', label: 'Priority' },
                  { id: 'title', label: 'Alphabetical (Title)' },
                  { id: 'assignee', label: 'Assignee' },
                  { id: 'timeTracked', label: 'Time Tracked' },
                  { id: 'createdAt', label: 'Date Created' }
                ].map(sortOption => (
                  <button
                    key={sortOption.id}
                    onClick={() => {
                      setSort(sortOption.id as any);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors ${
                      filters.sortBy === sortOption.id
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{sortOption.label}</span>
                    {filters.sortBy === sortOption.id && (
                      <span className="font-mono text-xs">
                        {filters.sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Group By Button & Popover */}
          <div className="relative" ref={groupRef}>
            <button
              onClick={() => setShowGroupDropdown(!showGroupDropdown)}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filters.groupBy !== 'none'
                  ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              <GroupIcon className="w-3.5 h-3.5" />
              <span>Group: {filters.groupBy === 'none' ? 'None' : filters.groupBy}</span>
            </button>

            {showGroupDropdown && (
              <div className="absolute left-0 mt-2 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-2 z-50 text-xs space-y-1">
                {[
                  { id: 'none', label: 'No Grouping' },
                  { id: 'status', label: 'Status' },
                  { id: 'assignee', label: 'Assignee' },
                  { id: 'priority', label: 'Priority' },
                  { id: 'dueDate', label: 'Due Date' }
                ].map(groupOption => (
                  <button
                    key={groupOption.id}
                    onClick={() => {
                      onFilterChange({ ...filters, groupBy: groupOption.id as any });
                      setShowGroupDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left transition-colors ${
                      filters.groupBy === groupOption.id
                        ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                    }`}
                  >
                    <span>{groupOption.label}</span>
                    {filters.groupBy === groupOption.id && <CheckIcon className="w-3.5 h-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Quick Action Extensions (Timesheet, Automations, Export) */}
        <div className="flex items-center space-x-1.5">
          {onOpenTimesheet && (
            <button
              onClick={onOpenTimesheet}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="View Project Timesheets & Time Logs"
            >
              <ClockIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>Timesheet</span>
            </button>
          )}

          {onOpenRules && (
            <button
              onClick={onOpenRules}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="Workflow Automation Rules"
            >
              <span className="text-blue-500 font-bold text-xs">⚡</span>
              <span>Rules</span>
            </button>
          )}

          {onOpenForms && (
            <button
              onClick={onOpenForms}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="Project Intake Forms"
            >
              <span className="text-purple-500 font-bold text-xs">📝</span>
              <span>Forms</span>
            </button>
          )}

          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
              title="Export filtered tasks to CSV"
            >
              <DownloadIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Presets Row */}
      <div className="flex items-center flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-slate-800/80">
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 mr-1">
          Quick:
        </span>

        {currentUser && (
          <button
            onClick={() => {
              if (isMyTasksActive) {
                onFilterChange({ ...filters, assigneeIds: [] });
              } else {
                onFilterChange({ ...filters, assigneeIds: [currentUser.uid] });
              }
            }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              isMyTasksActive
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
            }`}
          >
            👤 My Tasks
          </button>
        )}

        <button
          onClick={() => {
            if (isDue24hActive) {
              onFilterChange({ ...filters, dueDatePreset: 'all' });
            } else {
              onFilterChange({ ...filters, dueDatePreset: 'due_24h' });
            }
          }}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isDue24hActive
              ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
              : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <FlameIcon className="w-3 h-3 text-orange-400" />
          <span>Due in 24h</span>
        </button>

        <button
          onClick={() => {
            if (isOverdueActive) {
              onFilterChange({ ...filters, dueDatePreset: 'all' });
            } else {
              onFilterChange({ ...filters, dueDatePreset: 'overdue' });
            }
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isOverdueActive
              ? 'bg-red-600 text-white border-red-600 shadow-xs'
              : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          ⚠️ Overdue
        </button>

        <button
          onClick={() => {
            if (isHighPriorityActive) {
              onFilterChange({ ...filters, priorities: [] });
            } else {
              onFilterChange({ ...filters, priorities: ['critical', 'high'] });
            }
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isHighPriorityActive
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          🔥 High & Critical
        </button>

        <button
          onClick={() => {
            if (isIncompleteActive) {
              onFilterChange({ ...filters, statuses: [] });
            } else {
              onFilterChange({ ...filters, statuses: ['To Do', 'In Progress'] });
            }
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isIncompleteActive
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          ⏳ Incomplete Only
        </button>

        <button
          onClick={() => {
            if (isMilestoneActive) {
              onFilterChange({ ...filters, taskType: 'all' });
            } else {
              onFilterChange({ ...filters, taskType: 'milestones_only' });
            }
          }}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isMilestoneActive
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
              : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          <DiamondIcon className="w-3 h-3 text-emerald-400" />
          <span>Milestones</span>
        </button>

        <button
          onClick={() => {
            if (isBlockedActive) {
              onFilterChange({ ...filters, taskType: 'all' });
            } else {
              onFilterChange({ ...filters, taskType: 'blocked_only' });
            }
          }}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isBlockedActive
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-gray-50 dark:bg-slate-800/60 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          🚫 Blocked Tasks
        </button>

        {/* Task Counter */}
        <div className="ml-auto text-xs text-gray-500 dark:text-slate-400 font-medium">
          Showing <span className="font-bold text-gray-900 dark:text-white">{filteredTaskCount}</span> of {totalTaskCount} tasks
        </div>
      </div>
    </div>
  );
};

export default TaskFilterBar;
