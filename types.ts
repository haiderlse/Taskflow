
export type ColumnId = 'To Do' | 'In Progress' | 'Done';
export type ViewType = 'list' | 'board' | 'calendar' | 'timeline' | 'dashboard' | 'gantt' | 'workload';
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
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  startDate?: Date;
  dueDate?: Date;
  visibility: 'public' | 'private' | 'team';
  customFields: CustomField[];
  tags: string[];
  portfolioId?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  taskStatus: TaskStatus;
  projectId: string;
  assigneeId: string | null;
  createdBy: string;
  dueDate: Date | null;
  startDate: Date | null;
  completedDate: Date | null;
  priority: Priority;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  dependencies: string[];
  subtasks: string[];
  parentTaskId?: string;
  timeTracked: number; // in minutes
  estimatedTime?: number; // in minutes
  customFields: { [key: string]: any };
  tags: string[];
  attachments: Attachment[];
  approval?: ApprovalRequest;
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

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect' | 'checkbox' | 'user' | 'currency';
  options?: string[];
  isRequired: boolean;
  isLocked: boolean;
  createdBy: string;
  createdAt: Date;
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
}

export interface Approval {
  userId: string;
  status: 'approved' | 'rejected';
  comment?: string;
  timestamp: Date;
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
