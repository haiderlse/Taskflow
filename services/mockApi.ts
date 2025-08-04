
import { User, Project, Task, Comment, ColumnId } from '../types';

// --- MOCK DATABASE ---
const USERS: User[] = [
  { uid: 'user-1', email: 'ali@example.com', displayName: 'Ali' },
  { uid: 'user-2', email: 'bob@example.com', displayName: 'Bob' },
  { uid: 'user-3', email: 'charlie@example.com', displayName: 'Charlie' },
];

const PROJECTS: Project[] = [
  { id: 'proj-1', name: 'AOP 2025-26', ownerId: 'user-1', members: ['user-1', 'user-2'], createdAt: new Date(), color: 'bg-green-500' },
  { id: 'proj-2', name: 'Retail Store', ownerId: 'user-2', members: ['user-2'], createdAt: new Date(), color: 'bg-pink-500' },
  { id: 'proj-3', name: 'Shahlimar Franchise', ownerId: 'user-1', members: ['user-1'], createdAt: new Date(), color: 'bg-pink-500' },
  { id: 'proj-4', name: 'Dvago', ownerId: 'user-1', members: ['user-1', 'user-2', 'user-3'], createdAt: new Date(), color: 'bg-gray-400' },
  { id: 'proj-5', name: 'Mungwao', ownerId: 'user-2', members: ['user-2', 'user-3'], createdAt: new Date(), color: 'bg-pink-500' },
];

let TASKS: Task[] = [
    { id: 'task-1', projectId: 'proj-1', title: 'Follow up on Pharma Receivables Plan', description: 'Contact finance department.', status: 'In Progress', assigneeId: 'user-1', dueDate: new Date(), order: 0, createdAt: new Date() },
    { id: 'task-2', projectId: 'proj-1', title: 'Follow up on FW: MOM Route 2 Health x DVAGO 20-Nov-2024', description: '', status: 'To Do', assigneeId: 'user-1', dueDate: new Date(), order: 1, createdAt: new Date() },
    { id: 'task-3', projectId: 'proj-1', title: 'IBP - Forecasting to Process & Priorities', description: '', status: 'To Do', assigneeId: 'user-1', dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), order: 2, createdAt: new Date() },
    { id: 'task-4', projectId: 'proj-2', title: 'ADP -', description: 'Review the quarterly reports.', status: 'To Do', assigneeId: 'user-1', dueDate: null, order: 3, createdAt: new Date() },
    { id: 'task-5', projectId: 'proj-2', title: 'Gaviscol - Online Activity', description: '', status: 'Done', assigneeId: 'user-1', dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), order: 0, createdAt: new Date() },
    { id: 'task-6', projectId: 'proj-3', title: 'Apply Expenses', description: 'Submit Q2 expense reports.', status: 'To Do', assigneeId: 'user-1', dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), order: 0, createdAt: new Date() },
    { id: 'task-7', projectId: 'proj-4', title: 'Deploy staging server', description: '', status: 'Done', assigneeId: 'user-2', dueDate: null, order: 0, createdAt: new Date() },
    { id: 'task-8', projectId: 'proj-1', title: 'Design new homepage mockups', description: 'Create high-fidelity mockups in Figma.', status: 'In Progress', assigneeId: 'user-2', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), order: 0, createdAt: new Date() }
];

let COMMENTS: Comment[] = [
  { id: 'comment-1', taskId: 'task-1', userId: 'user-2', text: 'How is the progress on this?', createdAt: new Date(Date.now() - 60000) },
  { id: 'comment-2', taskId: 'task-1', userId: 'user-1', text: 'Almost done, will share by EOD.', createdAt: new Date() },
];

// --- SIMULATED LATENCY ---
const networkDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- REAL-TIME SUBSCRIPTION SIMULATOR ---
type CollectionName = 'tasks' | 'comments';
const listeners: Record<string, Function[]> = {};

const subscribe = (key: string, callback: Function) => {
  listeners[key] = listeners[key] || [];
  listeners[key].push(callback);
  return () => {
    listeners[key] = listeners[key].filter(l => l !== callback);
  };
};

const notify = (key: string, data: any) => {
  if (listeners[key]) {
    listeners[key].forEach(listener => listener(data));
  }
};

// --- API FUNCTIONS ---

export const mockApi = {
  getCurrentUser: async (): Promise<User> => {
    await networkDelay(100);
    return USERS[0];
  },
  
  getUsers: async (): Promise<User[]> => {
    await networkDelay(100);
    return [...USERS];
  },

  getProjects: async (): Promise<Project[]> => {
    await networkDelay(300);
    return [...PROJECTS];
  },

  createProject: async (name: string, ownerId: string): Promise<Project> => {
    await networkDelay(500);
    const colors = ['bg-green-500', 'bg-pink-500', 'bg-purple-500', 'bg-yellow-500', 'bg-blue-500'];
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      ownerId,
      members: [ownerId],
      createdAt: new Date(),
      color: colors[PROJECTS.length % colors.length],
    };
    PROJECTS.push(newProject);
    return newProject;
  },

  getTasksForUser: async (userId: string): Promise<Task[]> => {
      await networkDelay(400);
      return TASKS.filter(t => t.assigneeId === userId);
  },

  // --- Tasks ---
  getTasksForProject: async (projectId: string): Promise<Task[]> => {
    await networkDelay(400);
    return TASKS.filter(t => t.projectId === projectId);
  },

  createTask: async (title: string, projectId: string, status: ColumnId): Promise<Task> => {
    await networkDelay(300);
    const order = TASKS.filter(t => t.projectId === projectId && t.status === status).length;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      projectId,
      title,
      description: '',
      status,
      assigneeId: null,
      dueDate: null,
      order,
      createdAt: new Date(),
    };
    TASKS.push(newTask);
    notify(`tasks:${projectId}`, TASKS.filter(t => t.projectId === projectId));
    return newTask;
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    await networkDelay(200);
    let taskIndex = TASKS.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task not found');
    const originalTask = TASKS[taskIndex];
    TASKS[taskIndex] = { ...originalTask, ...updates };
    
    if (updates.status && updates.status !== originalTask.status) {
        TASKS.filter(t => t.projectId === originalTask.projectId && t.status === originalTask.status)
             .sort((a,b) => a.order - b.order)
             .forEach((t, i) => t.order = i);
        TASKS.filter(t => t.projectId === originalTask.projectId && t.status === updates.status)
             .sort((a,b) => a.order - b.order)
             .forEach((t, i) => t.order = i);
    }

    notify(`tasks:${originalTask.projectId}`, TASKS.filter(t => t.projectId === originalTask.projectId));
    return TASKS[taskIndex];
  },

  updateTaskOrder: async (projectId: string, taskId: string, newStatus: ColumnId, newOrder: number): Promise<void> => {
    await networkDelay(150);
    const task = TASKS.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;
    task.status = newStatus;
    task.order = 1_000_000;

    const oldColumnTasks = TASKS.filter(t => t.projectId === projectId && t.status === oldStatus).sort((a, b) => a.order - b.order);
    oldColumnTasks.forEach((t, i) => t.order = i);

    const newColumnTasks = TASKS.filter(t => t.projectId === projectId && t.status === newStatus).sort((a, b) => a.order - b.order);
    newColumnTasks.splice(newOrder, 0, task);
    newColumnTasks.forEach((t, i) => t.order = i);
    
    notify(`tasks:${projectId}`, TASKS.filter(t => t.projectId === projectId));
  },
  
  subscribeToTasks: (projectId: string, callback: (tasks: Task[]) => void) => {
    return subscribe(`tasks:${projectId}`, callback);
  },

  // --- Comments ---
  getCommentsForTask: async (taskId: string): Promise<Comment[]> => {
    await networkDelay(300);
    return COMMENTS.filter(c => c.taskId === taskId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  addComment: async (taskId: string, userId: string, text: string): Promise<Comment> => {
    await networkDelay(250);
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      taskId,
      userId,
      text,
      createdAt: new Date(),
    };
    COMMENTS.push(newComment);
    notify(`comments:${taskId}`, COMMENTS.filter(c => c.taskId === taskId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    return newComment;
  },

  subscribeToComments: (taskId: string, callback: (comments: Comment[]) => void) => {
    return subscribe(`comments:${taskId}`, callback);
  },
};
