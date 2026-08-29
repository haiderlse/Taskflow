-- TaskFlow Supabase Database Schema
-- This file contains the SQL commands to set up your Supabase database for TaskFlow

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    uid UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    avatar TEXT,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    department VARCHAR(255),
    time_zone VARCHAR(100),
    workload INTEGER DEFAULT 40,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    manager_id UUID REFERENCES users(uid),
    approval_limit DECIMAL(15,2)
);

-- Projects table
CREATE TABLE projects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(uid),
    members UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    color VARCHAR(50) DEFAULT 'bg-blue-500',
    is_template BOOLEAN DEFAULT false,
    template_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
    start_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    visibility VARCHAR(50) DEFAULT 'team' CHECK (visibility IN ('public', 'private', 'team')),
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    portfolio_id VARCHAR(255)
);

-- Tasks table
CREATE TABLE tasks (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'To Do' CHECK (status IN ('To Do', 'In Progress', 'Done')),
    task_status VARCHAR(50) DEFAULT 'not_started' CHECK (task_status IN ('not_started', 'in_progress', 'completed', 'on_hold', 'cancelled')),
    project_id VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id UUID REFERENCES users(uid),
    created_by UUID NOT NULL REFERENCES users(uid),
    due_date TIMESTAMP WITH TIME ZONE,
    due_time VARCHAR(5), -- 'HH:mm' local time-of-day for the deadline; NULL means date-only
    start_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
    scheduled_start TIMESTAMP WITH TIME ZONE, -- planner time block
    scheduled_end TIMESTAMP WITH TIME ZONE,
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    dependencies TEXT[] DEFAULT '{}',
    subtasks TEXT[] DEFAULT '{}',
    parent_task_id VARCHAR(255) REFERENCES tasks(id),
    time_tracked INTEGER DEFAULT 0, -- in minutes
    estimated_time INTEGER, -- in minutes
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    attachments JSONB DEFAULT '[]'
);

-- Comments table
CREATE TABLE comments (
    id VARCHAR(255) PRIMARY KEY,
    text TEXT NOT NULL,
    task_id VARCHAR(255) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(uid),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT false,
    attachments JSONB DEFAULT '[]'
);

-- Time entries table
CREATE TABLE time_entries (
    id VARCHAR(255) PRIMARY KEY,
    task_id VARCHAR(255) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(uid),
    duration INTEGER NOT NULL, -- in minutes
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_running BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Milestones table
CREATE TABLE milestones (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_id VARCHAR(255) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    tasks TEXT[] DEFAULT '{}',
    created_by UUID NOT NULL REFERENCES users(uid),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Portfolios table
CREATE TABLE portfolios (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(uid),
    project_ids TEXT[] DEFAULT '{}',
    color VARCHAR(50) DEFAULT 'bg-blue-500',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goals table
CREATE TABLE goals (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(uid),
    team_id VARCHAR(255),
    target_date TIMESTAMP WITH TIME ZONE,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    is_completed BOOLEAN DEFAULT false,
    key_results JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Calendar events table (meetings, focus blocks, reminders)
CREATE TABLE calendar_events (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    type VARCHAR(50) DEFAULT 'meeting' CHECK (type IN ('meeting', 'focus', 'reminder', 'deadline', 'out_of_office', 'personal')),
    owner_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    location VARCHAR(255),
    conference_link TEXT,
    attendees JSONB DEFAULT '[]',       -- [{ userId, email, name, response }]
    project_id VARCHAR(255) REFERENCES projects(id) ON DELETE SET NULL,
    task_ids TEXT[] DEFAULT '{}',
    color VARCHAR(50),
    reminders JSONB DEFAULT '[]',       -- [{ id, minutesBefore, channels }]
    recurrence JSONB,                   -- { frequency, interval, daysOfWeek, until, count }
    exceptions TEXT[] DEFAULT '{}',     -- yyyy-mm-dd occurrences removed from the series
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT calendar_events_time_order CHECK (end_time > start_time)
);

-- Create indexes for better performance
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_comments_task_id ON comments(task_id);
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX idx_milestones_project_id ON milestones(project_id);
CREATE INDEX idx_tasks_scheduled_start ON tasks(scheduled_start);
CREATE INDEX idx_calendar_events_owner_id ON calendar_events(owner_id);
CREATE INDEX idx_calendar_events_start_time ON calendar_events(start_time);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Helper: answers "is the caller an active admin?" without re-entering the
-- users policies. A policy on `users` whose body selects from `users` causes
-- `42P17: infinite recursion detected in policy for relation "users"`, which
-- breaks every read and write on the table. SECURITY DEFINER runs the lookup as
-- the function owner (which owns the table), so RLS is not re-evaluated.
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE uid = auth.uid() AND role = 'admin' AND is_active = true
    );
$$;

-- Users policies
CREATE POLICY "Users can view all active users" ON users FOR SELECT TO authenticated USING (is_active = true);

-- Required for sign-up: the app writes the profile row for the account that was
-- just created, and without this INSERT policy that write is denied, leaving an
-- auth user with no profile and a login that always fails.
CREATE POLICY "Users can create their own profile" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = uid);

CREATE POLICY "Users can update their own profile" ON users FOR UPDATE TO authenticated
    USING (auth.uid() = uid)
    WITH CHECK (auth.uid() = uid);

CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated
    USING (public.is_active_admin())
    WITH CHECK (public.is_active_admin());

-- The UPDATE policy above lets people edit their own row, which on its own would
-- let anyone grant themselves the admin role. These columns are admin-only.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_active_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
        OR NEW.is_active IS DISTINCT FROM OLD.is_active
        OR NEW.manager_id IS DISTINCT FROM OLD.manager_id
        OR NEW.approval_limit IS DISTINCT FROM OLD.approval_limit THEN
        RAISE EXCEPTION 'Only an admin may change role, is_active, manager_id or approval_limit';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER users_prevent_privilege_escalation
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_escalation();

-- Projects policies
CREATE POLICY "Users can view projects they are members of" ON projects FOR SELECT TO authenticated USING (
    auth.uid() = ANY(members) OR 
    visibility = 'public' OR
    (visibility = 'team' AND EXISTS (
        SELECT 1 FROM users WHERE uid = auth.uid() AND is_active = true
    ))
);
CREATE POLICY "Project owners can update their projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users can create projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Project owners can delete their projects" ON projects FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Tasks policies
CREATE POLICY "Users can view tasks in accessible projects" ON tasks FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_id 
        AND (auth.uid() = ANY(members) OR visibility = 'public' OR 
             (visibility = 'team' AND EXISTS (
                 SELECT 1 FROM users WHERE uid = auth.uid() AND is_active = true
             )))
    )
);
CREATE POLICY "Users can update tasks they created or are assigned to" ON tasks FOR UPDATE TO authenticated USING (
    auth.uid() = created_by OR 
    auth.uid() = assignee_id OR
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_id AND auth.uid() = owner_id
    )
);
CREATE POLICY "Users can create tasks in accessible projects" ON tasks FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE id = project_id 
        AND auth.uid() = ANY(members)
    )
);
CREATE POLICY "Users can delete tasks in their projects" ON tasks FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR
    EXISTS (
        SELECT 1 FROM projects
        WHERE id = project_id AND auth.uid() = owner_id
    )
);

-- Comments policies
CREATE POLICY "Users can view comments on accessible tasks" ON comments FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = task_id 
        AND (auth.uid() = ANY(p.members) OR p.visibility = 'public' OR 
             (p.visibility = 'team' AND EXISTS (
                 SELECT 1 FROM users WHERE uid = auth.uid() AND is_active = true
             )))
    )
);
CREATE POLICY "Users can create comments on accessible tasks" ON comments FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = task_id 
        AND auth.uid() = ANY(p.members)
    )
);

-- Time entries policies
CREATE POLICY "Users can view their own time entries" ON time_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own time entries" ON time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own time entries" ON time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Calendar events policies
-- An event is visible to its owner and to anyone listed in the attendees JSON;
-- only the owner can create, change or delete it.
CREATE POLICY "Users can view their own or invited events" ON calendar_events FOR SELECT TO authenticated USING (
    auth.uid() = owner_id
    OR attendees @> jsonb_build_array(jsonb_build_object('userId', auth.uid()::text))
);
CREATE POLICY "Users can create their own events" ON calendar_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update their own events" ON calendar_events FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete their own events" ON calendar_events FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Sample data (disabled)
--
-- These rows are demo accounts. They cannot sign in: there are no matching
-- entries in auth.users, and the app authenticates through Supabase Auth only.
-- Left in place they appear as real teammates in the Team directory and as
-- assignable people on tasks, and the sample projects list them as members, so
-- your own account would not be a member of any of them.
--
-- Uncomment only if you want throwaway data to look at.
-- ---------------------------------------------------------------------------
-- Insert sample data for demo purposes
-- INSERT INTO users (uid, email, display_name, role, workload, is_active) VALUES
--     ('00000000-0000-0000-0000-000000000001', 'ali@example.com', 'Ali', 'admin', 40, true),
--     ('00000000-0000-0000-0000-000000000002', 'bob@example.com', 'Bob', 'manager', 35, true),
--     ('00000000-0000-0000-0000-000000000003', 'charlie@example.com', 'Charlie', 'member', 40, true);

-- INSERT INTO projects (id, name, owner_id, members, color, status, visibility, tags) VALUES
--     ('proj-1', 'AOP 2025-26', '00000000-0000-0000-0000-000000000001', 
--      ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
--      'bg-green-500', 'active', 'team', ARRAY['planning']),
--     ('proj-2', 'Retail Store', '00000000-0000-0000-0000-000000000001', 
--      ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'], 
--      'bg-purple-500', 'active', 'team', ARRAY['retail']),
--     ('proj-3', 'Shahlimar Franchise', '00000000-0000-0000-0000-000000000002', 
--      ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
--      'bg-pink-500', 'active', 'team', ARRAY['franchise']),
--     ('proj-4', 'Dvago', '00000000-0000-0000-0000-000000000001', 
--      ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
--      'bg-gray-400', 'archived', 'team', ARRAY['tech']),
--     ('proj-5', 'Mungwao', '00000000-0000-0000-0000-000000000002', 
--      ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
--      'bg-pink-500', 'archived', 'team', ARRAY['platform']);

-- INSERT INTO tasks (id, title, description, status, task_status, project_id, assignee_id, created_by, priority, "order", time_tracked) VALUES
--     ('task-1', 'Follow up on Pharma Receivables Plan', 'Contact finance department.', 'In Progress', 'in_progress', 'proj-1', 
--      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'high', 0, 120),
--     ('task-2', 'Update Q4 Financial Projections', 'Review and update financial models.', 'To Do', 'not_started', 'proj-1', 
--      '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'medium', 1, 0),
--     ('task-3', 'Design Store Layout', 'Create initial store layout design.', 'Done', 'completed', 'proj-2', 
--      '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'high', 0, 240);
