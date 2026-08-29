
export type ColumnId = 'To Do' | 'In Progress' | 'Done';
export type ViewType = 'list' | 'board' | 'calendar' | 'timeline' | 'dashboard' | 'gantt' | 'workload' | 'insights';
export type PlannerRange = 'day' | 'week' | 'month' | 'agenda';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
export type UserRole = 'admin' | 'manager' | 'member' | 'viewer';
export type IntegrationType = 'jira' | 'slack' | 'github' | 'google' | 'microsoft' | 'tableau' | 'powerbi';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  avatar?: string;
  role: UserRole;
  department?: string;
  timeZone?: string;
  workload?: number;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  managerId?: string; // For approval hierarchy
  approvalLimit?: number; // Maximum amount/value this user can approve
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName: string;
  department?: string;
  role?: UserRole;
}

export type ProjectHealthStatus = 'on_track' | 'at_risk' | 'off_track' | 'on_hold' | 'completed';

export interface ProjectSection {
  id: string;
  name: string;
  order: number;
  color?: string;
}

export interface ProjectStatusUpdate {
  id: string;
  projectId: string;
  authorId: string;
  status: ProjectHealthStatus;
  title: string;
  summary: string;
  blockers?: string;
  nextSteps?: string;
  createdAt: Date;
}

export interface ProjectBriefRole {
  role: string;
  userId: string;
}

export interface ProjectBriefLink {
  id: string;
  title: string;
  url: string;
  category?: 'design' | 'docs' | 'repo' | 'sheet' | 'chat' | 'other';
}

export interface ProjectBrief {
  overview?: string;
  goals?: string[];
  roles?: ProjectBriefRole[];
  links?: ProjectBriefLink[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  members: string[];
  createdAt: Date;
  updatedAt: Date;
  color: string;
  isTemplate: boolean;
  templateId?: string;
  isFavorite?: boolean;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  healthStatus?: ProjectHealthStatus;
  sections?: ProjectSection[];
  brief?: ProjectBrief;
  statusUpdates?: ProjectStatusUpdate[];
  startDate?: Date;
  dueDate?: Date;
  visibility: 'public' | 'private' | 'team';
  customFields: CustomField[];
  tags: string[];
  portfolioId?: string;
}

export interface TaskRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g. 1 (every 1 week)
  daysOfWeek?: number[]; // [1, 3, 5] for Mon, Wed, Fri
  repeatAfterCompletion?: boolean;
  repeatFrom?: 'due_date' | 'completion_date';
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  details: string;
  timestamp: Date;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  taskStatus: TaskStatus;
  projectId: string;
  projectIds?: string[]; // Multi-homing into multiple projects
  sectionId?: string;    // Custom section ID within project
  assigneeId: string | null;
  collaboratorIds?: string[]; // Task followers / collaborators
  createdBy: string;
  dueDate: Date | null;
  dueTime?: string | null;        // 'HH:mm' local time-of-day for the deadline (date-only when absent)
  startDate: Date | null;
  completedDate: Date | null;
  scheduledStart?: Date | null;   // Planned work block on the calendar
  scheduledEnd?: Date | null;
  priority: Priority;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  dependencies: string[]; // List of task IDs that block this task (backward compatibility)
  blockedBy?: string[];   // Explicit: List of task IDs that block this task
  blocking?: string[];    // Explicit: List of task IDs that this task blocks
  subtasks: string[];
  parentTaskId?: string;
  timeTracked: number; // in minutes
  estimatedTime?: number; // in minutes
  customFields: { [key: string]: any };
  tags: string[];
  attachments: Attachment[];
  approval?: ApprovalRequest;
  isMilestone?: boolean;
  subtaskItems?: SubtaskItem[];
  recurrence?: TaskRecurrence;
  activities?: TaskActivity[];
}

export interface DependencyInfo {
  taskId: string;
  taskTitle: string;
  status: ColumnId;
  taskStatus?: TaskStatus;
  isCompleted: boolean;
  assigneeName?: string;
  assigneeAvatar?: string;
  dueDate?: Date | null;
  priority?: Priority;
}

export interface TaskDependencyGraph {
  task: Task;
  blockers: DependencyInfo[];
  dependents: DependencyInfo[];
  isBlocked: boolean;
  unresolvedBlockersCount: number;
  totalBlockersCount: number;
  totalDependentsCount: number;
}

export interface Comment {
  id: string;
  text: string;
  taskId: string;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
  isEdited: boolean;
  attachments?: Attachment[];
}

export interface CustomFieldOption {
  id: string;
  label: string;
  color?: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'checkbox' | 'user' | 'currency' | 'percentage' | 'rating';
  options?: string[];
  fieldOptions?: CustomFieldOption[];
  currencyCode?: string; // e.g. '$', '€', '£'
  isRequired: boolean;
  isLocked: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  category: 'agile' | 'marketing' | 'operations' | 'product' | 'engineering' | 'hr' | 'general';
  description: string;
  color: string;
  iconName: string;
  sections: { name: string; color?: string }[];
  customFields: CustomField[];
  sampleTasks: {
    title: string;
    description: string;
    sectionName: string;
    priority: Priority;
    daysFromNow: number;
    estimatedHours?: number;
    isMilestone?: boolean;
    tags?: string[];
    subtasks?: string[];
  }[];
  brief?: ProjectBrief;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  duration: number; // in minutes
  description?: string;
  startTime: Date;
  endTime?: Date;
  createdAt: Date;
  isRunning: boolean;
  category?: 'Development' | 'Design' | 'Review' | 'Meeting' | 'Testing' | 'Bugfix' | 'Other';
  isBillable?: boolean;
}

export interface SubtaskItem {
  id: string;
  title: string;
  isCompleted: boolean;
  assigneeId?: string | null;
  dueDate?: Date | null;
}

export interface TaskFilterOptions {
  searchQuery: string;
  assigneeIds: string[]; // empty = all, 'unassigned' = unassigned, 'me' = current user
  statuses: ColumnId[];
  priorities: Priority[];
  dueDatePreset: 'all' | 'overdue' | 'today' | 'due_24h' | 'next_7_days' | 'this_month' | 'no_due_date' | 'custom';
  customDateStart?: string;
  customDateEnd?: string;
  taskType: 'all' | 'tasks_only' | 'milestones_only' | 'approvals_only' | 'blocked_only' | 'blocking_only';
  tags: string[];
  sortBy: 'order' | 'dueDate' | 'priority' | 'title' | 'assignee' | 'timeTracked' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  groupBy: 'none' | 'status' | 'assignee' | 'priority' | 'dueDate';
}

export interface Milestone {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  dueDate: Date;
  isCompleted: boolean;
  completedDate?: Date;
  tasks: string[];
  createdBy: string;
  createdAt: Date;
}

export interface Form {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  fields: FormField[];
  isActive: boolean;
  branching: FormBranching[];
  createdBy: string;
  createdAt: Date;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'file';
  isRequired: boolean;
  options?: string[];
  validation?: ValidationRule[];
}

export interface FormBranching {
  id: string;
  fieldId: string;
  condition: string;
  value: any;
  targetFieldId: string;
  action: 'show' | 'hide' | 'require';
}

export interface ValidationRule {
  type: 'min' | 'max' | 'regex' | 'email';
  value: any;
  message: string;
}

export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  config: { [key: string]: any };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  trigger: RuleTrigger;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  projectId?: string;
  createdBy: string;
  createdAt: Date;
}

export interface RuleTrigger {
  type: 'task_created' | 'task_updated' | 'task_completed' | 'due_date_approaching' | 'assignee_changed';
  config?: { [key: string]: any };
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface RuleAction {
  type: 'assign_user' | 'change_status' | 'send_notification' | 'create_task' | 'move_to_project';
  config: { [key: string]: any };
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  requestedBy: string;
  approvers: string[];
  status: 'pending' | 'approved' | 'rejected';
  description?: string;
  approvals: Approval[];
  createdAt: Date;
  dueDate?: Date;
  approvalType: 'sequential' | 'parallel' | 'any_one';
  requiredApprovals: number;
  escalationPath?: string[]; // User IDs for escalation
  estimatedValue?: number; // For financial approvals
  priority: Priority;
  currentApproverIndex?: number; // For sequential approvals
}

export interface Approval {
  userId: string;
  status: 'approved' | 'rejected';
  comment?: string;
  timestamp: Date;
  signatureHash?: string; // For audit trail
}

export interface ApprovalHierarchy {
  id: string;
  name: string;
  description?: string;
  rules: ApprovalRule[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface ApprovalRule {
  id: string;
  condition: ApprovalCondition;
  approvers: ApprovalApprover[];
  escalationTimeHours?: number;
}

export interface ApprovalCondition {
  field: 'priority' | 'estimatedValue' | 'taskType' | 'department' | 'projectId';
  operator: 'equals' | 'greater_than' | 'less_than' | 'in' | 'contains';
  value: any;
}

export interface ApprovalApprover {
  type: 'user' | 'role' | 'manager' | 'department_head';
  identifier: string; // user ID, role name, or department name
  isRequired: boolean;
  order?: number; // For sequential approvals
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  projects: string[];
  goals: string[];
  createdAt: Date;
  status: 'active' | 'archived';
}

export interface Goal {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  portfolioId?: string;
  targetDate: Date;
  status: 'not_started' | 'in_progress' | 'completed' | 'at_risk';
  progress: number; // 0-100
  keyResults: KeyResult[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KeyResult {
  id: string;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  isCompleted: boolean;
}

// --- Calendar & Meetings --- //

export type EventType = 'meeting' | 'focus' | 'reminder' | 'deadline' | 'out_of_office' | 'personal';
export type EventResponse = 'accepted' | 'declined' | 'tentative' | 'no_response';
export type ReminderChannel = 'in_app' | 'browser';

export interface EventAttendee {
  userId?: string;
  email?: string;
  name: string;
  isOptional?: boolean;
  response: EventResponse;
}

export interface EventReminder {
  id: string;
  minutesBefore: number;
  channels: ReminderChannel[];
}

export interface EventRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;          // every N days/weeks/months/years
  daysOfWeek?: number[];     // 0 = Sunday .. 6 = Saturday (weekly only)
  until?: Date | null;       // inclusive end date for the series
  count?: number;            // alternative to `until`: total number of occurrences
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  ownerId: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  location?: string;
  conferenceLink?: string;
  attendees: EventAttendee[];
  projectId?: string;
  taskIds?: string[];
  color?: string;                 // tailwind bg-* class
  reminders: EventReminder[];
  recurrence?: EventRecurrence | null;
  exceptions?: string[];          // ISO dates (yyyy-mm-dd) skipped in a recurring series
  status: 'confirmed' | 'tentative' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

/** A single materialised instance of an event (a recurring event yields many). */
export interface EventOccurrence {
  occurrenceId: string;   // `${eventId}::${startISO}` - stable across reloads
  event: CalendarEvent;
  start: Date;
  end: Date;
  isRecurringInstance: boolean;
}

/** Anything that can occupy a slot in the planner: a meeting or a task. */
export interface ScheduleEntry {
  id: string;
  kind: 'event' | 'task';
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  occurrence?: EventOccurrence;
  task?: Task;
  color: string;
}

export type NotificationType = 
  | 'assignment' 
  | 'comment' 
  | 'mention' 
  | 'deadline_approaching' 
  | 'deadline_overdue' 
  | 'blocker_cleared' 
  | 'blocked' 
  | 'status_change' 
  | 'approval'
  | 'meeting_reminder'
  | 'meeting_invite'
  | 'meeting_changed';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  authorId?: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: Date;
  isRead: boolean;
  isArchived?: boolean;
  priority?: Priority;
  details?: string;
  meta?: Record<string, any>;
}
