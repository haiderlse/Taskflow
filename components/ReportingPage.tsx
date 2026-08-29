import React, { useState, useEffect, useMemo } from 'react';
import { User, Project, Task, Priority } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  ReportingIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  AlertTriangleIcon, 
  FolderIcon, 
  UsersIcon, 
  PlusIcon, 
  FilterIcon, 
  ShareIcon, 
  DownloadIcon,
  XIcon,
  DiamondIcon,
  LockClosedIcon,
  TagIcon
} from './icons';

interface ReportingPageProps {
  currentUser?: User | null;
  users?: User[];
  projects?: Project[];
}

interface CustomChartConfig {
  id: string;
  title: string;
  type: 'bar' | 'donut' | 'progress';
  groupBy: 'status' | 'priority' | 'assignee' | 'project';
  filterProject?: string;
}

export const ReportingPage: React.FC<ReportingPageProps> = ({ 
  currentUser, 
  users = [],
  projects = []
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>(projects);
  const [allUsers, setAllUsers] = useState<User[]>(users);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'executive' | 'workload' | 'projects' | 'risks'>('executive');
  
  // Custom Charts
  const [customCharts, setCustomCharts] = useState<CustomChartConfig[]>([
    { id: 'cc-1', title: 'Task Distribution by Status', type: 'donut', groupBy: 'status' },
    { id: 'cc-2', title: 'Priority Load Breakdown', type: 'bar', groupBy: 'priority' }
  ]);
  const [showAddChartModal, setShowAddChartModal] = useState(false);
  const [newChartTitle, setNewChartTitle] = useState('');
  const [newChartType, setNewChartType] = useState<'bar' | 'donut' | 'progress'>('bar');
  const [newChartGroupBy, setNewChartGroupBy] = useState<'status' | 'priority' | 'assignee' | 'project'>('status');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedTasks, fetchedProjects, fetchedUsers] = await Promise.all([
        enhancedApi.getTasks(),
        enhancedApi.getProjects(),
        enhancedApi.getUsers()
      ]);
      setTasks(fetchedTasks);
      setAllProjects(fetchedProjects);
      setAllUsers(fetchedUsers);
    } catch (err) {
      console.error('Failed to load reporting data', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on selected filters
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (selectedProjectId !== 'all' && t.projectId !== selectedProjectId) return false;
      if (selectedAssigneeId !== 'all' && t.assigneeId !== selectedAssigneeId) return false;
      
      if (timeRange !== 'all') {
        const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const taskDate = t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt);
        if (taskDate < cutoff) return false;
      }
      return true;
    });
  }, [tasks, selectedProjectId, selectedAssigneeId, timeRange]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'Done');
    const inProgress = filteredTasks.filter(t => t.status === 'In Progress');
    const todo = filteredTasks.filter(t => !t.status || t.status === 'To Do');
    
    const now = new Date();
    const overdue = filteredTasks.filter(t => t.status !== 'Done' && t.dueDate && new Date(t.dueDate) < now);
    const blocked = filteredTasks.filter(t => t.status !== 'Done' && ((t.blockedBy && t.blockedBy.length > 0) || (t.dependencies && t.dependencies.length > 0)));
    const milestones = filteredTasks.filter(t => t.isMilestone);
    const milestonesCompleted = milestones.filter(t => t.status === 'Done');

    const totalMinutesTracked = filteredTasks.reduce((sum, t) => sum + (t.timeTracked || 0), 0);
    const totalMinutesEstimated = filteredTasks.reduce((sum, t) => sum + (t.estimatedTime || 0), 0);
    
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;
    
    const onTrackProjects = allProjects.filter(p => !p.healthStatus || p.healthStatus === 'on_track').length;
    const projectHealthPct = allProjects.length > 0 ? Math.round((onTrackProjects / allProjects.length) * 100) : 100;

    return {
      total,
      completed: completed.length,
      inProgress: inProgress.length,
      todo: todo.length,
      overdue: overdue.length,
      blocked: blocked.length,
      milestones: milestones.length,
      milestonesCompleted: milestonesCompleted.length,
      hoursTracked: (totalMinutesTracked / 60).toFixed(1),
      hoursEstimated: (totalMinutesEstimated / 60).toFixed(1),
      completionRate,
      projectHealthPct,
      onTrackProjects,
      totalProjects: allProjects.length
    };
  }, [filteredTasks, allProjects]);

  // Groupings for charts
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = { 'To Do': 0, 'In Progress': 0, 'Done': 0 };
    filteredTasks.forEach(t => {
      const s = t.status || 'To Do';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [filteredTasks]);

  const priorityDistribution = useMemo(() => {
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    filteredTasks.forEach(t => {
      const p = (t.priority || 'medium') as Priority;
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [filteredTasks]);

  const userWorkloads = useMemo(() => {
    return allUsers.map(u => {
      const userTasks = filteredTasks.filter(t => t.assigneeId === u.uid);
      const userCompleted = userTasks.filter(t => t.status === 'Done');
      const userOverdue = userTasks.filter(t => t.status !== 'Done' && t.dueDate && new Date(t.dueDate) < new Date());
      const hoursLogged = (userTasks.reduce((acc, t) => acc + (t.timeTracked || 0), 0) / 60).toFixed(1);
      
      return {
        user: u,
        totalTasks: userTasks.length,
        completedTasks: userCompleted.length,
        openTasks: userTasks.length - userCompleted.length,
        overdueTasks: userOverdue.length,
        hoursLogged
      };
    });
  }, [allUsers, filteredTasks]);

  const projectProgress = useMemo(() => {
    return allProjects.map(p => {
      const pTasks = tasks.filter(t => t.projectId === p.id);
      const pCompleted = pTasks.filter(t => t.status === 'Done');
      const rate = pTasks.length > 0 ? Math.round((pCompleted.length / pTasks.length) * 100) : 0;
      const hours = (pTasks.reduce((acc, t) => acc + (t.timeTracked || 0), 0) / 60).toFixed(1);

      return {
        project: p,
        totalTasks: pTasks.length,
        completedTasks: pCompleted.length,
        completionRate: rate,
        hoursLogged: hours,
        health: p.healthStatus || 'on_track'
      };
    });
  }, [allProjects, tasks]);

  const handleExportCsv = () => {
    const headers = ['Task ID', 'Title', 'Project', 'Status', 'Priority', 'Assignee', 'Due Date', 'Hours Tracked', 'Is Milestone'];
    const rows = filteredTasks.map(t => {
      const p = allProjects.find(x => x.id === t.projectId)?.name || t.projectId;
      const u = allUsers.find(x => x.uid === t.assigneeId)?.displayName || 'Unassigned';
      return [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        `"${p.replace(/"/g, '""')}"`,
        t.status || 'To Do',
        t.priority || 'medium',
        `"${u.replace(/"/g, '""')}"`,
        t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
        ((t.timeTracked || 0) / 60).toFixed(1),
        t.isMilestone ? 'Yes' : 'No'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `asana-flow-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report CSV successfully generated and downloaded!');
  };

  const handleAddCustomChart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChartTitle.trim()) return;

    const newChart: CustomChartConfig = {
      id: `cc-${Date.now()}`,
      title: newChartTitle.trim(),
      type: newChartType,
      groupBy: newChartGroupBy
    };

    setCustomCharts(prev => [...prev, newChart]);
    setNewChartTitle('');
    setShowAddChartModal(false);
    showToast('Custom chart widget added to dashboard!');
  };

  const handleRemoveChart = (id: string) => {
    setCustomCharts(prev => prev.filter(c => c.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 text-sm">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Generating strategic reports & dashboards...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col transition-colors">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center space-x-2 animate-bounce">
          <CheckCircleIcon className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ReportingIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Strategic Flow & Reporting
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Cross-project health, velocity metrics, workload distribution, and audit summaries.
              </p>
            </div>
          </div>
        </div>

        {/* Global Report Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddChartModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-xl border border-blue-200 dark:border-blue-800 transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Add Chart</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 rounded-xl border border-gray-200 dark:border-slate-700 transition-colors shadow-2xs"
          >
            <DownloadIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
          >
            <ShareIcon className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </header>

      {/* Filter and View Control Bar */}
      <div className="bg-white dark:bg-slate-900/80 border-b border-gray-200 dark:border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'executive', label: 'Executive KPIs' },
            { id: 'workload', label: 'Team Workload' },
            { id: 'projects', label: 'Projects Health' },
            { id: 'risks', label: 'Blockers & Risks' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 font-medium focus:ring-1 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days (Quarter)</option>
            <option value="all">All Time</option>
          </select>

          {/* Project Filter */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 font-medium focus:ring-1 focus:ring-blue-500 max-w-[160px] truncate"
          >
            <option value="all">All Projects ({allProjects.length})</option>
            {allProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={selectedAssigneeId}
            onChange={(e) => setSelectedAssigneeId(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 font-medium focus:ring-1 focus:ring-blue-500 max-w-[150px] truncate"
          >
            <option value="all">All Teammates ({allUsers.length})</option>
            {allUsers.map(u => (
              <option key={u.uid} value={u.uid}>{u.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* KPI Summary Cards */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-gray-500 dark:text-slate-400 block uppercase tracking-wider">
              Total Scope
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{metrics.total}</span>
              <span className="text-[11px] text-gray-400 font-medium">tasks</span>
            </div>
            <div className="mt-2 w-full bg-gray-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${metrics.completionRate}%` }} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider">
              Completed
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.completed}</span>
              <span className="text-[11px] text-emerald-600/80 font-bold">{metrics.completionRate}% rate</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">{metrics.inProgress} currently in progress</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 block uppercase tracking-wider">
              Overdue Tasks
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{metrics.overdue}</span>
              <span className="text-[11px] text-rose-500 font-medium">past due</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Needs immediate attention</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block uppercase tracking-wider">
              Blocked / At Risk
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{metrics.blocked}</span>
              <span className="text-[11px] text-amber-600 font-medium">blocked</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Has upstream dependencies</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 block uppercase tracking-wider">
              Time Tracked
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{metrics.hoursTracked}</span>
              <span className="text-[11px] text-gray-400 font-medium">hrs logged</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Est: {metrics.hoursEstimated} hrs</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 block uppercase tracking-wider">
              Project Health
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{metrics.projectHealthPct}%</span>
              <span className="text-[11px] text-emerald-600 font-bold">On Track</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">{metrics.onTrackProjects} of {metrics.totalProjects} healthy</p>
          </div>
        </section>

        {/* Tab 1: Executive KPIs and Visual Breakdown */}
        {activeTab === 'executive' && (
          <div className="space-y-6">
            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chart 1: Workflow Stage Distribution */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Workflow Status Breakdown</h3>
                  <span className="text-xs text-gray-400 font-semibold">{filteredTasks.length} tasks</span>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-600 dark:text-slate-400">To Do</span>
                      <span className="text-gray-900 dark:text-white">{statusDistribution['To Do'] || 0} ({filteredTasks.length ? Math.round(((statusDistribution['To Do'] || 0)/filteredTasks.length)*100) : 0}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-slate-500 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((statusDistribution['To Do'] || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-blue-600 dark:text-blue-400">In Progress</span>
                      <span className="text-gray-900 dark:text-white">{statusDistribution['In Progress'] || 0} ({filteredTasks.length ? Math.round(((statusDistribution['In Progress'] || 0)/filteredTasks.length)*100) : 0}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((statusDistribution['In Progress'] || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-emerald-600 dark:text-emerald-400">Completed (Done)</span>
                      <span className="text-gray-900 dark:text-white">{statusDistribution['Done'] || 0} ({filteredTasks.length ? Math.round(((statusDistribution['Done'] || 0)/filteredTasks.length)*100) : 0}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-emerald-500 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((statusDistribution['Done'] || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 dark:border-slate-800 text-center">
                  <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <span className="text-[10px] text-gray-400 font-bold block">Backlog</span>
                    <span className="text-sm font-black text-gray-800 dark:text-slate-200">{statusDistribution['To Do'] || 0}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40">
                    <span className="text-[10px] text-blue-600 font-bold block">Active</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{statusDistribution['In Progress'] || 0}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40">
                    <span className="text-[10px] text-emerald-600 font-bold block">Finished</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{statusDistribution['Done'] || 0}</span>
                  </div>
                </div>
              </div>

              {/* Chart 2: Priority Load Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">Priority Distribution</h3>
                  <span className="text-xs text-gray-400 font-semibold">Urgency Index</span>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-rose-600 dark:text-rose-400">Critical</span>
                      <span className="text-gray-900 dark:text-white">{priorityDistribution.critical || 0} tasks</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-rose-500 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((priorityDistribution.critical || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-amber-600 dark:text-amber-400">High</span>
                      <span className="text-gray-900 dark:text-white">{priorityDistribution.high || 0} tasks</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-amber-500 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((priorityDistribution.high || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-blue-600 dark:text-blue-400">Medium</span>
                      <span className="text-gray-900 dark:text-white">{priorityDistribution.medium || 0} tasks</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((priorityDistribution.medium || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-slate-500 dark:text-slate-400">Low</span>
                      <span className="text-gray-900 dark:text-white">{priorityDistribution.low || 0} tasks</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-slate-400 h-3 rounded-full" style={{ width: `${filteredTasks.length ? ((priorityDistribution.low || 0)/filteredTasks.length)*100 : 0}%` }} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-slate-400 pt-3 border-t border-gray-100 dark:border-slate-800">
                  <span>High Impact Ratio:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {filteredTasks.length ? Math.round((((priorityDistribution.critical || 0) + (priorityDistribution.high || 0)) / filteredTasks.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Custom User Charts Section */}
            {customCharts.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Configured Dashboard Widgets</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customCharts.map(chart => (
                    <div key={chart.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs relative group">
                      <button
                        onClick={() => handleRemoveChart(chart.id)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors p-1"
                        title="Remove Widget"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>

                      <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                        {chart.title}
                      </h4>

                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-500">Group By:</span>
                          <span className="capitalize font-bold text-gray-900 dark:text-white">{chart.groupBy}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-500">Visualization:</span>
                          <span className="capitalize font-bold text-blue-600 dark:text-blue-400">{chart.type}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-500">Sample Count:</span>
                          <span className="font-bold text-gray-900 dark:text-white">{filteredTasks.length} elements</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Team Workload Matrix */}
        {activeTab === 'workload' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Teammate Output & Utilization</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Distribution of open tasks, completions, and hours recorded per team member.
                </p>
              </div>
              <span className="text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full">
                {allUsers.length} Teammates
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-800 text-gray-400 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Teammate</th>
                    <th className="pb-3 text-center">Role / Dept</th>
                    <th className="pb-3 text-center">Assigned</th>
                    <th className="pb-3 text-center">Completed</th>
                    <th className="pb-3 text-center">Overdue</th>
                    <th className="pb-3 text-center">Hours Logged</th>
                    <th className="pb-3 text-right pr-2">Completion %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {userWorkloads.map(({ user, totalTasks, completedTasks, openTasks, overdueTasks, hoursLogged }) => {
                    const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    return (
                      <tr key={user.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 pl-2 font-bold text-gray-900 dark:text-white flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                            {user.displayName.charAt(0)}
                          </div>
                          <div>
                            <div>{user.displayName}</div>
                            <div className="text-[10px] text-gray-400 font-normal">{user.email}</div>
                          </div>
                        </td>
                        <td className="py-3.5 text-center text-gray-600 dark:text-slate-400 font-medium">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] capitalize">
                            {user.role || 'member'}
                          </span>
                        </td>
                        <td className="py-3.5 text-center font-bold text-gray-900 dark:text-white">{totalTasks}</td>
                        <td className="py-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">{completedTasks}</td>
                        <td className="py-3.5 text-center font-bold">
                          {overdueTasks > 0 ? (
                            <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md font-bold">
                              {overdueTasks}
                            </span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-3.5 text-center font-bold text-purple-600 dark:text-purple-400">{hoursLogged} h</td>
                        <td className="py-3.5 text-right pr-2">
                          <div className="flex items-center justify-end space-x-2">
                            <span className="font-bold text-gray-900 dark:text-white">{rate}%</span>
                            <div className="w-16 bg-gray-100 dark:bg-slate-800 rounded-full h-1.5">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Projects Health Matrix */}
        {activeTab === 'projects' && (
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-900 dark:text-white">Workspace Projects & Milestones</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Comprehensive progress overview across all organizational initiatives.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projectProgress.map(({ project, totalTasks, completedTasks, completionRate, hoursLogged, health }) => {
                const getHealthBadge = (h: string) => {
                  switch (h) {
                    case 'at_risk': return { text: 'At Risk', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
                    case 'off_track': return { text: 'Off Track', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
                    case 'completed': return { text: 'Completed', bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' };
                    default: return { text: 'On Track', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
                  }
                };
                const badge = getHealthBadge(health);

                return (
                  <div key={project.id} className="border border-gray-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-3.5 h-3.5 rounded-full ${project.color || 'bg-blue-600'}`} />
                        <h4 className="font-black text-sm text-gray-900 dark:text-white">{project.name}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg}`}>
                        {badge.text}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                      <span>{completedTasks} of {totalTasks} tasks completed</span>
                      <span className="font-bold text-gray-900 dark:text-white">{completionRate}%</span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                      <span>{hoursLogged} hours logged</span>
                      <span>{(project.customFields || []).length} custom fields</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Blockers & Risk Radar */}
        {activeTab === 'risks' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overdue Tasks List */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangleIcon className="w-4 h-4 text-rose-500" />
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Overdue Tasks</h3>
                  </div>
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                    {metrics.overdue} Critical
                  </span>
                </div>

                {metrics.overdue > 0 ? (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {filteredTasks
                      .filter(t => t.status !== 'Done' && t.dueDate && new Date(t.dueDate) < new Date())
                      .map(t => {
                        const assignee = allUsers.find(u => u.uid === t.assigneeId);
                        const proj = allProjects.find(p => p.id === t.projectId);
                        return (
                          <div key={t.id} className="p-3 rounded-xl border border-rose-100 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold text-gray-900 dark:text-white">{t.title}</p>
                              <p className="text-[10px] text-gray-400">
                                {proj?.name} • Due {new Date(t.dueDate!).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-bold text-[10px]">
                              {assignee?.displayName || 'Unassigned'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No overdue tasks found. All schedules are on time!
                  </div>
                )}
              </div>

              {/* Blocked Dependencies List */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <LockClosedIcon className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-black text-gray-900 dark:text-white">Blocked by Dependencies</h3>
                  </div>
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                    {metrics.blocked} Blocked
                  </span>
                </div>

                {metrics.blocked > 0 ? (
                  <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                    {filteredTasks
                      .filter(t => t.status !== 'Done' && ((t.blockedBy && t.blockedBy.length > 0) || (t.dependencies && t.dependencies.length > 0)))
                      .map(t => {
                        const blockerCount = (t.blockedBy || t.dependencies || []).length;
                        return (
                          <div key={t.id} className="p-3 rounded-xl border border-amber-100 dark:border-amber-950/60 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{t.title}</p>
                              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                                Waiting on {blockerCount} prerequisite task{blockerCount > 1 ? 's' : ''}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 font-bold text-[10px]">
                              Blocked
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 text-xs italic">
                    No tasks are currently blocked by dependencies.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Custom Chart Modal */}
      {showAddChartModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-gray-900 dark:text-white">Add Custom Dashboard Chart</h3>
              <button onClick={() => setShowAddChartModal(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomChart} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Chart Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Marketing Task Velocity"
                  value={newChartTitle}
                  onChange={(e) => setNewChartTitle(e.target.value)}
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Visualization Style</label>
                <select
                  value={newChartType}
                  onChange={(e) => setNewChartType(e.target.value as any)}
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="bar">Bar Chart</option>
                  <option value="donut">Donut Distribution</option>
                  <option value="progress">Progress Scorecard</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-slate-300 mb-1">Group By Dimension</label>
                <select
                  value={newChartGroupBy}
                  onChange={(e) => setNewChartGroupBy(e.target.value as any)}
                  className="w-full border border-gray-300 dark:border-slate-700 rounded-xl p-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                >
                  <option value="status">Workflow Status</option>
                  <option value="priority">Priority Level</option>
                  <option value="assignee">Team Assignee</option>
                  <option value="project">Project Workspace</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddChartModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 font-bold hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Add Widget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportingPage;
