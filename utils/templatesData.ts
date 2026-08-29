import { ProjectTemplate } from '../types';

export const ASANA_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'template-agile-sprint',
    name: 'Agile & Scrum Sprint',
    category: 'agile',
    description: 'Manage 2-week agile sprints with backlog groom, sprint planning, development, QA review, and release retrospective.',
    color: 'bg-indigo-600',
    iconName: 'BoltIcon',
    sections: [
      { name: 'Sprint Backlog', color: 'bg-slate-500' },
      { name: 'In Development', color: 'bg-blue-500' },
      { name: 'Code Review & QA', color: 'bg-amber-500' },
      { name: 'Ready to Deploy', color: 'bg-purple-500' },
      { name: 'Done / Released', color: 'bg-emerald-500' },
    ],
    customFields: [
      {
        id: 'cf-story-points',
        name: 'Story Points',
        type: 'number',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-sprint-epic',
        name: 'Epic',
        type: 'dropdown',
        options: ['Authentication', 'Core Platform', 'Billing & Checkout', 'Performance', 'Mobile'],
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-acceptance-criteria',
        name: 'Acceptance Criteria Met',
        type: 'checkbox',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      }
    ],
    brief: {
      overview: 'Sprint 24 Objective: Complete SSO OAuth2 flow, upgrade dashboard latency by 40%, and deliver user permissions audit logs.',
      goals: ['Ship OAuth2 Social Login', 'Sub-200ms API response p95', 'Zero high-severity QA regressions'],
      roles: [
        { role: 'Product Owner', userId: 'user-1' },
        { role: 'Scrum Master', userId: 'user-2' },
        { role: 'Lead QA', userId: 'user-3' },
      ],
      links: [
        { id: 'l-1', title: 'Sprint Architecture Specs', url: 'https://docs.google.com', category: 'docs' },
        { id: 'l-2', title: 'Figma UI Components', url: 'https://figma.com', category: 'design' },
        { id: 'l-3', title: 'GitHub Sprint Branch', url: 'https://github.com', category: 'repo' }
      ]
    },
    sampleTasks: [
      {
        title: 'Draft API contracts & data schema for SSO',
        description: 'Define OpenID Connect endpoints, scopes, and JWT payload validation rules.',
        sectionName: 'In Development',
        priority: 'high',
        daysFromNow: 2,
        estimatedHours: 12,
        tags: ['backend', 'security'],
        subtasks: ['Write OpenAPI 3.0 spec', 'Define session refresh logic', 'Validate role mapping']
      },
      {
        title: 'Design high-fidelity modal states for Auth flow',
        description: 'Implement dark and light UI states for Apple, Google, and GitHub provider buttons.',
        sectionName: 'Code Review & QA',
        priority: 'medium',
        daysFromNow: 4,
        estimatedHours: 8,
        tags: ['design', 'ui'],
        subtasks: ['Desktop modal specs', 'Mobile responsive screen', 'Error feedback alerts']
      },
      {
        title: 'Milestone: Sprint 24 Code Freeze & Staging Smoke Tests',
        description: 'Run automated end-to-end integration suite on staging cluster.',
        sectionName: 'Ready to Deploy',
        priority: 'critical',
        daysFromNow: 7,
        estimatedHours: 6,
        isMilestone: true,
        tags: ['milestone', 'qa']
      },
      {
        title: 'Redis cache optimization for global organization queries',
        description: 'Implement pipeline batching and cache warming for member lists.',
        sectionName: 'Sprint Backlog',
        priority: 'medium',
        daysFromNow: 9,
        estimatedHours: 16,
        tags: ['performance', 'infrastructure']
      }
    ]
  },
  {
    id: 'template-gtm-launch',
    name: 'GTM Product Launch',
    category: 'marketing',
    description: 'Cross-functional launch engine for product marketing, sales enablement, press release, content, and launch day live coordination.',
    color: 'bg-rose-600',
    iconName: 'RocketIcon',
    sections: [
      { name: 'Strategy & Positioning', color: 'bg-blue-500' },
      { name: 'Creative & Messaging', color: 'bg-purple-500' },
      { name: 'Web & PR Deliverables', color: 'bg-amber-500' },
      { name: 'Sales Enablement', color: 'bg-teal-500' },
      { name: 'Launch Day & Post-Launch', color: 'bg-emerald-500' },
    ],
    customFields: [
      {
        id: 'cf-channel',
        name: 'Marketing Channel',
        type: 'dropdown',
        options: ['Product Hunt', 'HackerNews', 'TechCrunch PR', 'Email Newsletter', 'Social Ads', 'Webinar'],
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-budget',
        name: 'Allocated Budget',
        type: 'currency',
        currencyCode: '$',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-launch-stage',
        name: 'Launch Confidence',
        type: 'percentage',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      }
    ],
    brief: {
      overview: 'Deliver Version 3.0 Enterprise Tier across 5 marketing channels to acquire 2,500 active workspace trials in Q1.',
      goals: ['2,500 signups in week 1', '#1 Product of the Day on Product Hunt', '3 tier-one press mentions'],
      roles: [
        { role: 'PMM Lead', userId: 'user-1' },
        { role: 'Design Lead', userId: 'user-2' },
        { role: 'Head of Growth', userId: 'user-3' },
      ],
      links: [
        { id: 'l-4', title: 'Press Kit & Logos', url: 'https://drive.google.com', category: 'docs' },
        { id: 'l-5', title: 'Product Hunt Draft', url: 'https://producthunt.com', category: 'other' }
      ]
    },
    sampleTasks: [
      {
        title: 'Draft Executive Press Release & Pitch Angles',
        description: 'Craft headline hooks focusing on enterprise productivity ROI and AI workflow automation.',
        sectionName: 'Strategy & Positioning',
        priority: 'critical',
        daysFromNow: 3,
        estimatedHours: 10,
        tags: ['pr', 'copywriting'],
        subtasks: ['Write embargoed pitch email', 'Gather CEO quotes', 'Send to tier-1 reporters']
      },
      {
        title: 'Produce 60-second Product Demo Teaser Video',
        description: 'High-energy screencast with kinetic typography and UI transitions.',
        sectionName: 'Creative & Messaging',
        priority: 'high',
        daysFromNow: 6,
        estimatedHours: 24,
        tags: ['video', 'creative']
      },
      {
        title: 'Milestone: Public Launch Day & Global Announcement',
        description: 'Activate landing page, push email newsletter to 45k subscribers, and launch Product Hunt campaign.',
        sectionName: 'Launch Day & Post-Launch',
        priority: 'critical',
        daysFromNow: 12,
        estimatedHours: 14,
        isMilestone: true,
        tags: ['milestone', 'launch']
      }
    ]
  },
  {
    id: 'template-content-calendar',
    name: 'Content Marketing Pipeline',
    category: 'marketing',
    description: 'Track editorial topics from initial brainstorming to SEO keyword research, drafting, peer review, graphic asset design, and publishing.',
    color: 'bg-emerald-600',
    iconName: 'DocumentTextIcon',
    sections: [
      { name: 'Ideation & Pitching', color: 'bg-slate-500' },
      { name: 'Drafting & Research', color: 'bg-blue-500' },
      { name: 'Editorial & SEO Review', color: 'bg-amber-500' },
      { name: 'Design & Graphics', color: 'bg-purple-500' },
      { name: 'Scheduled & Live', color: 'bg-emerald-500' },
    ],
    customFields: [
      {
        id: 'cf-content-type',
        name: 'Content Format',
        type: 'dropdown',
        options: ['Blog Post', 'Case Study', 'Whitepaper', 'Video Script', 'Infographic', 'Newsletter'],
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-target-kw',
        name: 'Target Keyword Search Volume',
        type: 'number',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-editorial-rating',
        name: 'Content Quality Score',
        type: 'rating',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      }
    ],
    brief: {
      overview: 'Publish 8 authoritative engineering and project management deep-dives monthly to increase organic inbound traffic by 65%.',
      goals: ['Rank top 3 for "Enterprise Workflow Automation"', 'Generate 300 MQLs from gated whitepapers'],
      roles: [
        { role: 'Managing Editor', userId: 'user-1' },
        { role: 'Staff Writer', userId: 'user-2' },
        { role: 'SEO Specialist', userId: 'user-3' },
      ]
    },
    sampleTasks: [
      {
        title: 'Deep-Dive: How High-Performing Teams Master Asana Workflows',
        description: '2,200 word comprehensive guide with workflow diagrams, custom field architecture, and automation rules.',
        sectionName: 'Drafting & Research',
        priority: 'high',
        daysFromNow: 3,
        estimatedHours: 8,
        tags: ['seo', 'long-form']
      },
      {
        title: 'Customer Case Study: Scaling Enterprise PM to 500 Engineers',
        description: 'Interview lead architect, compile metric benchmarks, and draft customer spotlight.',
        sectionName: 'Editorial & SEO Review',
        priority: 'medium',
        daysFromNow: 5,
        estimatedHours: 6,
        tags: ['case-study']
      }
    ]
  },
  {
    id: 'template-bug-tracking',
    name: 'Bug & Issue Tracking',
    category: 'engineering',
    description: 'Systematic defect triage system with severity levels, reproduction steps, developer assignment, pull request validation, and verification.',
    color: 'bg-rose-500',
    iconName: 'ShieldAlertIcon',
    sections: [
      { name: 'Incoming / Untriaged', color: 'bg-red-500' },
      { name: 'Under Investigation', color: 'bg-amber-500' },
      { name: 'In Progress (Fixing)', color: 'bg-blue-500' },
      { name: 'QA Staging Verification', color: 'bg-purple-500' },
      { name: 'Resolved & Closed', color: 'bg-emerald-500' },
    ],
    customFields: [
      {
        id: 'cf-severity',
        name: 'Severity Level',
        type: 'dropdown',
        options: ['S1 - Blocker', 'S2 - High Impact', 'S3 - Medium', 'S4 - Cosmetic'],
        isRequired: true,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-environment',
        name: 'Environment',
        type: 'dropdown',
        options: ['Production (Web)', 'Production (iOS)', 'Production (Android)', 'Staging Cluster'],
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-reproducible',
        name: '100% Reproducible',
        type: 'checkbox',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      }
    ],
    brief: {
      overview: 'Central issue tracker for platform reliability, client bug reports, and regression triage with SLAs based on severity.',
      goals: ['S1 bugs resolved within 4 hours', 'Zero open S1/S2 issues before weekly release'],
      roles: [
        { role: 'Bug Master', userId: 'user-1' },
        { role: 'On-Call Engineer', userId: 'user-2' },
      ]
    },
    sampleTasks: [
      {
        title: 'Fix: Timezone offset calculation in recurring task scheduler',
        description: 'Tasks scheduled across daylight savings boundary fire 1 hour earlier than configured.',
        sectionName: 'In Progress (Fixing)',
        priority: 'critical',
        daysFromNow: 1,
        estimatedHours: 4,
        tags: ['bug', 'scheduler']
      },
      {
        title: 'Fix: CSV Export special characters encoding error',
        description: 'Commas inside task description cells split columns incorrectly on Windows Excel.',
        sectionName: 'Under Investigation',
        priority: 'medium',
        daysFromNow: 2,
        estimatedHours: 3,
        tags: ['export', 'csv']
      }
    ]
  },
  {
    id: 'template-employee-onboarding',
    name: 'New Employee Onboarding',
    category: 'hr',
    description: 'Ensure smooth onboarding with equipment setup, 1-on-1 mentor pairings, compliance training, company culture intro, and 30/60/90 milestones.',
    color: 'bg-teal-600',
    iconName: 'UserPlusIcon',
    sections: [
      { name: 'Pre-Arrival Checklist (T-7 Days)', color: 'bg-blue-500' },
      { name: 'Day 1: Welcome & Setup', color: 'bg-indigo-500' },
      { name: 'Week 1: Foundations & Systems', color: 'bg-purple-500' },
      { name: 'First 30 Days: Core Contribution', color: 'bg-amber-500' },
      { name: '60-90 Days: Autonomy & Review', color: 'bg-emerald-500' },
    ],
    customFields: [
      {
        id: 'cf-department',
        name: 'Department',
        type: 'dropdown',
        options: ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'People Ops'],
        isRequired: true,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-buddy',
        name: 'Assigned Peer Buddy',
        type: 'user',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-onboarding-progress',
        name: 'Onboarding Checklist %',
        type: 'percentage',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      }
    ],
    brief: {
      overview: 'Provide structured support to welcome new team members and empower them to ship their first impactful project within 14 days.',
      goals: ['100% IT security setup on Day 1', 'First PR merged in week 1', '30-day feedback review completed'],
      roles: [
        { role: 'Hiring Manager', userId: 'user-1' },
        { role: 'People Partner', userId: 'user-2' },
      ]
    },
    sampleTasks: [
      {
        title: 'Provision MacBook Pro, 1Password, and GitHub workspace access',
        description: 'Send tracking number, confirm security keys delivery, and generate single-sign-on credentials.',
        sectionName: 'Pre-Arrival Checklist (T-7 Days)',
        priority: 'high',
        daysFromNow: 1,
        estimatedHours: 2,
        tags: ['it', 'security']
      },
      {
        title: 'Schedule Team Lunch & 1-on-1 Mentor Introduction',
        description: 'Introduce to buddy, walk through communication norms, and configure Slack channels.',
        sectionName: 'Day 1: Welcome & Setup',
        priority: 'medium',
        daysFromNow: 1,
        estimatedHours: 2,
        tags: ['culture']
      }
    ]
  },
  {
    id: 'template-event-planning',
    name: 'Event & Conference Planning',
    category: 'operations',
    description: 'Coordinate venue selection, sponsor outreach, speaker booking, ticketing platform, catering, AV tech rehearsal, and attendee survey.',
    color: 'bg-amber-600',
    iconName: 'CalendarIcon',
    sections: [
      { name: 'Venue & Logistics', color: 'bg-slate-500' },
      { name: 'Speakers & Agenda', color: 'bg-blue-500' },
      { name: 'Sponsorships & Vendors', color: 'bg-amber-500' },
      { name: 'Promotion & Ticket Sales', color: 'bg-purple-500' },
      { name: 'Event Day Execution', color: 'bg-emerald-500' },
    ],
    customFields: [
      {
        id: 'cf-event-cost',
        name: 'Vendor Cost',
        type: 'currency',
        currencyCode: '$',
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      },
      {
        id: 'cf-sponsor-tier',
        name: 'Sponsor Tier',
        type: 'dropdown',
        options: ['Title Partner ($50k)', 'Gold ($20k)', 'Silver ($10k)', 'Community ($2.5k)'],
        isRequired: false,
        isLocked: false,
        createdBy: 'system',
        createdAt: new Date(),
      }
    ],
    brief: {
      overview: 'Annual Enterprise User Conference: 600 attendees, 24 technical talks, and $150k in sponsor commitments.',
      goals: ['Sell out 600 tickets 2 weeks before event', 'Secure $150k sponsorships', 'NPS score > 60'],
      roles: [
        { role: 'Event Director', userId: 'user-1' },
        { role: 'Sponsorship Lead', userId: 'user-2' },
      ]
    },
    sampleTasks: [
      {
        title: 'Confirm Keynote Speaker agreements and travel lodging',
        description: 'Execute speaker contracts, gather presentation slides, and arrange hotel suites.',
        sectionName: 'Speakers & Agenda',
        priority: 'critical',
        daysFromNow: 15,
        estimatedHours: 12,
        tags: ['speakers', 'contracts']
      },
      {
        title: 'AV & Live Stream Multi-Cam System Tech Rehearsal',
        description: 'Test audio lavaliers, stage lighting, slide clickers, and backup YouTube private stream.',
        sectionName: 'Event Day Execution',
        priority: 'high',
        daysFromNow: 30,
        estimatedHours: 8,
        tags: ['av', 'logistics']
      }
    ]
  }
];
