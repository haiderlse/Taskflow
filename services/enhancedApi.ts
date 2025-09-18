import { User, Project, Task, Comment, ColumnId, TimeEntry, Milestone, Portfolio, Goal } from '../types';
import { supabaseService } from './supabaseService';

// Initialize database connection (for demo, we'll use mock data if Supabase is not available)
let isSupabaseAvailable = false;

// --- MOCK DATABASE (fallback) ---
const USERS: User[] = [
  { uid: 'user-1', email: 'ali@example.com', displayName: 'Ali', role: 'admin', workload: 40, isActive: true, createdAt: new Date() },
  { uid: 'user-2', email: 'bob@example.com', displayName: 'Bob', role: 'manager', workload: 35, isActive: true, createdAt: new Date() },
  { uid: 'user-3', email: 'charlie@example.com', displayName: 'Charlie', role: 'member', workload: 40, isActive: true, createdAt: new Date() },
];

const PROJECTS: Project[] = [
  { 
    id: 'proj-1', 
    name: 'AOP 2025-26', 
    ownerId: 'user-1', 
    members: ['user-1', 'user-2'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-green-500',
    isTemplate: false,
    status: 'active',
    visibility: 'team',
    customFields: [],
    tags: ['planning', 'annual']
  },
  { 
    id: 'proj-2', 
    name: 'Retail Store', 
    ownerId: 'user-2', 
    members: ['user-2'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-pink-500',
    isTemplate: false,
    status: 'active',
    visibility: 'team',
    customFields: [],
    tags: ['retail']
  },
  { 
    id: 'proj-3', 
    name: 'Shahlimar Franchise', 
    ownerId: 'user-1', 
    members: ['user-1'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-pink-500',
    isTemplate: false,
    status: 'active',
    visibility: 'team',
    customFields: [],
    tags: ['franchise']
  },
  { 
    id: 'proj-4', 
    name: 'Dvago', 
    ownerId: 'user-1', 
    members: ['user-1', 'user-2', 'user-3'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-gray-400',
    isTemplate: false,
    status: 'active',
    visibility: 'team',
    customFields: [],
    tags: ['tech']
  },
  { 
    id: 'proj-5', 
    name: 'Mungwao', 
    ownerId: 'user-2', 
    members: ['user-2', 'user-3'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-pink-500',
    isTemplate: false,
    status: 'active',
    visibility: 'team',
    customFields: [],
    tags: []
  },
];

let TASKS: Task[] = [
    { 
      id: 'task-1', 
      projectId: 'proj-1', 
      title: 'Follow up on Pharma Receivables Plan', 
      description: 'Contact finance department.', 
      status: 'In Progress', 
      taskStatus: 'in_progress',
      assigneeId: 'user-1', 
      createdBy: 'user-1',
      dueDate: new Date(), 
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedDate: null,
      priority: 'high',
      order: 0, 
      dependencies: [],
      subtasks: [],
      timeTracked: 120,
      estimatedTime: 240,
      customFields: {},
      tags: ['finance'],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-2', 
      projectId: 'proj-1', 
      title: 'Follow up on FW: MOM Route 2 Health x DVAGO 20-Nov-2024', 
      description: '', 
      status: 'To Do', 
      taskStatus: 'not_started',
      assigneeId: 'user-1', 
      createdBy: 'user-1',
      dueDate: new Date(), 
      startDate: null,
      completedDate: null,
      priority: 'medium',
      order: 1, 
      dependencies: [],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: [],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-3', 
      projectId: 'proj-1', 
      title: 'IBP - Forecasting to Process & Priorities', 
      description: '', 
      status: 'To Do', 
      taskStatus: 'not_started',
      assigneeId: 'user-1', 
      createdBy: 'user-1',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), 
      startDate: null,
      completedDate: null,
      priority: 'medium',
      order: 2, 
      dependencies: ['task-1'],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: ['planning'],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-4', 
      projectId: 'proj-2', 
      title: 'ADP Setup', 
      description: 'Review the quarterly reports.', 
      status: 'To Do', 
      taskStatus: 'not_started',
      assigneeId: 'user-1', 
      createdBy: 'user-2',
      dueDate: null, 
      startDate: null,
      completedDate: null,
      priority: 'low',
      order: 3, 
      dependencies: [],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: [],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-5', 
      projectId: 'proj-2', 
      title: 'Gaviscol - Online Activity', 
      description: '', 
      status: 'Done', 
      taskStatus: 'completed',
      assigneeId: 'user-1', 
      createdBy: 'user-2',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), 
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      priority: 'medium',
      order: 0, 
      dependencies: [],
      subtasks: [],
      timeTracked: 480,
      estimatedTime: 360,
      customFields: {},
      tags: ['online'],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-6', 
      projectId: 'proj-3', 
      title: 'Apply Expenses', 
      description: 'Submit Q2 expense reports.', 
      status: 'To Do', 
      taskStatus: 'not_started',
      assigneeId: 'user-1', 
      createdBy: 'user-1',
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), 
      startDate: null,
      completedDate: null,
      priority: 'critical',
      order: 0, 
      dependencies: [],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: ['expenses'],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-7', 
      projectId: 'proj-4', 
      title: 'Deploy staging server', 
      description: '', 
      status: 'Done', 
      taskStatus: 'completed',
      assigneeId: 'user-2', 
      createdBy: 'user-1',
      dueDate: null, 
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      priority: 'high',
      order: 0, 
      dependencies: [],
      subtasks: [],
      timeTracked: 240,
      customFields: {},
      tags: ['deployment'],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { 
      id: 'task-8', 
      projectId: 'proj-1', 
      title: 'Design new homepage mockups', 
      description: 'Create high-fidelity mockups in Figma.', 
      status: 'In Progress', 
      taskStatus: 'in_progress',
      assigneeId: 'user-2', 
      createdBy: 'user-1',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), 
      startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedDate: null,
      priority: 'medium',
      order: 0, 
      dependencies: [],
      subtasks: [],
      timeTracked: 90,
      estimatedTime: 480,
      customFields: {},
      tags: ['design'],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }
];

let COMMENTS: Comment[] = [
  { 
    id: 'comment-1', 
    taskId: 'task-1', 
    userId: 'user-2', 
    text: 'How is the progress on this?', 
    isEdited: false,
    createdAt: new Date(Date.now() - 60000),
    updatedAt: new Date(Date.now() - 60000)
  },
  { 
    id: 'comment-2', 
    taskId: 'task-1', 
    userId: 'user-1', 
    text: 'Almost done, will share by EOD.', 
    isEdited: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
];

let TIME_ENTRIES: TimeEntry[] = [
  {
    id: 'time-1',
    taskId: 'task-1',
    userId: 'user-1',
    duration: 120,
    description: 'Initial analysis and planning',
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    endTime: new Date(),
    isRunning: false,
    createdAt: new Date()
  }
];

let MILESTONES: Milestone[] = [
  {
    id: 'milestone-1',
    name: 'Q1 Planning Complete',
    description: 'Complete all Q1 planning activities',
    projectId: 'proj-1',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isCompleted: false,
    tasks: ['task-1', 'task-2', 'task-3'],
    createdBy: 'user-1',
    createdAt: new Date()
  }
];

let PORTFOLIOS: Portfolio[] = [
  {
    id: 'portfolio-1',
    name: 'Business Operations',
    description: 'Core business operations and planning',
    ownerId: 'user-1',
    projects: ['proj-1', 'proj-2'],
    goals: ['goal-1'],
    status: 'active',
    createdAt: new Date()
  }
];

let GOALS: Goal[] = [
  {
    id: 'goal-1',
    name: 'Increase Revenue by 25%',
    description: 'Achieve 25% revenue growth in 2025',
    ownerId: 'user-1',
    portfolioId: 'portfolio-1',
    targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    status: 'in_progress',
    progress: 15,
    keyResults: [
      {
        id: 'kr-1',
        name: 'New customer acquisition',
        targetValue: 100,
        currentValue: 25,
        unit: 'customers',
        isCompleted: false
      }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// --- SIMULATED LATENCY ---
const networkDelay = (ms: number) => new Promise(res => setTimeout(res, ms));

// --- REAL-TIME SUBSCRIPTION SIMULATOR ---
type CollectionName = 'tasks' | 'comments' | 'time-entries';
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

// Initialize database
const initializeDatabase = async () => {
  try {
    // Check if Supabase is properly configured
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url' && supabaseKey !== 'your_supabase_anon_key') {
      // Test connection by trying to get users
      await supabaseService.getUsers();
      isSupabaseAvailable = true;
      console.log('Using Supabase database');
    } else {
      throw new Error('Supabase not configured');
    }
  } catch (error) {
    console.warn('Supabase not available, using mock data:', error);
    isSupabaseAvailable = false;
  }
};

// Call initialization
initializeDatabase();

// --- ENHANCED API FUNCTIONS ---
export const enhancedApi = {
  // Authentication and Users
  getCurrentUser: async (): Promise<User> => {
    await networkDelay(100);
    if (isSupabaseAvailable) {
      const user = await supabaseService.getCurrentUser();
      return user || USERS[0];
    }
    return USERS[0];
  },
  
  getUsers: async (): Promise<User[]> => {
    await networkDelay(100);
    if (isSupabaseAvailable) {
      return await supabaseService.getUsers();
    }
    return [...USERS];
  },

  getUserById: async (uid: string): Promise<User | null> => {
    await networkDelay(100);
    if (isSupabaseAvailable) {
      return await supabaseService.getUserById(uid);
    }
    return USERS.find(u => u.uid === uid) || null;
  },

  createUser: async (userData: Partial<User>): Promise<User> => {
    await networkDelay(300);
    
    if (isSupabaseAvailable) {
      return await supabaseService.createUser(userData);
    }
    
    const newUser: User = {
      uid: userData.uid || `user-${Date.now()}`,
      email: userData.email || '',
      displayName: userData.displayName || '',
      role: userData.role || 'member',
      department: userData.department,
      passwordHash: userData.passwordHash,
      managerId: userData.managerId,
      approvalLimit: userData.approvalLimit,
      workload: userData.workload || 40,
      isActive: userData.isActive ?? true,
      createdAt: userData.createdAt || new Date(),
      lastLogin: userData.lastLogin
    };
    
    USERS.push(newUser);
    return newUser;
  },

  updateUser: async (uid: string, updates: Partial<User>): Promise<User | null> => {
    await networkDelay(200);
    if (isSupabaseAvailable) {
      return await supabaseService.updateUser(uid, updates);
    }
    
    const userIndex = USERS.findIndex(u => u.uid === uid);
    if (userIndex === -1) return null;
    
    USERS[userIndex] = { ...USERS[userIndex], ...updates };
    return USERS[userIndex];
  },

  deleteUser: async (uid: string): Promise<boolean> => {
    await networkDelay(500);
    
    // Validate that user exists
    const userIndex = USERS.findIndex(u => u.uid === uid);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    
    // Prevent deletion of the last admin
    const adminUsers = USERS.filter(u => u.role === 'admin' && u.isActive);
    const isTargetAdmin = USERS[userIndex].role === 'admin';
    if (isTargetAdmin && adminUsers.length <= 1) {
      throw new Error('Cannot delete the last administrator. Assign admin role to another user first.');
    }
    
    if (isSupabaseAvailable) {
      return await supabaseService.deleteUser(uid);
    }
    
    // For demo purposes, we'll actually remove the user from the array
    // In a real application, you might soft-delete by setting isActive: false
    USERS.splice(userIndex, 1);
    return true;
  },

  // Projects
  getProjects: async (): Promise<Project[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable) {
      return await supabaseService.getProjects();
    }
    return [...PROJECTS];
  },

  createProject: async (name: string, ownerId: string): Promise<Project> => {
    await networkDelay(500);
    
    if (isSupabaseAvailable) {
      return await supabaseService.createProject(name, ownerId);
    }
    
    const colors = ['bg-green-500', 'bg-pink-500', 'bg-purple-500', 'bg-yellow-500', 'bg-blue-500'];
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name,
      ownerId,
      members: [ownerId],
      createdAt: new Date(),
      updatedAt: new Date(),
      color: colors[PROJECTS.length % colors.length],
      isTemplate: false,
      status: 'active',
      visibility: 'team',
      customFields: [],
      tags: [],
    };
    
    PROJECTS.push(newProject);
    return newProject;
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    await networkDelay(400);
    if (isSupabaseAvailable) {
      // MongoDB doesn't have a direct getTasks method, so we'll get all tasks
      const projects = await supabaseService.getProjects();
      const allTasks: Task[] = [];
      for (const project of projects) {
        const projectTasks = await supabaseService.getTasksForProject(project.id);
        allTasks.push(...projectTasks);
      }
      return allTasks;
    }
    return [...TASKS];
  },

  getTaskById: async (taskId: string): Promise<Task | null> => {
    await networkDelay(200);
    if (isSupabaseAvailable) {
      // MongoDB doesn't have a direct getTaskById method, so we'll find from all tasks
      const allTasks = await enhancedApi.getTasks();
      return allTasks.find(t => t.id === taskId) || null;
    }
    return TASKS.find(t => t.id === taskId) || null;
  },

  getTasksForUser: async (userId: string): Promise<Task[]> => {
    await networkDelay(400);
    if (isSupabaseAvailable) {
      return await supabaseService.getTasksForUser(userId);
    }
    return TASKS.filter(t => t.assigneeId === userId);
  },

  getTasksForProject: async (projectId: string): Promise<Task[]> => {
    await networkDelay(400);
    if (isSupabaseAvailable) {
      return await supabaseService.getTasksForProject(projectId);
    }
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
      taskStatus: 'not_started',
      assigneeId: null,
      createdBy: 'user-1',
      dueDate: null,
      startDate: null,
      completedDate: null,
      priority: 'medium',
      order,
      dependencies: [],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: [],
      attachments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (isSupabaseAvailable) {
      const created = await supabaseService.createTask(newTask);
      notify(`tasks:${projectId}`, await supabaseService.getTasksForProject(projectId));
      return created;
    }
    
    TASKS.push(newTask);
    notify(`tasks:${projectId}`, TASKS.filter(t => t.projectId === projectId));
    return newTask;
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    await networkDelay(200);
    
    if (isSupabaseAvailable) {
      const updated = await supabaseService.updateTask(taskId, updates);
      if (updated) {
        notify(`tasks:${updated.projectId}`, await supabaseService.getTasksForProject(updated.projectId));
        return updated;
      }
      throw new Error('Task not found');
    }
    
    let taskIndex = TASKS.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error('Task not found');
    const originalTask = TASKS[taskIndex];
    TASKS[taskIndex] = { ...originalTask, ...updates, updatedAt: new Date() };
    
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

  // Time Tracking
  createTimeEntry: async (taskId: string, userId: string, duration: number, description?: string): Promise<TimeEntry> => {
    await networkDelay(200);
    const newEntry: TimeEntry = {
      id: `time-${Date.now()}`,
      taskId,
      userId,
      duration,
      description,
      startTime: new Date(Date.now() - duration * 60 * 1000),
      endTime: new Date(),
      isRunning: false,
      createdAt: new Date()
    };
    
    if (isSupabaseAvailable) {
      return await supabaseService.createTimeEntry(newEntry);
    }
    
    TIME_ENTRIES.push(newEntry);
    
    // Update task time tracked
    const task = TASKS.find(t => t.id === taskId);
    if (task) {
      task.timeTracked = (task.timeTracked || 0) + duration;
    }
    
    return newEntry;
  },

  getTimeEntriesForTask: async (taskId: string): Promise<TimeEntry[]> => {
    await networkDelay(200);
    if (isSupabaseAvailable) {
      return await supabaseService.getTimeEntriesForTask(taskId);
    }
    return TIME_ENTRIES.filter(e => e.taskId === taskId);
  },

  startTimeTracking: async (taskId: string, userId: string): Promise<TimeEntry> => {
    await networkDelay(100);
    
    // Stop any running timers for this user
    const runningEntries = TIME_ENTRIES.filter(e => e.userId === userId && e.isRunning);
    runningEntries.forEach(e => {
      e.isRunning = false;
      e.endTime = new Date();
      e.duration = Math.floor((e.endTime.getTime() - e.startTime.getTime()) / 60000);
    });
    
    const newEntry: TimeEntry = {
      id: `time-${Date.now()}`,
      taskId,
      userId,
      duration: 0,
      startTime: new Date(),
      isRunning: true,
      createdAt: new Date()
    };
    
    TIME_ENTRIES.push(newEntry);
    return newEntry;
  },

  stopTimeTracking: async (entryId: string): Promise<TimeEntry> => {
    await networkDelay(100);
    const entry = TIME_ENTRIES.find(e => e.id === entryId);
    if (!entry || !entry.isRunning) throw new Error('No running timer found');
    
    entry.isRunning = false;
    entry.endTime = new Date();
    entry.duration = Math.floor((entry.endTime.getTime() - entry.startTime.getTime()) / 60000);
    
    // Update task time tracked
    const task = TASKS.find(t => t.id === entry.taskId);
    if (task) {
      task.timeTracked = (task.timeTracked || 0) + entry.duration;
    }
    
    return entry;
  },

  // Milestones
  getMilestonesForProject: async (projectId: string): Promise<Milestone[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable) {
      return await supabaseService.getMilestonesForProject(projectId);
    }
    return MILESTONES.filter(m => m.projectId === projectId);
  },

  createMilestone: async (milestoneData: Partial<Milestone>): Promise<Milestone> => {
    await networkDelay(300);
    const newMilestone: Milestone = {
      id: `milestone-${Date.now()}`,
      name: milestoneData.name!,
      description: milestoneData.description,
      projectId: milestoneData.projectId!,
      dueDate: milestoneData.dueDate!,
      isCompleted: false,
      tasks: milestoneData.tasks || [],
      createdBy: milestoneData.createdBy!,
      createdAt: new Date()
    };
    
    if (isSupabaseAvailable) {
      return await supabaseService.createMilestone(newMilestone);
    }
    
    MILESTONES.push(newMilestone);
    return newMilestone;
  },

  // Portfolios
  getPortfolios: async (): Promise<Portfolio[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable) {
      return await supabaseService.getPortfolios();
    }
    return [...PORTFOLIOS];
  },

  createPortfolio: async (portfolioData: Partial<Portfolio>): Promise<Portfolio> => {
    await networkDelay(300);
    const newPortfolio: Portfolio = {
      id: `portfolio-${Date.now()}`,
      name: portfolioData.name!,
      description: portfolioData.description,
      ownerId: portfolioData.ownerId!,
      projects: portfolioData.projects || [],
      goals: portfolioData.goals || [],
      status: 'active',
      createdAt: new Date()
    };
    
    if (isSupabaseAvailable) {
      return await supabaseService.createPortfolio(newPortfolio);
    }
    
    PORTFOLIOS.push(newPortfolio);
    return newPortfolio;
  },

  // Goals
  getGoals: async (): Promise<Goal[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable) {
      return await supabaseService.getGoals();
    }
    return [...GOALS];
  },

  createGoal: async (goalData: Partial<Goal>): Promise<Goal> => {
    await networkDelay(300);
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      name: goalData.name!,
      description: goalData.description,
      ownerId: goalData.ownerId!,
      portfolioId: goalData.portfolioId,
      targetDate: goalData.targetDate!,
      status: 'not_started',
      progress: 0,
      keyResults: goalData.keyResults || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    if (isSupabaseAvailable) {
      return await supabaseService.createGoal(newGoal);
    }
    
    GOALS.push(newGoal);
    return newGoal;
  },

  // Comments
  getCommentsForTask: async (taskId: string): Promise<Comment[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable) {
      return await supabaseService.getCommentsForTask(taskId);
    }
    return COMMENTS.filter(c => c.taskId === taskId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  },

  addComment: async (taskId: string, userId: string, text: string): Promise<Comment> => {
    await networkDelay(250);
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      taskId,
      userId,
      text,
      isEdited: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    if (isSupabaseAvailable) {
      const created = await supabaseService.addComment(newComment);
      notify(`comments:${taskId}`, await supabaseService.getCommentsForTask(taskId));
      return created;
    }
    
    COMMENTS.push(newComment);
    notify(`comments:${taskId}`, COMMENTS.filter(c => c.taskId === taskId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    return newComment;
  },

  subscribeToComments: (taskId: string, callback: (comments: Comment[]) => void) => {
    return subscribe(`comments:${taskId}`, callback);
  },

  // Analytics and Reporting
  getProjectAnalytics: async (projectId: string): Promise<any> => {
    await networkDelay(500);
    const tasks = await enhancedApi.getTasksForProject(projectId);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'Done').length;
    const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
    const todoTasks = tasks.filter(t => t.status === 'To Do').length;
    
    const totalTimeTracked = tasks.reduce((sum, task) => sum + (task.timeTracked || 0), 0);
    const totalEstimatedTime = tasks.reduce((sum, task) => sum + (task.estimatedTime || 0), 0);
    
    return {
      projectId,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      totalTimeTracked,
      totalEstimatedTime,
      timeEfficiency: totalEstimatedTime > 0 ? (totalTimeTracked / totalEstimatedTime) * 100 : 0,
      overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done').length
    };
  },

  getWorkloadAnalytics: async (userId: string): Promise<any> => {
    await networkDelay(400);
    const tasks = await enhancedApi.getTasksForUser(userId);
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
    
    const timeEntries = TIME_ENTRIES.filter(e => 
      e.userId === userId && 
      e.startTime >= thisWeek
    );
    
    const weeklyTimeTracked = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
    
    return {
      userId,
      assignedTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status !== 'Done').length,
      overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done').length,
      weeklyTimeTracked,
      weeklyUtilization: (weeklyTimeTracked / (40 * 60)) * 100 // assuming 40 hour work week
    };
  }
};

// Maintain backward compatibility with existing mockApi
export const mockApi = enhancedApi;