import { 
  User, 
  Project, 
  Task, 
  Comment, 
  ColumnId, 
  TimeEntry, 
  Milestone, 
  Portfolio, 
  Goal,
  ProjectHealthStatus,
  ProjectSection,
  ProjectStatusUpdate,
  ProjectBrief,
  ProjectTemplate,
  CustomField,
  TaskActivity
} from '../types';
import { supabaseService } from './supabaseService';
import { generateNextRecurringTask, createActivityLog } from '../utils/asanaUtils';
import { ASANA_TEMPLATES } from '../utils/templatesData';
import { notificationService } from './notificationService';

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
    name: 'AOP 2025-26 Enterprise Plan', 
    description: 'Annual operating plan, financial forecasts, and resource allocation for 2025-2026.',
    ownerId: 'user-1', 
    members: ['user-1', 'user-2', 'user-3'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-emerald-600',
    isTemplate: false,
    status: 'active',
    healthStatus: 'on_track',
    sections: [
      { id: 'sec-101', name: 'Strategic Planning', order: 0, color: 'bg-blue-500' },
      { id: 'sec-102', name: 'Budget & Financial Modeling', order: 1, color: 'bg-emerald-500' },
      { id: 'sec-103', name: 'Executive Signoff & Execution', order: 2, color: 'bg-purple-500' },
    ],
    brief: {
      overview: 'Strategic Annual Operating Plan (AOP) for FY25-26 targeting 35% ARR growth and enterprise expansion.',
      goals: ['Finalize departmental headcount budgets by Nov 30', 'Consolidate tech stack for $120k cost savings', 'Present deck to Board of Directors'],
      roles: [
        { role: 'Project Owner', userId: 'user-1' },
        { role: 'Financial Analyst', userId: 'user-2' },
        { role: 'Operations Lead', userId: 'user-3' },
      ],
      links: [
        { id: 'l-1', title: 'Financial Modeling Sheet', url: 'https://docs.google.com/spreadsheets', category: 'sheet' },
        { id: 'l-2', title: 'Board Presentation Pitch Deck', url: 'https://docs.google.com/presentation', category: 'docs' },
      ]
    },
    statusUpdates: [
      {
        id: 'su-1',
        projectId: 'proj-1',
        authorId: 'user-1',
        status: 'on_track',
        title: 'Q3 Financial Audits Complete - Headcount Targets Approved',
        summary: 'All departmental budgets have passed stage 1 review. We are currently finalizing tech stack renewals.',
        blockers: 'Awaiting final vendor quotes from cloud provider.',
        nextSteps: 'Consolidate final numbers into Board pitch deck by Friday.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ],
    visibility: 'team',
    customFields: [
      {
        id: 'cf-budget-est',
        name: 'Estimated Budget',
        type: 'currency',
        currencyCode: '$',
        isRequired: false,
        isLocked: false,
        createdBy: 'user-1',
        createdAt: new Date()
      },
      {
        id: 'cf-dept',
        name: 'Department',
        type: 'dropdown',
        options: ['Finance', 'Engineering', 'Operations', 'Executive'],
        isRequired: false,
        isLocked: false,
        createdBy: 'user-1',
        createdAt: new Date()
      },
      {
        id: 'cf-completion-pct',
        name: 'Completion %',
        type: 'percentage',
        isRequired: false,
        isLocked: false,
        createdBy: 'user-1',
        createdAt: new Date()
      }
    ],
    tags: ['planning', 'annual', 'finance']
  },
  { 
    id: 'proj-2', 
    name: 'Retail Store Digital Hub', 
    description: 'Retail POS integration and physical franchise storefront inventory rollout.',
    ownerId: 'user-2', 
    members: ['user-2', 'user-1'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-pink-600',
    isTemplate: false,
    status: 'active',
    healthStatus: 'at_risk',
    sections: [
      { id: 'sec-201', name: 'Inventory & POS Setup', order: 0, color: 'bg-amber-500' },
      { id: 'sec-202', name: 'Staff Training & Onboarding', order: 1, color: 'bg-blue-500' },
      { id: 'sec-203', name: 'Store Opening & Live Ops', order: 2, color: 'bg-emerald-500' },
    ],
    brief: {
      overview: 'Digital retail expansion across 15 flagship retail locations with unified cloud checkout.',
      goals: ['Complete hardware install in 15 locations', 'Zero POS downtime during peak hours'],
      roles: [
        { role: 'Retail Director', userId: 'user-2' },
        { role: 'Tech Integrator', userId: 'user-1' }
      ]
    },
    statusUpdates: [
      {
        id: 'su-2',
        projectId: 'proj-2',
        authorId: 'user-2',
        status: 'at_risk',
        title: 'Hardware Delivery Delay on Barcode Scanners',
        summary: 'Shipment of 30 barcode scanners delayed by 4 business days due to regional customs inspection.',
        blockers: 'Store 4 and Store 7 opening dates may need to shift by 3 days.',
        nextSteps: 'Expedite backup inventory from local supplier.',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000)
      }
    ],
    visibility: 'team',
    customFields: [
      {
        id: 'cf-store-loc',
        name: 'Location Tier',
        type: 'dropdown',
        options: ['Tier 1 Flagship', 'Mall Kiosk', 'Suburban Hub'],
        isRequired: false,
        isLocked: false,
        createdBy: 'user-2',
        createdAt: new Date()
      }
    ],
    tags: ['retail', 'hardware']
  },
  { 
    id: 'proj-3', 
    name: 'Shahlimar Franchise Expansion', 
    ownerId: 'user-1', 
    members: ['user-1', 'user-3'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-purple-600',
    isTemplate: false,
    status: 'active',
    healthStatus: 'on_track',
    sections: [
      { id: 'sec-301', name: 'Site Evaluation & Permitting', order: 0, color: 'bg-indigo-500' },
      { id: 'sec-302', name: 'Fit-out & Architecture', order: 1, color: 'bg-blue-500' },
      { id: 'sec-303', name: 'Grand Launch', order: 2, color: 'bg-emerald-500' },
    ],
    visibility: 'team',
    customFields: [],
    tags: ['franchise', 'growth']
  },
  { 
    id: 'proj-4', 
    name: 'Dvago Omnichannel Platform', 
    ownerId: 'user-1', 
    members: ['user-1', 'user-2', 'user-3'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-indigo-600',
    isTemplate: false,
    status: 'active',
    healthStatus: 'on_track',
    sections: [
      { id: 'sec-401', name: 'Backlog', order: 0, color: 'bg-slate-500' },
      { id: 'sec-402', name: 'In Development', order: 1, color: 'bg-blue-500' },
      { id: 'sec-403', name: 'Testing & QA', order: 2, color: 'bg-amber-500' },
      { id: 'sec-404', name: 'Production Released', order: 3, color: 'bg-emerald-500' },
    ],
    visibility: 'team',
    customFields: [],
    tags: ['tech', 'platform']
  },
  { 
    id: 'proj-5', 
    name: 'Mungwao Customer Delivery', 
    ownerId: 'user-2', 
    members: ['user-2', 'user-3'], 
    createdAt: new Date(), 
    updatedAt: new Date(),
    color: 'bg-amber-600',
    isTemplate: false,
    status: 'active',
    healthStatus: 'on_track',
    sections: [
      { id: 'sec-501', name: 'Fleet Ops', order: 0, color: 'bg-blue-500' },
      { id: 'sec-502', name: 'Route Optimization', order: 1, color: 'bg-emerald-500' },
    ],
    visibility: 'team',
    customFields: [],
    tags: ['logistics']
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
      dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000), 
      startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedDate: null,
      priority: 'high',
      order: 0, 
      dependencies: [],
      blockedBy: [],
      blocking: ['task-3'],
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
      dueDate: new Date(Date.now() + 18 * 60 * 60 * 1000), 
      startDate: null,
      completedDate: null,
      priority: 'medium',
      order: 1, 
      dependencies: ['task-8'],
      blockedBy: ['task-8'],
      blocking: [],
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
      blockedBy: ['task-1'],
      blocking: [],
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
      blockedBy: [],
      blocking: [],
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
      blockedBy: [],
      blocking: [],
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
      blockedBy: [],
      blocking: [],
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
      blockedBy: [],
      blocking: [],
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
      blockedBy: [],
      blocking: ['task-2'],
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
    const metaEnv = (import.meta as any).env || {};
    const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
    const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url' && supabaseKey !== 'your_supabase_anon_key') {
      await supabaseService.getUsers();
      isSupabaseAvailable = true;
      console.log('Using Supabase database');
    } else {
      isSupabaseAvailable = false;
    }
  } catch (error) {
    console.warn('Supabase not available, using local store:', error);
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

  createProject: async (nameOrData: string | Partial<Project>, ownerId?: string, extraData?: Partial<Project>): Promise<Project> => {
    await networkDelay(300);
    
    let projectData: Partial<Project> = {};
    if (typeof nameOrData === 'object') {
      projectData = { ...nameOrData };
    } else {
      projectData = {
        name: nameOrData,
        ownerId: ownerId || 'user-1',
        ...extraData
      };
    }
    
    const colors = ['bg-green-500', 'bg-pink-500', 'bg-purple-500', 'bg-yellow-500', 'bg-blue-500', 'bg-indigo-500'];
    const newProject: Project = {
      id: projectData.id || `proj-${Date.now()}`,
      name: projectData.name || 'New Project',
      description: projectData.description || '',
      ownerId: projectData.ownerId || 'user-1',
      members: projectData.members || [projectData.ownerId || 'user-1', 'user-2'],
      createdAt: new Date(),
      updatedAt: new Date(),
      color: projectData.color || colors[PROJECTS.length % colors.length],
      isTemplate: !!projectData.isTemplate,
      status: projectData.status || 'active',
      healthStatus: projectData.healthStatus || 'on_track',
      visibility: projectData.visibility || 'team',
      sections: projectData.sections || [
        { id: `sec-${Date.now()}-1`, name: 'To Do', order: 0, color: 'bg-blue-500' },
        { id: `sec-${Date.now()}-2`, name: 'In Progress', order: 1, color: 'bg-amber-500' },
        { id: `sec-${Date.now()}-3`, name: 'Done', order: 2, color: 'bg-emerald-500' },
      ],
      customFields: projectData.customFields || [],
      tags: projectData.tags || [],
    };

    if (isSupabaseAvailable) {
      return await supabaseService.createProject(newProject.name, newProject.ownerId);
    }
    
    PROJECTS.push(newProject);
    return newProject;
  },

  updateProject: async (projectId: string, updates: Partial<Project>): Promise<Project> => {
    await networkDelay(200);
    const index = PROJECTS.findIndex(p => p.id === projectId);
    if (index === -1) throw new Error('Project not found');
    PROJECTS[index] = { ...PROJECTS[index], ...updates, updatedAt: new Date() };
    if (isSupabaseAvailable) {
      await (supabaseService as any).updateProject?.(projectId, updates);
    }
    return PROJECTS[index];
  },

  deleteProject: async (projectId: string): Promise<boolean> => {
    await networkDelay(200);
    const index = PROJECTS.findIndex(p => p.id === projectId);
    if (index === -1) return false;
    PROJECTS.splice(index, 1);
    const remainingTasks = TASKS.filter(t => t.projectId !== projectId);
    TASKS.length = 0;
    TASKS.push(...remainingTasks);
    return true;
  },

  // Tasks
  getTasks: async (): Promise<Task[]> => {
    await networkDelay(400);
    if (isSupabaseAvailable) {
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

  createTask: async (
    titleOrTask: string | Partial<Task>, 
    projectId?: string, 
    status?: ColumnId,
    extraData?: Partial<Task>
  ): Promise<Task> => {
    await networkDelay(300);
    
    let taskData: Partial<Task> = {};
    if (typeof titleOrTask === 'object') {
      taskData = { ...titleOrTask };
    } else {
      taskData = {
        title: titleOrTask,
        projectId: projectId || 'proj-1',
        status: status || 'To Do',
        ...extraData
      };
    }

    const effectiveProjectId = taskData.projectId || 'proj-1';
    const effectiveStatus = taskData.status || 'To Do';
    const order = TASKS.filter(t => t.projectId === effectiveProjectId && t.status === effectiveStatus).length;

    const newTask: Task = {
      id: taskData.id || `task-${Date.now()}`,
      projectId: effectiveProjectId,
      sectionId: taskData.sectionId,
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      status: effectiveStatus,
      taskStatus: taskData.taskStatus || 'not_started',
      assigneeId: taskData.assigneeId !== undefined ? taskData.assigneeId : null,
      collaboratorIds: taskData.collaboratorIds || [],
      createdBy: taskData.createdBy || 'user-1',
      dueDate: taskData.dueDate || null,
      startDate: taskData.startDate || null,
      completedDate: taskData.completedDate || null,
      priority: taskData.priority || 'medium',
      order: taskData.order !== undefined ? taskData.order : order,
      dependencies: taskData.dependencies || [],
      blockedBy: taskData.blockedBy || taskData.dependencies || [],
      blocking: taskData.blocking || [],
      subtasks: taskData.subtasks || [],
      subtaskItems: taskData.subtaskItems || [],
      timeTracked: taskData.timeTracked || 0,
      estimatedTime: taskData.estimatedTime || 0,
      customFields: taskData.customFields || {},
      tags: taskData.tags || [],
      attachments: taskData.attachments || [],
      isMilestone: !!taskData.isMilestone,
      recurrence: taskData.recurrence,
      createdAt: taskData.createdAt || new Date(),
      updatedAt: taskData.updatedAt || new Date(),
    };
    
    if (isSupabaseAvailable) {
      const created = await supabaseService.createTask(newTask);
      notify(`tasks:${effectiveProjectId}`, await supabaseService.getTasksForProject(effectiveProjectId));
      if (newTask.assigneeId) {
        const creator = USERS.find(u => u.uid === newTask.createdBy) || { uid: newTask.createdBy, displayName: 'Team Member' };
        const project = PROJECTS.find(p => p.id === effectiveProjectId);
        notificationService.notifyTaskAssignment(newTask, creator, { uid: newTask.assigneeId }, project);
      }
      return created;
    }
    
    TASKS.push(newTask);
    notify(`tasks:${effectiveProjectId}`, TASKS.filter(t => t.projectId === effectiveProjectId));

    if (newTask.assigneeId) {
      const creator = USERS.find(u => u.uid === newTask.createdBy) || { uid: newTask.createdBy, displayName: 'Team Member' };
      const project = PROJECTS.find(p => p.id === effectiveProjectId);
      notificationService.notifyTaskAssignment(newTask, creator, { uid: newTask.assigneeId }, project);
    }
    return newTask;
  },

  deleteTask: async (taskId: string): Promise<boolean> => {
    await networkDelay(200);
    const taskIndex = TASKS.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return false;
    const task = TASKS[taskIndex];
    TASKS.splice(taskIndex, 1);
    
    TASKS.forEach(t => {
      if (t.blockedBy) t.blockedBy = t.blockedBy.filter(id => id !== taskId);
      if (t.dependencies) t.dependencies = t.dependencies.filter(id => id !== taskId);
      if (t.blocking) t.blocking = t.blocking.filter(id => id !== taskId);
    });
    
    if (isSupabaseAvailable) {
      await (supabaseService as any).deleteTask?.(taskId);
    }
    notify(`tasks:${task.projectId}`, TASKS.filter(t => t.projectId === task.projectId));
    return true;
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

    // Normalize dependencies / blockedBy
    let normalizedUpdates = { ...updates };
    if (updates.blockedBy !== undefined) {
      normalizedUpdates.dependencies = [...updates.blockedBy];
    } else if (updates.dependencies !== undefined && updates.blockedBy === undefined) {
      normalizedUpdates.blockedBy = [...updates.dependencies];
    }

    // Bidirectional sync for blockedBy / dependencies:
    if (normalizedUpdates.blockedBy !== undefined) {
      const oldBlockers = originalTask.blockedBy || originalTask.dependencies || [];
      const newBlockers = normalizedUpdates.blockedBy;
      
      // For removed blockers, remove this task from their blocking list
      const removedBlockers = oldBlockers.filter(id => !newBlockers.includes(id));
      removedBlockers.forEach(blockerId => {
        const blocker = TASKS.find(t => t.id === blockerId);
        if (blocker) {
          blocker.blocking = (blocker.blocking || []).filter(id => id !== taskId);
        }
      });

      // For added blockers, add this task to their blocking list
      const addedBlockers = newBlockers.filter(id => !oldBlockers.includes(id));
      addedBlockers.forEach(blockerId => {
        const blocker = TASKS.find(t => t.id === blockerId);
        if (blocker) {
          blocker.blocking = Array.from(new Set([...(blocker.blocking || []), taskId]));
        }
      });
    }

    // Bidirectional sync for blocking:
    if (normalizedUpdates.blocking !== undefined) {
      const oldDependents = originalTask.blocking || [];
      const newDependents = normalizedUpdates.blocking;

      // For removed dependents, remove this task from their blockedBy and dependencies list
      const removedDependents = oldDependents.filter(id => !newDependents.includes(id));
      removedDependents.forEach(depId => {
        const dependent = TASKS.find(t => t.id === depId);
        if (dependent) {
          dependent.blockedBy = (dependent.blockedBy || []).filter(id => id !== taskId);
          dependent.dependencies = (dependent.dependencies || []).filter(id => id !== taskId);
        }
      });

      // For added dependents, add this task to their blockedBy and dependencies list
      const addedDependents = newDependents.filter(id => !oldDependents.includes(id));
      addedDependents.forEach(depId => {
        const dependent = TASKS.find(t => t.id === depId);
        if (dependent) {
          dependent.blockedBy = Array.from(new Set([...(dependent.blockedBy || []), taskId]));
          dependent.dependencies = Array.from(new Set([...(dependent.dependencies || []), taskId]));
        }
      });
    }

    // Auto-create next recurring task if task completed
    if (updates.status === 'Done' && originalTask.status !== 'Done' && originalTask.recurrence) {
      const nextTask = generateNextRecurringTask(originalTask, originalTask.assigneeId || 'user-1');
      if (nextTask) {
        TASKS.push(nextTask);
        setTimeout(() => {
          notify(`tasks:${originalTask.projectId}`, TASKS.filter(t => t.projectId === originalTask.projectId));
        }, 100);
      }
    }

    TASKS[taskIndex] = { ...originalTask, ...normalizedUpdates, updatedAt: new Date() };
    const updatedTask = TASKS[taskIndex];
    
    // Trigger notification if assignee was changed
    if (updates.assigneeId && updates.assigneeId !== originalTask.assigneeId) {
      const project = PROJECTS.find(p => p.id === updatedTask.projectId);
      notificationService.notifyTaskAssignment(
        updatedTask, 
        { uid: 'user-1', displayName: 'Team Member' }, 
        { uid: updates.assigneeId }, 
        project
      );
    }

    // Trigger notification if task completed unblocks dependent tasks
    if (updates.status === 'Done' && originalTask.status !== 'Done') {
      const dependents = TASKS.filter(t => 
        (t.blockedBy && t.blockedBy.includes(taskId)) || 
        (t.dependencies && t.dependencies.includes(taskId))
      );
      dependents.forEach(depTask => {
        if (depTask.assigneeId) {
          notificationService.createNotification({
            userId: depTask.assigneeId,
            type: 'blocker_cleared',
            title: '🔓 Prerequisite Unblocked',
            message: `"${originalTask.title}" was completed. You can now begin work on "${depTask.title}".`,
            taskId: depTask.id,
            taskTitle: depTask.title,
            projectId: depTask.projectId,
            authorName: 'System Monitor',
            priority: depTask.priority || 'medium'
          });
        }
      });
    }

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

  // Helper for adding a dependency (taskId is blocked by blockerId)
  addDependency: async (taskId: string, blockerId: string): Promise<Task> => {
    if (taskId === blockerId) {
      throw new Error("A task cannot depend on itself");
    }
    const task = TASKS.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found");

    const currentBlockers = task.blockedBy || task.dependencies || [];
    if (!currentBlockers.includes(blockerId)) {
      return await enhancedApi.updateTask(taskId, {
        blockedBy: [...currentBlockers, blockerId]
      });
    }
    return task;
  },

  // Helper for removing a dependency (taskId no longer blocked by blockerId)
  removeDependency: async (taskId: string, blockerId: string): Promise<Task> => {
    const task = TASKS.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found");

    const currentBlockers = task.blockedBy || task.dependencies || [];
    return await enhancedApi.updateTask(taskId, {
      blockedBy: currentBlockers.filter(id => id !== blockerId)
    });
  },

  // Helper for adding a dependent (taskId blocks dependentId)
  addDependent: async (taskId: string, dependentId: string): Promise<Task> => {
    if (taskId === dependentId) {
      throw new Error("A task cannot block itself");
    }
    const task = TASKS.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found");

    const currentDependents = task.blocking || [];
    if (!currentDependents.includes(dependentId)) {
      return await enhancedApi.updateTask(taskId, {
        blocking: [...currentDependents, dependentId]
      });
    }
    return task;
  },

  // Helper for removing a dependent (taskId no longer blocks dependentId)
  removeDependent: async (taskId: string, dependentId: string): Promise<Task> => {
    const task = TASKS.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found");

    const currentDependents = task.blocking || [];
    return await enhancedApi.updateTask(taskId, {
      blocking: currentDependents.filter(id => id !== dependentId)
    });
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
    
    if (isSupabaseAvailable && (supabaseService as any).createTimeEntry) {
      return await (supabaseService as any).createTimeEntry(newEntry);
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
    if (isSupabaseAvailable && (supabaseService as any).getTimeEntriesForTask) {
      return await (supabaseService as any).getTimeEntriesForTask(taskId);
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
    if (isSupabaseAvailable && (supabaseService as any).getMilestonesForProject) {
      return await (supabaseService as any).getMilestonesForProject(projectId);
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
    
    if (isSupabaseAvailable && (supabaseService as any).createMilestone) {
      return await (supabaseService as any).createMilestone(newMilestone);
    }
    
    MILESTONES.push(newMilestone);
    return newMilestone;
  },

  // Portfolios
  getPortfolios: async (): Promise<Portfolio[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable && (supabaseService as any).getPortfolios) {
      return await (supabaseService as any).getPortfolios();
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
    
    if (isSupabaseAvailable && (supabaseService as any).createPortfolio) {
      return await (supabaseService as any).createPortfolio(newPortfolio);
    }
    
    PORTFOLIOS.push(newPortfolio);
    return newPortfolio;
  },

  updatePortfolio: async (portfolioId: string, updates: Partial<Portfolio>): Promise<Portfolio> => {
    await networkDelay(200);
    const idx = PORTFOLIOS.findIndex(p => p.id === portfolioId);
    if (idx !== -1) {
      PORTFOLIOS[idx] = { ...PORTFOLIOS[idx], ...updates };
      return PORTFOLIOS[idx];
    }
    const updated: Portfolio = {
      id: portfolioId,
      name: updates.name || 'Portfolio',
      description: updates.description,
      ownerId: updates.ownerId || 'user-1',
      projects: updates.projects || [],
      goals: updates.goals || [],
      status: updates.status || 'active',
      createdAt: new Date(),
      ...updates,
    };
    PORTFOLIOS.push(updated);
    return updated;
  },

  deletePortfolio: async (portfolioId: string): Promise<void> => {
    await networkDelay(200);
    PORTFOLIOS = PORTFOLIOS.filter(p => p.id !== portfolioId);
  },

  // Goals
  getGoals: async (): Promise<Goal[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable && (supabaseService as any).getGoals) {
      return await (supabaseService as any).getGoals();
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
    
    if (isSupabaseAvailable && (supabaseService as any).createGoal) {
      return await (supabaseService as any).createGoal(newGoal);
    }
    
    GOALS.push(newGoal);
    return newGoal;
  },

  updateGoal: async (goalId: string, updates: Partial<Goal>): Promise<Goal> => {
    await networkDelay(200);
    const idx = GOALS.findIndex(g => g.id === goalId);
    if (idx !== -1) {
      GOALS[idx] = { ...GOALS[idx], ...updates, updatedAt: new Date() };
      return GOALS[idx];
    }
    const updated: Goal = {
      id: goalId,
      name: updates.name || 'Goal',
      description: updates.description,
      ownerId: updates.ownerId || 'user-1',
      targetDate: updates.targetDate || new Date(),
      status: updates.status || 'in_progress',
      progress: updates.progress || 0,
      keyResults: updates.keyResults || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...updates,
    };
    GOALS.push(updated);
    return updated;
  },

  deleteGoal: async (goalId: string): Promise<void> => {
    await networkDelay(200);
    GOALS = GOALS.filter(g => g.id !== goalId);
  },

  // Comments
  getCommentsForTask: async (taskId: string): Promise<Comment[]> => {
    await networkDelay(300);
    if (isSupabaseAvailable && (supabaseService as any).getCommentsForTask) {
      return await (supabaseService as any).getCommentsForTask(taskId);
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
    
    const author = USERS.find(u => u.uid === userId) || { uid: userId, displayName: 'Team Member' };
    const task = TASKS.find(t => t.id === taskId);
    const project = task ? PROJECTS.find(p => p.id === task.projectId) : undefined;

    if (isSupabaseAvailable && (supabaseService as any).addComment) {
      const created = await (supabaseService as any).addComment(newComment);
      notify(`comments:${taskId}`, await (supabaseService as any).getCommentsForTask(taskId));
      if (task) {
        notificationService.notifyCommentAdded(created, task, author, USERS, project);
      }
      return created;
    }
    
    COMMENTS.push(newComment);
    notify(`comments:${taskId}`, COMMENTS.filter(c => c.taskId === taskId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
    
    if (task) {
      notificationService.notifyCommentAdded(newComment, task, author, USERS, project);
    }
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
  },

  // Project Templates
  getTemplates: async (): Promise<ProjectTemplate[]> => {
    await networkDelay(200);
    return ASANA_TEMPLATES;
  },

  createProjectFromTemplate: async (templateId: string, projectName: string, ownerId: string): Promise<Project> => {
    await networkDelay(400);
    const template = ASANA_TEMPLATES.find(t => t.id === templateId) || ASANA_TEMPLATES[0];
    
    const newProjectId = `proj-${Date.now()}`;
    const sections: ProjectSection[] = template.sections.map((s, idx) => ({
      id: `sec-${Date.now()}-${idx}`,
      name: s.name,
      order: idx,
      color: s.color || 'bg-blue-500'
    }));

    const newProject: Project = {
      id: newProjectId,
      name: projectName,
      description: template.description,
      ownerId,
      members: [ownerId, 'user-2', 'user-3'],
      createdAt: new Date(),
      updatedAt: new Date(),
      color: template.color,
      isTemplate: false,
      templateId: template.id,
      status: 'active',
      healthStatus: 'on_track',
      sections,
      brief: template.brief ? { ...template.brief } : undefined,
      statusUpdates: [
        {
          id: `su-${Date.now()}`,
          projectId: newProjectId,
          authorId: ownerId,
          status: 'on_track',
          title: `Project Initialized from ${template.name}`,
          summary: `Created project with ${sections.length} workflow sections and pre-configured custom fields.`,
          createdAt: new Date()
        }
      ],
      visibility: 'team',
      customFields: [...template.customFields],
      tags: [template.category]
    };

    PROJECTS.push(newProject);

    // Create sample tasks
    template.sampleTasks.forEach((sample, i) => {
      const section = sections.find(s => s.name === sample.sectionName) || sections[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (sample.daysFromNow || 2));
      const startDate = new Date();

      const newTask: Task = {
        id: `task-${Date.now()}-${i}`,
        projectId: newProjectId,
        sectionId: section?.id,
        title: sample.title,
        description: sample.description,
        status: section?.name.toLowerCase().includes('done') || section?.name.toLowerCase().includes('release') ? 'Done' : 'To Do',
        taskStatus: 'not_started',
        assigneeId: ownerId,
        collaboratorIds: [ownerId, 'user-2'],
        createdBy: ownerId,
        dueDate,
        startDate,
        completedDate: null,
        priority: sample.priority || 'medium',
        order: i,
        dependencies: [],
        blockedBy: [],
        blocking: [],
        subtasks: sample.subtasks || [],
        subtaskItems: (sample.subtasks || []).map((st, sidx) => ({
          id: `st-${Date.now()}-${i}-${sidx}`,
          title: st,
          isCompleted: false
        })),
        timeTracked: 0,
        estimatedTime: sample.estimatedHours ? sample.estimatedHours * 60 : 120,
        customFields: {},
        tags: sample.tags || [],
        attachments: [],
        isMilestone: !!sample.isMilestone,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      TASKS.push(newTask);
    });

    notify(`tasks:${newProjectId}`, TASKS.filter(t => t.projectId === newProjectId));
    return newProject;
  },

  saveProjectAsTemplate: async (projectId: string, templateName: string, category: 'agile' | 'marketing' | 'operations' | 'product' | 'engineering' | 'hr' | 'general', description: string): Promise<ProjectTemplate> => {
    await networkDelay(300);
    const proj = PROJECTS.find(p => p.id === projectId);
    const projTasks = TASKS.filter(t => t.projectId === projectId);

    const newTemplate: ProjectTemplate = {
      id: `template-${Date.now()}`,
      name: templateName,
      category,
      description,
      color: proj?.color || 'bg-blue-600',
      iconName: 'FolderIcon',
      sections: (proj?.sections || [{ id: '1', name: 'To Do', order: 0 }, { id: '2', name: 'In Progress', order: 1 }, { id: '3', name: 'Done', order: 2 }]).map(s => ({ name: s.name, color: s.color })),
      customFields: proj?.customFields || [],
      brief: proj?.brief,
      sampleTasks: projTasks.slice(0, 5).map(t => {
        const sec = proj?.sections?.find(s => s.id === t.sectionId);
        return {
          title: t.title,
          description: t.description,
          sectionName: sec?.name || 'To Do',
          priority: t.priority,
          daysFromNow: 3,
          estimatedHours: t.estimatedTime ? t.estimatedTime / 60 : 2,
          isMilestone: t.isMilestone,
          tags: t.tags
        };
      })
    };

    ASANA_TEMPLATES.push(newTemplate);
    return newTemplate;
  },

  // Project Sections
  addProjectSection: async (projectId: string, name: string, color?: string): Promise<ProjectSection> => {
    await networkDelay(200);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    if (!project.sections) {
      project.sections = [
        { id: `sec-${Date.now()}-1`, name: 'To Do', order: 0, color: 'bg-blue-500' },
        { id: `sec-${Date.now()}-2`, name: 'In Progress', order: 1, color: 'bg-amber-500' },
        { id: `sec-${Date.now()}-3`, name: 'Done', order: 2, color: 'bg-emerald-500' },
      ];
    }

    const newSection: ProjectSection = {
      id: `sec-${Date.now()}`,
      name,
      order: project.sections.length,
      color: color || 'bg-blue-500'
    };

    project.sections.push(newSection);
    return newSection;
  },

  updateProjectSection: async (projectId: string, sectionId: string, updates: Partial<ProjectSection>): Promise<ProjectSection> => {
    await networkDelay(150);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project || !project.sections) throw new Error('Project or sections not found');

    const sec = project.sections.find(s => s.id === sectionId);
    if (!sec) throw new Error('Section not found');

    Object.assign(sec, updates);
    return sec;
  },

  deleteProjectSection: async (projectId: string, sectionId: string): Promise<boolean> => {
    await networkDelay(150);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project || !project.sections) return false;

    project.sections = project.sections.filter(s => s.id !== sectionId);
    // Unassign tasks from this section
    TASKS.filter(t => t.projectId === projectId && t.sectionId === sectionId).forEach(t => {
      t.sectionId = undefined;
    });
    return true;
  },

  // Project Status Updates & Health
  addStatusUpdate: async (projectId: string, update: Partial<ProjectStatusUpdate>): Promise<ProjectStatusUpdate> => {
    await networkDelay(250);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const newUpdate: ProjectStatusUpdate = {
      id: `su-${Date.now()}`,
      projectId,
      authorId: update.authorId || 'user-1',
      status: update.status || 'on_track',
      title: update.title || 'Status Update',
      summary: update.summary || '',
      blockers: update.blockers,
      nextSteps: update.nextSteps,
      createdAt: new Date()
    };

    if (!project.statusUpdates) project.statusUpdates = [];
    project.statusUpdates.unshift(newUpdate);
    project.healthStatus = newUpdate.status;

    return newUpdate;
  },

  updateProjectBrief: async (projectId: string, briefUpdates: Partial<ProjectBrief>): Promise<ProjectBrief> => {
    await networkDelay(200);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    project.brief = {
      ...(project.brief || { overview: '', goals: [], roles: [], links: [] }),
      ...briefUpdates
    };

    return project.brief;
  },

  setProjectHealthStatus: async (projectId: string, healthStatus: ProjectHealthStatus): Promise<Project> => {
    await networkDelay(150);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');
    project.healthStatus = healthStatus;
    return project;
  },

  addProjectCustomField: async (projectId: string, field: Partial<CustomField>): Promise<CustomField> => {
    await networkDelay(200);
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) throw new Error('Project not found');

    const newField: CustomField = {
      id: `cf-${Date.now()}`,
      name: field.name || 'New Custom Field',
      type: field.type || 'text',
      options: field.options || [],
      fieldOptions: field.fieldOptions || [],
      currencyCode: field.currencyCode || '$',
      isRequired: !!field.isRequired,
      isLocked: false,
      createdBy: field.createdBy || 'user-1',
      createdAt: new Date()
    };

    if (!project.customFields) project.customFields = [];
    project.customFields.push(newField);
    return newField;
  },

  // Notifications API
  getNotifications: (userId: string) => {
    return notificationService.getNotifications(userId);
  },

  getUnreadNotificationsCount: (userId: string) => {
    return notificationService.getUnreadCount(userId);
  },

  subscribeToNotifications: (userId: string, callback: (notifications: any[]) => void) => {
    return notificationService.subscribe(userId, callback);
  },

  markNotificationAsRead: (notificationId: string, userId?: string) => {
    notificationService.markAsRead(notificationId, userId);
  },

  markNotificationAsUnread: (notificationId: string, userId?: string) => {
    notificationService.markAsUnread(notificationId, userId);
  },

  markAllNotificationsAsRead: (userId: string) => {
    notificationService.markAllAsRead(userId);
  },

  archiveNotification: (notificationId: string, userId?: string) => {
    notificationService.archiveNotification(notificationId, userId);
  },

  clearAllNotifications: (userId: string) => {
    notificationService.clearAll(userId);
  },

  scanDeadlines: (tasks?: Task[], projects?: Project[]) => {
    notificationService.scanDeadlines(tasks || TASKS, projects || PROJECTS);
  },

  simulateNotification: (user: User, type: any) => {
    return notificationService.simulateLiveNotification(user, type, TASKS, USERS);
  }
};

// Maintain backward compatibility with existing mockApi
export const mockApi = enhancedApi;