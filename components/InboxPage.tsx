import React, { useState, useMemo } from 'react';
import { User, Task } from '../types';
import { 
  InboxIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  LockClosedIcon, 
  LockOpenIcon, 
  TrashIcon, 
  FilterIcon, 
  SearchIcon, 
  ChevronRightIcon 
} from './icons';

interface NotificationItem {
  id: string;
  type: 'mention' | 'assignment' | 'blocker_cleared' | 'blocked' | 'status_change' | 'approval';
  title: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: Date;
  isRead: boolean;
}

interface InboxPageProps {
  currentUser?: User | null;
  onSelectTask?: (taskId: string) => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({
  currentUser,
  onSelectTask,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      type: 'blocker_cleared',
      title: 'Prerequisite Unblocked',
      message: 'Ali completed "Follow up on Pharma Receivables Plan". You can now begin work on "IBP - Forecasting".',
      taskId: 'task-3',
      taskTitle: 'IBP - Forecasting to Process & Priorities',
      authorName: 'Ali',
      timestamp: new Date(Date.now() - 1000 * 60 * 25), // 25 mins ago
      isRead: false,
    },
    {
      id: 'notif-2',
      type: 'mention',
      title: 'Mentioned in comment',
      message: 'Bob mentioned you: "@Ali can you review the delivery timeline before our client sync today?"',
      taskId: 'task-1',
      taskTitle: 'Follow up on Pharma Receivables Plan',
      authorName: 'Bob',
      timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      isRead: false,
    },
    {
      id: 'notif-3',
      type: 'assignment',
      title: 'New Task Assigned',
      message: 'You have been assigned to "Dvago Enterprise Integration Sprint".',
      taskId: 'task-4',
      taskTitle: 'Dvago Enterprise Integration Sprint',
      authorName: 'Charlie',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      isRead: true,
    },
    {
      id: 'notif-4',
      type: 'blocked',
      title: 'Task Blocked Alert',
      message: '"Follow up on FW: MOM Route 2" is currently blocked waiting on predecessor task completion.',
      taskId: 'task-2',
      taskTitle: 'Follow up on FW: MOM Route 2 Health x DVAGO 20-Nov-2024',
      authorName: 'System',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      isRead: true,
    },
    {
      id: 'notif-5',
      type: 'approval',
      title: 'Approval Request',
      message: 'Bob submitted an approval request for "Q1 Budget Allocation Proposal".',
      taskId: 'task-5',
      taskTitle: 'Q1 Budget Allocation Proposal',
      authorName: 'Bob',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36), // 1.5 days ago
      isRead: true,
    }
  ]);

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'mentions' | 'blockers' | 'assignments'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleArchive = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Filter by type
      if (activeFilter === 'unread' && n.isRead) return false;
      if (activeFilter === 'mentions' && n.type !== 'mention') return false;
      if (activeFilter === 'blockers' && n.type !== 'blocked' && n.type !== 'blocker_cleared') return false;
      if (activeFilter === 'assignments' && n.type !== 'assignment') return false;

      // Text search
      const q = searchQuery.toLowerCase();
      return !q || n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q) || n.authorName.toLowerCase().includes(q);
    });
  }, [notifications, activeFilter, searchQuery]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const typeIcons: Record<string, { icon: string; bg: string; text: string }> = {
    mention: { icon: '💬', bg: 'bg-blue-100', text: 'text-blue-800' },
    assignment: { icon: '📋', bg: 'bg-purple-100', text: 'text-purple-800' },
    blocker_cleared: { icon: '🔓', bg: 'bg-emerald-100', text: 'text-emerald-800' },
    blocked: { icon: '⛔', bg: 'bg-red-100', text: 'text-red-800' },
    status_change: { icon: '🔄', bg: 'bg-amber-100', text: 'text-amber-800' },
    approval: { icon: '⚖️', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between flex-wrap gap-4 sticky top-0 z-20 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <InboxIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-gray-900">Activity Inbox</h1>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Real-time updates, dependency unblock notifications, team mentions, and approvals.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="p-8 max-w-5xl mx-auto w-full space-y-6">
        {/* Filter Navigation Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-medium">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeFilter === 'all' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              All Notifications
            </button>
            <button
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeFilter === 'unread' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setActiveFilter('mentions')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeFilter === 'mentions' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              @Mentions
            </button>
            <button
              onClick={() => setActiveFilter('blockers')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeFilter === 'blockers' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Blockers & Dependencies
            </button>
            <button
              onClick={() => setActiveFilter('assignments')}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                activeFilter === 'assignments' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Assignments
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <SearchIcon className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs px-2 py-1 bg-transparent border-none outline-none focus:ring-0 w-40 text-gray-800"
            />
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length > 0 ? (
            filteredNotifications.map(notif => {
              const typeCfg = typeIcons[notif.type] || typeIcons.status_change;

              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id)}
                  className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                    !notif.isRead 
                      ? 'bg-blue-50/50 border-blue-200 shadow-sm' 
                      : 'bg-white border-gray-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                    <span className={`p-2.5 rounded-xl text-base shrink-0 ${typeCfg.bg}`}>
                      {typeCfg.icon}
                    </span>

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-bold text-gray-900">{notif.title}</h4>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                        )}
                        <span className="text-[11px] text-gray-400">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-gray-700 leading-relaxed">
                        {notif.message}
                      </p>

                      {notif.taskTitle && (
                        <div className="pt-1 flex items-center space-x-2 text-xs">
                          <span className="text-gray-400 font-medium">Task:</span>
                          <span className="font-semibold text-blue-600 hover:underline truncate">
                            {notif.taskTitle}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive(notif.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Archive Notification"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 space-y-2">
              <InboxIcon className="w-12 h-12 mx-auto text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">All caught up!</p>
              <p className="text-xs text-gray-400">No notifications match your current filter.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InboxPage;
