import type Database from 'better-sqlite3';
import { entityToRow, USER_SPEC, PROJECT_SPEC, TASK_SPEC, type FieldSpec } from './mappers';

const now = new Date().toISOString();

// Copied verbatim from services/enhancedApi.ts:28-33
const USERS = [
  { uid: 'user-1', email: 'ali@example.com', displayName: 'Ali', role: 'admin', workload: 40, isActive: true, createdAt: now },
  { uid: 'user-2', email: 'bob@example.com', displayName: 'Bob', role: 'manager', workload: 35, isActive: true, createdAt: now },
  { uid: 'user-3', email: 'charlie@example.com', displayName: 'Charlie', role: 'member', workload: 40, isActive: true, createdAt: now },
];

// Copied from services/enhancedApi.ts:34-225 — keep every field, including
// sections, brief and statusUpdates, which supabase-schema.sql omitted.
// `new Date(...)` expressions are converted to `.toISOString()` because
// entityToRow throws on naive datetime strings and the seed runs once at startup.
const PROJECTS: Record<string, unknown>[] = [
  {
    id: 'proj-1',
    name: 'AOP 2025-26 Enterprise Plan',
    description: 'Annual operating plan, financial forecasts, and resource allocation for 2025-2026.',
    ownerId: 'user-1',
    members: ['user-1', 'user-2', 'user-3'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
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
        createdAt: new Date().toISOString()
      },
      {
        id: 'cf-dept',
        name: 'Department',
        type: 'dropdown',
        options: ['Finance', 'Engineering', 'Operations', 'Executive'],
        isRequired: false,
        isLocked: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString()
      },
      {
        id: 'cf-completion-pct',
        name: 'Completion %',
        type: 'percentage',
        isRequired: false,
        isLocked: false,
        createdBy: 'user-1',
        createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
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
        createdAt: new Date().toISOString()
      }
    ],
    tags: ['retail', 'hardware']
  },
  {
    id: 'proj-3',
    name: 'Shahlimar Franchise Expansion',
    ownerId: 'user-1',
    members: ['user-1', 'user-3'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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

// Copied from services/enhancedApi.ts:227-431 — keep every field, including
// blockedBy and blocking, which supabase-schema.sql omitted.
const TASKS: Record<string, unknown>[] = [
  {
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Follow up on Pharma Receivables Plan',
    description: 'Contact finance department.',
    status: 'In Progress',
    taskStatus: 'in_progress',
    assigneeId: 'user-1',
    createdBy: 'user-1',
    dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    dueDate: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
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
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function insertAll(db: Database.Database, table: string, rows: Record<string, unknown>[], spec: FieldSpec) {
  for (const entity of rows) {
    const row = entityToRow(entity, spec);
    const cols = Object.keys(row).map((c) => (c === 'order' ? '"order"' : c));
    const stmt = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    db.prepare(stmt).run(...Object.values(row));
  }
}

export function seed(db: Database.Database) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (n > 0) return; // idempotent: only seed an empty database

  db.transaction(() => {
    insertAll(db, 'users', USERS as Record<string, unknown>[], USER_SPEC);
    insertAll(db, 'projects', PROJECTS, PROJECT_SPEC);
    insertAll(db, 'tasks', TASKS, TASK_SPEC);
  })();
}
