import { AppNotification, NotificationType, Task, User, Project, Comment, ApprovalRequest } from '../types';

type NotificationListener = (notifications: AppNotification[]) => void;

const NOTIFICATIONS_STORAGE_KEY = 'asana_enterprise_notifications';

// Initial Seed Notifications for realistic enterprise workspace
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-seed-1',
    userId: 'user-1', // Ali
    type: 'deadline_approaching',
    title: 'Deadline Approaching: Due in 18 Hours',
    message: 'The task "AOP 2025-26 Financial Modeling & Projections" is due tomorrow at 5:00 PM.',
    taskId: 'task-1',
    taskTitle: 'AOP 2025-26 Financial Modeling & Projections',
    projectId: 'proj-1',
    projectName: 'AOP 2025-26 Enterprise Plan',
    authorName: 'System Monitor',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
    isRead: false,
    priority: 'high',
    details: 'Financial figures must be reconciled before board presentation review.'
  },
  {
    id: 'notif-seed-2',
    userId: 'user-1', // Ali
    type: 'comment',
    title: 'New Comment on Your Task',
    message: 'Bob commented: "I updated the operating expense forecast in sheet tab 3. Please check the variance analysis."',
    taskId: 'task-1',
    taskTitle: 'AOP 2025-26 Financial Modeling & Projections',
    projectId: 'proj-1',
    projectName: 'AOP 2025-26 Enterprise Plan',
    authorId: 'user-2',
    authorName: 'Bob',
    timestamp: new Date(Date.now() - 1000 * 60 * 45), // 45 mins ago
    isRead: false,
    priority: 'medium',
    details: 'Tab 3 reconciled against FY24 actuals.'
  },
  {
    id: 'notif-seed-3',
    userId: 'user-1', // Ali
    type: 'mention',
    title: 'Mentioned in Discussion',
    message: 'Charlie mentioned you: "@Ali could you sign off on the Q1 cloud infrastructure reservation?"',
    taskId: 'task-3',
    taskTitle: 'Cloud Hosting & DevOps Migration',
    projectId: 'proj-1',
    projectName: 'AOP 2025-26 Enterprise Plan',
    authorId: 'user-3',
    authorName: 'Charlie',
    timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    isRead: false,
    priority: 'high',
    details: 'Requires Admin approval tier for cloud capacity reservations.'
  },
  {
    id: 'notif-seed-4',
    userId: 'user-1', // Ali
    type: 'blocker_cleared',
    title: 'Prerequisite Unblocked',
    message: 'Charlie completed "Database Schema Migration". You can now proceed with "API Endpoint Optimization".',
    taskId: 'task-4',
    taskTitle: 'API Endpoint Optimization',
    projectId: 'proj-1',
    projectName: 'AOP 2025-26 Enterprise Plan',
    authorId: 'user-3',
    authorName: 'Charlie',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    isRead: true,
    priority: 'medium'
  },
  {
    id: 'notif-seed-5',
    userId: 'user-1', // Ali
    type: 'assignment',
    title: 'Assigned to New Task',
    message: 'Bob assigned you to "Enterprise Security & Compliance Audit FY26".',
    taskId: 'task-5',
    taskTitle: 'Enterprise Security & Compliance Audit FY26',
    projectId: 'proj-1',
    projectName: 'AOP 2025-26 Enterprise Plan',
    authorId: 'user-2',
    authorName: 'Bob',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    isRead: true,
    priority: 'high'
  },
  {
    id: 'notif-seed-6',
    userId: 'user-2', // Bob
    type: 'assignment',
    title: 'Assigned to New Task',
    message: 'Ali assigned you to "Retail POS Integration & Inventory Sync".',
    taskId: 'task-2',
    taskTitle: 'Retail POS Integration & Inventory Sync',
    projectId: 'proj-2',
    projectName: 'Retail Store Digital Hub',
    authorId: 'user-1',
    authorName: 'Ali',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
    isRead: false,
    priority: 'high'
  },
  {
    id: 'notif-seed-7',
    userId: 'user-3', // Charlie
    type: 'deadline_approaching',
    title: 'Deadline Approaching: Due in 24 Hours',
    message: 'The task "Mobile Responsive Checkout Audit" is due tomorrow.',
    taskId: 'task-7',
    taskTitle: 'Mobile Responsive Checkout Audit',
    projectId: 'proj-2',
    projectName: 'Retail Store Digital Hub',
    authorName: 'System Monitor',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    isRead: false,
    priority: 'medium'
  }
];

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: Record<string, NotificationListener[]> = {};
  private globalListeners: NotificationListener[] = [];
  private scannedDeadlineTaskIds: Set<string> = new Set();
  private scanTimer: any = null;

  constructor() {
    this.loadFromStorage();
    this.startDeadlineMonitor();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.notifications = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
      } else {
        this.notifications = [...INITIAL_NOTIFICATIONS];
        this.saveToStorage();
      }
    } catch (e) {
      console.warn('Failed to load notifications from storage, using defaults:', e);
      this.notifications = [...INITIAL_NOTIFICATIONS];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(this.notifications));
    } catch (e) {
      console.error('Failed to save notifications to storage:', e);
    }
  }

  private notifyUser(userId: string) {
    const userNotifs = this.getNotifications(userId);
    if (this.listeners[userId]) {
      this.listeners[userId].forEach(cb => cb(userNotifs));
    }
    // Also notify global listeners (for top-level counters/badges)
    this.globalListeners.forEach(cb => cb(this.notifications));
    this.saveToStorage();
  }

  public subscribe(userId: string, callback: NotificationListener): () => void {
    if (!this.listeners[userId]) {
      this.listeners[userId] = [];
    }
    this.listeners[userId].push(callback);
    // Initial call
    callback(this.getNotifications(userId));

    return () => {
      this.listeners[userId] = this.listeners[userId].filter(cb => cb !== callback);
    };
  }

  public subscribeAll(callback: NotificationListener): () => void {
    this.globalListeners.push(callback);
    callback(this.notifications);
    return () => {
      this.globalListeners = this.globalListeners.filter(cb => cb !== callback);
    };
  }

  public getNotifications(userId: string): AppNotification[] {
    return this.notifications
      .filter(n => (n.userId === userId || n.userId === 'all') && !n.isArchived)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getUnreadCount(userId: string): number {
    return this.notifications.filter(n => (n.userId === userId || n.userId === 'all') && !n.isRead && !n.isArchived).length;
  }

  public createNotification(data: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>): AppNotification {
    const newNotif: AppNotification = {
      ...data,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
      isRead: false,
      isArchived: false,
    };

    // Prepend to list
    this.notifications.unshift(newNotif);
    this.notifyUser(data.userId);
    return newNotif;
  }

  public markAsRead(notificationId: string, userId?: string): void {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      if (userId) {
        this.notifyUser(userId);
      } else {
        this.notifyUser(notif.userId);
      }
    }
  }

  public markAsUnread(notificationId: string, userId?: string): void {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.isRead = false;
      if (userId) {
        this.notifyUser(userId);
      } else {
        this.notifyUser(notif.userId);
      }
    }
  }

  public markAllAsRead(userId: string): void {
    this.notifications.forEach(n => {
      if (n.userId === userId || n.userId === 'all') {
        n.isRead = true;
      }
    });
    this.notifyUser(userId);
  }

  public archiveNotification(notificationId: string, userId?: string): void {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) {
      notif.isArchived = true;
      if (userId) {
        this.notifyUser(userId);
      } else {
        this.notifyUser(notif.userId);
      }
    }
  }

  public clearAll(userId: string): void {
    this.notifications = this.notifications.filter(n => n.userId !== userId && n.userId !== 'all');
    this.notifyUser(userId);
  }

  // --- Specialized Event Triggers ---

  /**
   * Alert a user when a task is assigned or reassigned to them
   */
  public notifyTaskAssignment(
    task: Task, 
    assignedBy: { uid?: string; displayName?: string }, 
    assignee: { uid: string; displayName?: string },
    project?: { id?: string; name?: string }
  ) {
    if (!assignee?.uid) return;
    // Don't notify if user assigned task to themselves
    if (assignedBy?.uid === assignee.uid) return;

    this.createNotification({
      userId: assignee.uid,
      type: 'assignment',
      title: 'Task Assigned to You',
      message: `${assignedBy.displayName || 'A team member'} assigned you to "${task.title}"${project?.name ? ` in ${project.name}` : ''}.`,
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId || project?.id,
      projectName: project?.name,
      authorId: assignedBy.uid,
      authorName: assignedBy.displayName || 'Team Member',
      priority: task.priority || 'medium',
      details: task.description ? task.description.slice(0, 120) : undefined
    });
  }

  /**
   * Alert participants when a comment is added to a task
   */
  public notifyCommentAdded(
    comment: Comment,
    task: Task,
    author: { uid: string; displayName: string; avatar?: string },
    allUsers: User[] = [],
    project?: { id?: string; name?: string }
  ) {
    const commentText = comment.text || '';
    const recipientsToNotify = new Set<string>();

    // 1. Notify Assignee if not the author
    if (task.assigneeId && task.assigneeId !== author.uid) {
      recipientsToNotify.add(task.assigneeId);
    }

    // 2. Notify Task Creator if not the author
    if (task.createdBy && task.createdBy !== author.uid) {
      recipientsToNotify.add(task.createdBy);
    }

    // 3. Detect @mentions in comment text (e.g., "@Ali", "@Bob", "@Charlie")
    allUsers.forEach(u => {
      if (u.uid !== author.uid) {
        const namePattern = new RegExp(`@${u.displayName}\\b`, 'i');
        const emailPattern = new RegExp(`@${u.email.split('@')[0]}\\b`, 'i');
        if (namePattern.test(commentText) || emailPattern.test(commentText)) {
          recipientsToNotify.add(u.uid);
          // Also send specific 'mention' notification
          this.createNotification({
            userId: u.uid,
            type: 'mention',
            title: `Mentioned by ${author.displayName}`,
            message: `${author.displayName} mentioned you: "${commentText.length > 100 ? commentText.slice(0, 97) + '...' : commentText}"`,
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId || project?.id,
            projectName: project?.name,
            authorId: author.uid,
            authorName: author.displayName,
            authorAvatar: author.avatar,
            priority: 'high',
            details: commentText
          });
        }
      }
    });

    // Send regular comment notification to other followers
    recipientsToNotify.forEach(recipientId => {
      // Check if already notified via @mention
      const hasMention = allUsers.some(u => u.uid === recipientId && (
        new RegExp(`@${u.displayName}\\b`, 'i').test(commentText)
      ));
      if (!hasMention) {
        this.createNotification({
          userId: recipientId,
          type: 'comment',
          title: `New Comment on "${task.title}"`,
          message: `${author.displayName}: "${commentText.length > 100 ? commentText.slice(0, 97) + '...' : commentText}"`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId || project?.id,
          projectName: project?.name,
          authorId: author.uid,
          authorName: author.displayName,
          authorAvatar: author.avatar,
          priority: task.priority || 'medium',
          details: commentText
        });
      }
    });
  }

  /**
   * Alert user when a deadline is approaching
   */
  public notifyDeadlineApproaching(
    task: Task,
    assignee: { uid: string; displayName?: string },
    hoursLeft: number,
    project?: { id?: string; name?: string }
  ) {
    if (!assignee?.uid) return;
    const timeLabel = hoursLeft <= 1 
      ? 'in less than 1 hour' 
      : hoursLeft <= 24 
      ? `today (in ${Math.round(hoursLeft)} hours)` 
      : `in ${Math.round(hoursLeft / 24)} days`;

    this.createNotification({
      userId: assignee.uid,
      type: 'deadline_approaching',
      title: `⏰ Deadline Approaching: Due ${timeLabel}`,
      message: `"${task.title}" is due ${timeLabel}${project?.name ? ` in ${project.name}` : ''}. Review deliverables and update status.`,
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId || project?.id,
      projectName: project?.name,
      authorName: 'Deadline Sentinel',
      priority: hoursLeft <= 24 ? 'critical' : 'high',
      details: task.dueDate ? `Due date: ${new Date(task.dueDate).toLocaleDateString()} at ${new Date(task.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : undefined
    });
  }

  /**
   * Alert user when a task has passed its deadline
   */
  public notifyDeadlineOverdue(
    task: Task,
    assignee: { uid: string; displayName?: string },
    project?: { id?: string; name?: string }
  ) {
    if (!assignee?.uid) return;

    this.createNotification({
      userId: assignee.uid,
      type: 'deadline_overdue',
      title: `🚨 Overdue Task Alert: "${task.title}"`,
      message: `The deadline for "${task.title}" has passed without completion. Please update the timeline or mark it complete.`,
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId || project?.id,
      projectName: project?.name,
      authorName: 'Deadline Sentinel',
      priority: 'critical',
      details: task.dueDate ? `Past due since: ${new Date(task.dueDate).toLocaleDateString()}` : undefined
    });
  }

  /**
   * Scan tasks to proactively detect approaching and overdue deadlines
   */
  public scanDeadlines(tasks: Task[], projects: Project[] = []) {
    const now = new Date().getTime();
    const projectMap = new Map(projects.map(p => [p.id, p]));

    tasks.forEach(task => {
      if (!task.dueDate || task.status === 'Done' || task.taskStatus === 'completed' || !task.assigneeId) {
        return;
      }

      const dueTime = new Date(task.dueDate).getTime();
      const diffMs = dueTime - now;
      const hoursLeft = diffMs / (1000 * 60 * 60);
      const project = projectMap.get(task.projectId);

      // Key for deduplication during current session/day
      const dayKey = `${task.id}-${new Date().toISOString().split('T')[0]}`;

      // Overdue
      if (hoursLeft < 0 && hoursLeft > -72) { // within last 3 days overdue
        const overdueKey = `overdue-${dayKey}`;
        if (!this.scannedDeadlineTaskIds.has(overdueKey)) {
          this.scannedDeadlineTaskIds.add(overdueKey);
          this.notifyDeadlineOverdue(task, { uid: task.assigneeId }, project);
        }
      } 
      // Approaching within next 48 hours
      else if (hoursLeft > 0 && hoursLeft <= 48) {
        const approachKey = `approach-${dayKey}-${hoursLeft <= 24 ? '24h' : '48h'}`;
        if (!this.scannedDeadlineTaskIds.has(approachKey)) {
          this.scannedDeadlineTaskIds.add(approachKey);
          this.notifyDeadlineApproaching(task, { uid: task.assigneeId }, hoursLeft, project);
        }
      }
    });
  }

  private startDeadlineMonitor() {
    if (typeof window !== 'undefined') {
      // Periodically clean or trigger scan checks
      this.scanTimer = setInterval(() => {
        // Heartbeat keep-alive
      }, 60000);
    }
  }

  /**
   * Simulation generator for instant live testing in UI
   */
  public simulateLiveNotification(currentUser: User, type: NotificationType, tasks: Task[] = [], otherUsers: User[] = []): AppNotification {
    const task = tasks[0] || {
      id: 'task-sim-1',
      title: 'Q3 Enterprise Architecture Roadmap',
      projectId: 'proj-1',
      priority: 'high'
    };

    const sender = otherUsers.find(u => u.uid !== currentUser.uid) || {
      uid: 'user-sim',
      displayName: 'Sarah Connor',
      role: 'manager'
    };

    switch (type) {
      case 'assignment':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'assignment',
          title: '📋 New Task Assigned',
          message: `${sender.displayName} assigned you to "${task.title}". Priority set to ${task.priority || 'High'}.`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorId: sender.uid,
          authorName: sender.displayName,
          priority: 'high',
          details: 'Please review specifications in the project overview.'
        });

      case 'comment':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'comment',
          title: `💬 New Comment from ${sender.displayName}`,
          message: `${sender.displayName}: "I pushed the updated prototype and metrics. Let me know what you think!"`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorId: sender.uid,
          authorName: sender.displayName,
          priority: 'medium',
          details: 'Pushed updated metrics and wireframe prototype.'
        });

      case 'deadline_approaching':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'deadline_approaching',
          title: '⏰ Urgent Deadline: Due in 4 Hours',
          message: `The deadline for "${task.title}" is today at 5:00 PM. Final approval signoff required.`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorName: 'Deadline Sentinel',
          priority: 'critical',
          details: 'Due today at 5:00 PM.'
        });

      case 'deadline_overdue':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'deadline_overdue',
          title: '🚨 Deadline Overdue Notice',
          message: `"${task.title}" passed its completion deadline. Immediate action is required.`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorName: 'Deadline Sentinel',
          priority: 'critical',
          details: 'Overdue by 1 day.'
        });

      case 'mention':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'mention',
          title: `📣 Mentioned by ${sender.displayName}`,
          message: `${sender.displayName}: "@${currentUser.displayName} can you review the final financial breakdown before executive signoff?"`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorId: sender.uid,
          authorName: sender.displayName,
          priority: 'high',
          details: 'Needs executive signoff review.'
        });

      case 'blocker_cleared':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'blocker_cleared',
          title: '🔓 Dependency Unblocked',
          message: `${sender.displayName} completed the blocking prerequisite. You are now unblocked on "${task.title}".`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorId: sender.uid,
          authorName: sender.displayName,
          priority: 'medium'
        });

      case 'approval':
        return this.createNotification({
          userId: currentUser.uid,
          type: 'approval',
          title: '⚖️ Executive Signoff Request',
          message: `${sender.displayName} submitted an approval request for "${task.title}".`,
          taskId: task.id,
          taskTitle: task.title,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorId: sender.uid,
          authorName: sender.displayName,
          priority: 'high'
        });

      default:
        return this.createNotification({
          userId: currentUser.uid,
          type: 'status_change',
          title: '🔄 Project Status Update',
          message: `Project health status was updated to On Track by ${sender.displayName}.`,
          projectId: task.projectId,
          projectName: 'AOP 2025-26 Enterprise Plan',
          authorId: sender.uid,
          authorName: sender.displayName,
          priority: 'medium'
        });
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
