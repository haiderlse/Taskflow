
export type ColumnId = 'To Do' | 'In Progress' | 'Done';

export interface User {
  uid: string;
  email: string;
  displayName: string;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  createdAt: Date;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: ColumnId;
  projectId: string;
  assigneeId: string | null;
  dueDate: Date | null;
  order: number;
  createdAt: Date;
}

export interface Comment {
  id: string;
  text: string;
  taskId: string;
  userId: string;
  createdAt: Date;
}
