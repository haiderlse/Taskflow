import React, { useState, useEffect } from 'react';
import { Task, User, TimeEntry, Project } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  XIcon, 
  ClockIcon, 
  PlusIcon, 
  DownloadIcon, 
  DollarSignIcon, 
  TrashIcon, 
  EditIcon,
  CheckIcon,
  TagIcon
} from './icons';

interface TimesheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  users: User[];
  currentUser: User;
  projects?: Project[];
  selectedProjectId?: string;
}

export const TimesheetsModal: React.FC<TimesheetsModalProps> = ({
  isOpen,
  onClose,
  tasks,
  users,
  currentUser,
  projects = [],
  selectedProjectId
}) => {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'week' | 'month'>('all');

  // Manual Log Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formTaskId, setFormTaskId] = useState(tasks[0]?.id || '');
  const [formHours, setFormHours] = useState('');
  const [formMinutes, setFormMinutes] = useState('30');
  const [formCategory, setFormCategory] = useState<TimeEntry['category']>('Development');
  const [formIsBillable, setFormIsBillable] = useState(true);
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      loadAllTimeEntries();
    }
  }, [isOpen, tasks]);

  const loadAllTimeEntries = async () => {
    setLoading(true);
    try {
      // Gather time entries for all tasks
      const allTaskEntriesPromises = tasks.map(t => enhancedApi.getTimeEntriesForTask(t.id));
      const results = await Promise.all(allTaskEntriesPromises);
      const flat = results.flat().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      
      // If none exist yet, let's provide realistic mock time entries for demo data
      if (flat.length === 0 && tasks.length > 0) {
        const demoEntries: TimeEntry[] = [
          {
            id: 'demo-time-1',
            taskId: tasks[0].id,
            userId: currentUser.uid,
            duration: 180,
            description: 'Sprint planning and architecture review',
            startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 180 * 60000),
            createdAt: new Date(),
            isRunning: false,
            category: 'Development',
            isBillable: true
          },
          {
            id: 'demo-time-2',
            taskId: tasks[1]?.id || tasks[0].id,
            userId: users[1]?.uid || currentUser.uid,
            duration: 90,
            description: 'UI/UX mockups and design token adjustments',
            startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 90 * 60000),
            createdAt: new Date(),
            isRunning: false,
            category: 'Design',
            isBillable: true
          },
          {
            id: 'demo-time-3',
            taskId: tasks[2]?.id || tasks[0].id,
            userId: currentUser.uid,
            duration: 45,
            description: 'Stakeholder sync and approval sign-off',
            startTime: new Date(Date.now() - 4 * 60 * 60 * 1000),
            endTime: new Date(),
            createdAt: new Date(),
            isRunning: false,
            category: 'Meeting',
            isBillable: false
          }
        ];
        setEntries(demoEntries);
      } else {
        setEntries(flat);
      }
    } catch (e) {
      console.error('Failed to load timesheet entries:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleAddManualTime = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseInt(formHours || '0', 10);
    const m = parseInt(formMinutes || '0', 10);
    const totalMinutes = h * 60 + m;

    if (totalMinutes <= 0 || !formTaskId) return;

    try {
      const entry = await enhancedApi.createTimeEntry(
        formTaskId,
        currentUser.uid,
        totalMinutes,
        formDescription
      );
      entry.category = formCategory;
      entry.isBillable = formIsBillable;
      entry.startTime = new Date(formDate);

      setEntries(prev => [entry, ...prev]);
      setShowAddModal(false);
      setFormHours('');
      setFormMinutes('30');
      setFormDescription('');
    } catch (error) {
      console.error('Failed to log time:', error);
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  };

  // Filter entries
  const filteredEntries = entries.filter(e => {
    if (selectedUserFilter !== 'all' && e.userId !== selectedUserFilter) return false;
    if (selectedCategoryFilter !== 'all' && e.category !== selectedCategoryFilter) return false;
    
    if (dateRangeFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (new Date(e.startTime) < weekAgo) return false;
    } else if (dateRangeFilter === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (new Date(e.startTime) < monthAgo) return false;
    }
    return true;
  });

  // Analytics
  const totalMinutes = filteredEntries.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const billableMinutes = filteredEntries.filter(e => e.isBillable !== false).reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const billableHours = (billableMinutes / 60).toFixed(1);
  const nonBillableHours = ((totalMinutes - billableMinutes) / 60).toFixed(1);
  const billableRate = 85; // $85/hr standard enterprise rate
  const totalValue = (billableMinutes / 60) * billableRate;

  const exportCsv = () => {
    const headers = ['Task Title', 'Logged By', 'Date', 'Duration (Hours)', 'Duration (Minutes)', 'Category', 'Billable', 'Notes'];
    const rows = filteredEntries.map(e => {
      const t = tasks.find(x => x.id === e.taskId);
      const u = users.find(x => x.uid === e.userId);
      return [
        `"${t?.title || 'Unknown Task'}"`,
        `"${u?.displayName || 'Unknown'}"`,
        new Date(e.startTime).toLocaleDateString(),
        (e.duration / 60).toFixed(2),
        e.duration,
        e.category || 'General',
        e.isBillable !== false ? 'Yes' : 'No',
        `"${(e.description || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timesheet-report-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryColor = (cat?: string) => {
    switch (cat) {
      case 'Development': return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300';
      case 'Design': return 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300';
      case 'Review': return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300';
      case 'Meeting': return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300';
      case 'Testing': return 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300';
      case 'Bugfix': return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-800 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ClockIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Workspace Timesheets & Time Logs
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Track team hours, billable utilization, and project labor budgets.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Log Time</span>
            </button>

            <button
              onClick={exportCsv}
              className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Analytics Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-slate-50/50 dark:bg-slate-900/40 border-b border-gray-200 dark:border-slate-800">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Total Tracked</span>
            <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              {totalHours} <span className="text-sm font-medium text-gray-500">hrs</span>
            </div>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">{filteredEntries.length} log entries</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Billable Hours</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {billableHours} <span className="text-sm font-medium text-gray-500">hrs</span>
            </div>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">
              {totalMinutes > 0 ? ((billableMinutes / totalMinutes) * 100).toFixed(0) : 0}% utilization
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Non-Billable</span>
            <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
              {nonBillableHours} <span className="text-sm font-medium text-gray-500">hrs</span>
            </div>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">Internal ops & syncs</span>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-2xs">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Billable Value</span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <span className="text-[11px] text-gray-500 dark:text-slate-400">@ ${billableRate}/hr standard</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Team Member Filter */}
            <select
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Team Members</option>
              {users.map(u => (
                <option key={u.uid} value={u.uid}>{u.displayName}</option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
            >
              <option value="all">All Categories</option>
              {['Development', 'Design', 'Review', 'Meeting', 'Testing', 'Bugfix', 'Other'].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Date Range Tabs */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-lg">
              {(['all', 'week', 'month'] as const).map(preset => (
                <button
                  key={preset}
                  onClick={() => setDateRangeFilter(preset)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all ${
                    dateRangeFilter === preset
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900'
                  }`}
                >
                  {preset === 'all' ? 'All Time' : preset === 'week' ? 'Past 7 Days' : 'Past 30 Days'}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
            {filteredEntries.length} entries shown
          </span>
        </div>

        {/* Time Logs Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading timesheet records...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <ClockIcon className="w-10 h-10 mx-auto text-gray-300 dark:text-slate-600" />
              <p className="font-semibold text-gray-700 dark:text-slate-300">No time entries recorded</p>
              <p className="text-xs">Click "Log Time" or start a timer on any task to record hours.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 dark:text-slate-400 uppercase tracking-wider font-bold border-b border-gray-200 dark:border-slate-800 sticky top-0">
                <tr>
                  <th className="px-6 py-3">Task Name</th>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Billable</th>
                  <th className="px-6 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-200">
                {filteredEntries.map(entry => {
                  const task = tasks.find(t => t.id === entry.taskId);
                  const user = users.find(u => u.uid === entry.userId);
                  const hrs = Math.floor(entry.duration / 60);
                  const mins = entry.duration % 60;
                  const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-gray-900 dark:text-white max-w-xs truncate">
                        {task?.title || 'General Activity'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                            {user?.displayName.slice(0, 2).toUpperCase() || 'U'}
                          </div>
                          <span className="truncate">{user?.displayName || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 dark:text-slate-400">
                        {new Date(entry.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getCategoryColor(entry.category)}`}>
                          {entry.category || 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono font-bold text-gray-900 dark:text-white">
                        {durationStr}
                      </td>
                      <td className="px-4 py-3.5">
                        {entry.isBillable !== false ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                            <CheckIcon className="w-3 h-3" />
                            <span>Billable</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-500">
                            Non-billable
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-gray-500 dark:text-slate-400 max-w-sm truncate">
                        {entry.description || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete entry"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Modal Manual Log Popup */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs flex items-center justify-center z-60 p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700 mb-4">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Log Work Hours</h3>
                <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XIcon className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddManualTime} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">
                    Select Task <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formTaskId}
                    onChange={(e) => setFormTaskId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                    required
                  >
                    {tasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={formHours}
                      onChange={(e) => setFormHours(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Minutes</label>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formMinutes}
                      onChange={(e) => setFormMinutes(e.target.value)}
                      placeholder="e.g. 30"
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quick duration presets */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] text-gray-400 font-medium">Quick add:</span>
                  {[
                    { label: '+15m', h: 0, m: 15 },
                    { label: '+30m', h: 0, m: 30 },
                    { label: '+1h', h: 1, m: 0 },
                    { label: '+2h', h: 2, m: 0 },
                    { label: '+4h', h: 4, m: 0 }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setFormHours(preset.h.toString());
                        setFormMinutes(preset.m.toString());
                      }}
                      className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-[11px] font-semibold transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                    >
                      {['Development', 'Design', 'Review', 'Meeting', 'Testing', 'Bugfix', 'Other'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Date</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={formIsBillable}
                      onChange={(e) => setFormIsBillable(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-700"
                    />
                    <span className="font-bold text-gray-800 dark:text-slate-200">Billable client work</span>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Description / Notes</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe what tasks or deliverables were accomplished..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                  >
                    Save Time Log
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimesheetsModal;
