import React, { useState, useEffect, useMemo } from 'react';
import { User, Task, Project, AppNotification, NotificationType } from '../types';
import { notificationService } from '../services/notificationService';
import { useToast } from '../utils/ux';
import { 
  InboxIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  TrashIcon, 
  SearchIcon, 
  ChevronRightIcon,
  PlusIcon,
  FilterIcon,
  LockOpenIcon,
  SparklesIcon,
  CheckIcon,
  RefreshIcon
} from './icons';

interface InboxPageProps {
  currentUser?: User | null;
  allTasks?: Task[];
  projects?: Project[];
  users?: User[];
  onSelectTask?: (taskId: string, projectId?: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({
  currentUser,
  allTasks = [],
  projects = [],
  users = [],
  onSelectTask,
}) => {
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'assignments' | 'comments' | 'deadlines' | 'blockers' | 'approvals'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotifId, setSelectedNotifId] = useState<string | null>(null);
  const [showSimulateMenu, setShowSimulateMenu] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const effectiveUserId = currentUser?.uid || 'user-1';

  // Real-time notification subscription
  useEffect(() => {
    const unsubscribe = notificationService.subscribe(effectiveUserId, (updatedList) => {
      setNotifications(updatedList);
    });

    // Auto-scan approaching deadlines on component mount
    if (allTasks.length > 0) {
      notificationService.scanDeadlines(allTasks, projects);
    }

    return () => {
      unsubscribe();
    };
  }, [effectiveUserId, allTasks, projects]);

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    notificationService.markAsRead(id, effectiveUserId);
  };

  const handleMarkAsUnread = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    notificationService.markAsUnread(id, effectiveUserId);
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead(effectiveUserId);
    addToast({
      type: 'success',
      title: 'Inbox Cleared',
      message: 'All notifications marked as read.'
    });
  };

  const handleArchive = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    notificationService.archiveNotification(id, effectiveUserId);
    if (selectedNotifId === id) {
      setSelectedNotifId(null);
    }
    addToast({
      type: 'info',
      title: 'Notification Dismissed',
      message: 'Notification removed from your feed.'
    });
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to clear all notifications for this workspace?')) {
      notificationService.clearAll(effectiveUserId);
      addToast({
        type: 'info',
        title: 'Inbox Cleared',
        message: 'All notifications have been cleared.'
      });
    }
  };

  const handleScanDeadlines = () => {
    setIsScanning(true);
    notificationService.scanDeadlines(allTasks, projects);
    setTimeout(() => {
      setIsScanning(false);
      addToast({
        type: 'success',
        title: 'Deadline Sentinel Scan Complete',
        message: 'Scanned active tasks for approaching due dates and overdue milestones.'
      });
    }, 400);
  };

  const handleSimulateNotification = (type: NotificationType) => {
    if (!currentUser) return;
    const simulated = notificationService.simulateLiveNotification(
      currentUser, 
      type, 
      allTasks, 
      users
    );
    setShowSimulateMenu(false);
    addToast({
      type: 'info',
      title: '🔔 Real-Time Notification Received',
      message: simulated.message
    });
  };

  const handleOpenTask = (notif: AppNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleMarkAsRead(notif.id);
    if (notif.taskId && onSelectTask) {
      onSelectTask(notif.taskId, notif.projectId);
    }
  };

  // Filter and search notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Filter tab
      if (activeFilter === 'unread' && n.isRead) return false;
      if (activeFilter === 'assignments' && n.type !== 'assignment') return false;
      if (activeFilter === 'comments' && n.type !== 'comment' && n.type !== 'mention') return false;
      if (activeFilter === 'deadlines' && n.type !== 'deadline_approaching' && n.type !== 'deadline_overdue') return false;
      if (activeFilter === 'blockers' && n.type !== 'blocker_cleared' && n.type !== 'blocked') return false;
      if (activeFilter === 'approvals' && n.type !== 'approval') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title.toLowerCase().includes(q);
        const matchesMsg = n.message.toLowerCase().includes(q);
        const matchesTask = n.taskTitle?.toLowerCase().includes(q);
        const matchesAuthor = n.authorName.toLowerCase().includes(q);
        const matchesProject = n.projectName?.toLowerCase().includes(q);
        return matchesTitle || matchesMsg || matchesTask || matchesAuthor || matchesProject;
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const assignmentCount = notifications.filter(n => n.type === 'assignment' && !n.isRead).length;
  const commentCount = notifications.filter(n => (n.type === 'comment' || n.type === 'mention') && !n.isRead).length;
  const deadlineCount = notifications.filter(n => (n.type === 'deadline_approaching' || n.type === 'deadline_overdue') && !n.isRead).length;

  const formatRelativeTime = (date: Date) => {
    const now = new Date().getTime();
    const target = new Date(date).getTime();
    const diffSec = Math.floor((now - target) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getTypeBadge = (type: NotificationType) => {
    switch (type) {
      case 'assignment':
        return {
          label: 'Task Assignment',
          icon: '📋',
          bg: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
        };
      case 'comment':
        return {
          label: 'Comment',
          icon: '💬',
          bg: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
      case 'mention':
        return {
          label: '@Mention',
          icon: '📣',
          bg: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
        };
      case 'deadline_approaching':
        return {
          label: 'Approaching Deadline',
          icon: '⏰',
          bg: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        };
      case 'deadline_overdue':
        return {
          label: 'Overdue Deadline',
          icon: '🚨',
          bg: 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        };
      case 'blocker_cleared':
        return {
          label: 'Prerequisite Unblocked',
          icon: '🔓',
          bg: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        };
      case 'blocked':
        return {
          label: 'Task Blocked',
          icon: '⛔',
          bg: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        };
      case 'approval':
        return {
          label: 'Approval Request',
          icon: '⚖️',
          bg: 'bg-teal-100 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
        };
      default:
        return {
          label: 'Update',
          icon: '🔄',
          bg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
    }
  };

  const selectedNotif = notifications.find(n => n.id === selectedNotifId);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden select-none">
      {/* Header Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-4 shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/40">
            <InboxIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                Activity Inbox
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white shadow-xs">
                  {unreadCount} new
                </span>
              )}
              {/* Real-time pulse indicator */}
              <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Feed</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Real-time feed for task assignments, discussion comments, mentions, and deadline alerts.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {/* Scan Deadlines Button */}
          <button
            onClick={handleScanDeadlines}
            disabled={isScanning}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-xs"
            title="Scan upcoming task deadlines"
          >
            <ClockIcon className={`w-3.5 h-3.5 text-amber-500 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Scan Deadlines</span>
          </button>

          {/* Test / Simulate Trigger Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSimulateMenu(!showSimulateMenu)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Alert</span>
            </button>

            {showSimulateMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-50 text-xs">
                <div className="px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-slate-700">
                  Trigger Real-Time Notification
                </div>
                <button
                  onClick={() => handleSimulateNotification('assignment')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>📋</span>
                  <span>New Task Assigned</span>
                </button>
                <button
                  onClick={() => handleSimulateNotification('comment')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>💬</span>
                  <span>New Comment Added</span>
                </button>
                <button
                  onClick={() => handleSimulateNotification('mention')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>📣</span>
                  <span>@Mention in Discussion</span>
                </button>
                <button
                  onClick={() => handleSimulateNotification('deadline_approaching')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>⏰</span>
                  <span>Deadline Approaching</span>
                </button>
                <button
                  onClick={() => handleSimulateNotification('deadline_overdue')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>🚨</span>
                  <span>Overdue Deadline Alert</span>
                </button>
                <button
                  onClick={() => handleSimulateNotification('blocker_cleared')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>🔓</span>
                  <span>Prerequisite Unblocked</span>
                </button>
                <button
                  onClick={() => handleSimulateNotification('approval')}
                  className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 flex items-center space-x-2 font-medium"
                >
                  <span>⚖️</span>
                  <span>Approval Requested</span>
                </button>
              </div>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors shadow-xs"
            >
              Mark all as read
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Clear all notifications"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        {/* Category Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'all' 
                ? 'bg-blue-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeFilter === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
            }`}>
              {notifications.length}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'unread' 
                ? 'bg-blue-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeFilter === 'unread' ? 'bg-blue-700 text-white' : 'bg-rose-500 text-white font-bold'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('assignments')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'assignments' 
                ? 'bg-purple-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>📋 Assignments</span>
            {assignmentCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200 text-purple-800 font-bold">
                {assignmentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('comments')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'comments' 
                ? 'bg-blue-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>💬 Comments & @Mentions</span>
            {commentCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-200 text-blue-800 font-bold">
                {commentCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('deadlines')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'deadlines' 
                ? 'bg-amber-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>⏰ Deadlines</span>
            {deadlineCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-bold">
                {deadlineCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveFilter('blockers')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'blockers' 
                ? 'bg-emerald-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>🔓 Dependencies</span>
          </button>

          <button
            onClick={() => setActiveFilter('approvals')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center space-x-1.5 ${
              activeFilter === 'approvals' 
                ? 'bg-teal-600 text-white font-bold shadow-xs' 
                : 'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>⚖️ Approvals</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex items-center">
          <SearchIcon className="w-3.5 h-3.5 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search feed..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="text-xs pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-xl border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 outline-none w-48 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Feed Content Area */}
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(notif => {
            const typeBadge = getTypeBadge(notif.type);
            const isSelected = selectedNotifId === notif.id;

            return (
              <div
                key={notif.id}
                onClick={() => {
                  setSelectedNotifId(isSelected ? null : notif.id);
                  if (!notif.isRead) {
                    handleMarkAsRead(notif.id);
                  }
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                  !notif.isRead 
                    ? 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/60 shadow-sm ring-1 ring-blue-500/10' 
                    : 'bg-white/80 dark:bg-slate-900/70 border-gray-200/80 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900'
                } ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
              >
                {/* Left unread bar indicator */}
                {!notif.isRead && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-600 rounded-r" />
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    {/* Category Icon Badge */}
                    <div className="flex flex-col items-center shrink-0 space-y-1">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-xs border ${typeBadge.bg}`}>
                        {typeBadge.icon}
                      </span>
                    </div>

                    {/* Notification Body */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeBadge.bg}`}>
                          {typeBadge.label}
                        </span>

                        <h3 className={`text-xs font-bold ${!notif.isRead ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-slate-300'}`}>
                          {notif.title}
                        </h3>

                        <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">
                          • {formatRelativeTime(notif.timestamp)}
                        </span>
                      </div>

                      {/* Main Notification Message */}
                      <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed font-normal">
                        {notif.message}
                      </p>

                      {/* Extra Details / Comment Snippet if available */}
                      {notif.details && notif.details !== notif.message && (
                        <div className="mt-1 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-gray-100 dark:border-slate-800 text-[11px] text-gray-600 dark:text-slate-400 italic">
                          "{notif.details}"
                        </div>
                      )}

                      {/* Associated Task / Project Link Pill */}
                      <div className="pt-1 flex items-center space-x-2 flex-wrap gap-1 text-xs">
                        {notif.taskTitle && (
                          <button
                            onClick={(e) => handleOpenTask(notif, e)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-100 dark:border-blue-800/60 text-blue-700 dark:text-blue-300 font-bold transition-colors"
                          >
                            <span className="text-[10px] text-blue-500">Task:</span>
                            <span className="truncate max-w-xs">{notif.taskTitle}</span>
                            <ChevronRightIcon className="w-3 h-3 text-blue-500 shrink-0" />
                          </button>
                        )}

                        {notif.projectName && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium">
                            <span>in</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{notif.projectName}</span>
                          </span>
                        )}

                        {notif.authorName && notif.authorName !== 'System Monitor' && notif.authorName !== 'Deadline Sentinel' && (
                          <span className="text-[10px] text-gray-400 dark:text-slate-500">
                            by {notif.authorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Open task, Mark read/unread, Dismiss) */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {notif.taskId && (
                      <button
                        onClick={(e) => handleOpenTask(notif, e)}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors hidden sm:flex items-center space-x-1"
                      >
                        <span>Open</span>
                        <ChevronRightIcon className="w-3 h-3" />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        if (notif.isRead) {
                          handleMarkAsUnread(notif.id, e);
                        } else {
                          handleMarkAsRead(notif.id, e);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                      title={notif.isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {notif.isRead ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 block" />
                      ) : (
                        <CheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleArchive(notif.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                      title="Archive Notification"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          /* Empty State */
          <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-xs space-y-3 px-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center border border-rose-100 dark:border-rose-900/40">
              <InboxIcon className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {activeFilter === 'unread' ? 'Zero Unread Notifications' : 'All caught up!'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 max-w-sm mx-auto">
                {activeFilter === 'unread' 
                  ? 'You have read all current notifications. New activity will arrive here in real time.'
                  : activeFilter === 'deadlines'
                  ? 'No approaching deadlines or overdue tasks detected. All milestones on track!'
                  : 'No notifications matching this filter. Switch tabs or trigger a simulated test alert above.'}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center space-x-2">
              <button
                onClick={() => handleSimulateNotification('assignment')}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Trigger Test Notification
              </button>
              {activeFilter !== 'all' && (
                <button
                  onClick={() => setActiveFilter('all')}
                  className="px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  View All Notifications
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InboxPage;
