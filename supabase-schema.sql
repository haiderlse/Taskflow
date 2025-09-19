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
    start_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE,
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

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users policies
CREATE POLICY "Users can view all active users" ON users FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Users can update their own profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = uid);
CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users WHERE uid = auth.uid() AND role = 'admin' AND is_active = true
    )
);

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
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for demo purposes
INSERT INTO users (uid, email, display_name, role, workload, is_active) VALUES
    ('00000000-0000-0000-0000-000000000001', 'ali@example.com', 'Ali', 'admin', 40, true),
    ('00000000-0000-0000-0000-000000000002', 'bob@example.com', 'Bob', 'manager', 35, true),
    ('00000000-0000-0000-0000-000000000003', 'charlie@example.com', 'Charlie', 'member', 40, true);

INSERT INTO projects (id, name, owner_id, members, color, status, visibility, tags) VALUES
    ('proj-1', 'AOP 2025-26', '00000000-0000-0000-0000-000000000001', 
     ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
     'bg-green-500', 'active', 'team', ARRAY['planning']),
    ('proj-2', 'Retail Store', '00000000-0000-0000-0000-000000000001', 
     ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'], 
     'bg-purple-500', 'active', 'team', ARRAY['retail']),
    ('proj-3', 'Shahlimar Franchise', '00000000-0000-0000-0000-000000000002', 
     ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
     'bg-pink-500', 'active', 'team', ARRAY['franchise']),
    ('proj-4', 'Dvago', '00000000-0000-0000-0000-000000000001', 
     ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
     'bg-gray-400', 'archived', 'team', ARRAY['tech']),
    ('proj-5', 'Mungwao', '00000000-0000-0000-0000-000000000002', 
     ARRAY['00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003'], 
     'bg-pink-500', 'archived', 'team', ARRAY['platform']);

INSERT INTO tasks (id, title, description, status, task_status, project_id, assignee_id, created_by, priority, "order", time_tracked) VALUES
    ('task-1', 'Follow up on Pharma Receivables Plan', 'Contact finance department.', 'In Progress', 'in_progress', 'proj-1', 
     '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'high', 0, 120),
    ('task-2', 'Update Q4 Financial Projections', 'Review and update financial models.', 'To Do', 'not_started', 'proj-1', 
     '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'medium', 1, 0),
    ('task-3', 'Design Store Layout', 'Create initial store layout design.', 'Done', 'completed', 'proj-2', 
     '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'high', 0, 240);