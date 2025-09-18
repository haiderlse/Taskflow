import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  User, Project, Task, Comment, TimeEntry, Milestone, 
  Portfolio, Goal, CustomField, Attachment, ApprovalRequest 
} from '../types';

// Types for Supabase database tables
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          uid: string;
          email: string;
          display_name: string;
          avatar?: string;
          role: string;
          department?: string;
          time_zone?: string;
          workload?: number;
          is_active: boolean;
          last_login?: string;
          created_at: string;
          manager_id?: string;
          approval_limit?: number;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      projects: {
        Row: {
          id: string;
          name: string;
          description?: string;
          owner_id: string;
          members: string[];
          created_at: string;
          updated_at: string;
          color: string;
          is_template: boolean;
          template_id?: string;
          status: string;
          start_date?: string;
          due_date?: string;
          visibility: string;
          custom_fields: any;
          tags: string[];
          portfolio_id?: string;
        };
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string;
          status: string;
          task_status: string;
          project_id: string;
          assignee_id?: string;
          created_by: string;
          due_date?: string;
          start_date?: string;
          completed_date?: string;
          priority: string;
          order: number;
          created_at: string;
          updated_at: string;
          dependencies: string[];
          subtasks: string[];
          parent_task_id?: string;
          time_tracked: number;
          estimated_time?: number;
          custom_fields: any;
          tags: string[];
          attachments: any[];
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
    };
  };
}

class SupabaseService {
  private supabase: SupabaseClient<Database> | null = null;
  private isAvailable = false;

  constructor() {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      // Only initialize if we have valid configuration
      if (supabaseUrl && supabaseKey && 
          supabaseUrl !== 'your_supabase_project_url' && 
          supabaseKey !== 'your_supabase_anon_key' &&
          supabaseUrl.startsWith('http')) {
        this.supabase! = createClient<Database>(supabaseUrl, supabaseKey);
        this.isAvailable = true;
      } else {
        console.log('Supabase not configured - using demo mode');
        this.isAvailable = false;
      }
    } catch (error) {
      console.warn('Failed to initialize Supabase:', error);
      this.isAvailable = false;
    }
  }

  private checkAvailability() {
    if (!this.isAvailable || !this.supabase!) {
      throw new Error('Supabase not available');
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    this.checkAvailability();
    const { data, error } = await this.supabase!!
      .from('users')
      .select('*')
      .eq('is_active', true);
    
    if (error) throw error;
    
    return data.map(this.mapUserFromDB);
  }

  async getUserById(uid: string): Promise<User | null> {
    this.checkAvailability();
    const { data, error } = await this.supabase!
      .from('users')
      .select('*')
      .eq('uid', uid)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    
    return this.mapUserFromDB(data);
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const dbUser = this.mapUserToDB(userData as User);
    const { data, error } = await this.supabase!
      .from('users')
      .insert(dbUser)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.mapUserFromDB(data);
  }

  async updateUser(uid: string, updates: Partial<User>): Promise<User> {
    const dbUpdates = this.mapUserUpdatesToDB(updates);
    const { data, error } = await this.supabase!
      .from('users')
      .update(dbUpdates)
      .eq('uid', uid)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.mapUserFromDB(data);
  }

  async deleteUser(uid: string): Promise<boolean> {
    const { error } = await this.supabase!
      .from('users')
      .update({ is_active: false })
      .eq('uid', uid);
    
    if (error) throw error;
    
    return true;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    const { data, error } = await this.supabase!
      .from('projects')
      .select('*')
      .eq('status', 'active');
    
    if (error) throw error;
    
    return data.map(this.mapProjectFromDB);
  }

  async createProject(name: string, ownerId: string): Promise<Project> {
    const colors = ['bg-green-500', 'bg-pink-500', 'bg-purple-500', 'bg-yellow-500', 'bg-blue-500'];
    const newProject = {
      id: `proj-${Date.now()}`,
      name,
      owner_id: ownerId,
      members: [ownerId],
      color: colors[Math.floor(Math.random() * colors.length)],
      is_template: false,
      status: 'active',
      visibility: 'team',
      custom_fields: {},
      tags: []
    };

    const { data, error } = await this.supabase!
      .from('projects')
      .insert(newProject)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.mapProjectFromDB(data);
  }

  // Tasks
  async getTasksForProject(projectId: string): Promise<Task[]> {
    const { data, error } = await this.supabase!
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('order', { ascending: true });
    
    if (error) throw error;
    
    return data.map(this.mapTaskFromDB);
  }

  async createTask(taskData: Partial<Task>): Promise<Task> {
    const dbTask = this.mapTaskToDB(taskData as Task);
    const { data, error } = await this.supabase!
      .from('tasks')
      .insert(dbTask)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.mapTaskFromDB(data);
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    const dbUpdates = this.mapTaskUpdatesToDB(updates);
    const { data, error } = await this.supabase!
      .from('tasks')
      .update(dbUpdates)
      .eq('id', taskId)
      .select()
      .single();
    
    if (error) throw error;
    
    return this.mapTaskFromDB(data);
  }

  async getTasksForUser(userId: string): Promise<Task[]> {
    const { data, error } = await this.supabase!
      .from('tasks')
      .select('*')
      .eq('assignee_id', userId)
      .order('order', { ascending: true });
    
    if (error) throw error;
    
    return data.map(this.mapTaskFromDB);
  }
  subscribeToTasks(projectId: string, callback: (tasks: Task[]) => void) {
    const subscription = this.supabase!
      .channel(`tasks:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`
        },
        async () => {
          // Fetch updated tasks when changes occur
          const tasks = await this.getTasksForProject(projectId);
          callback(tasks);
        }
      )
      .subscribe();

    return () => {
      this.supabase!.removeChannel(subscription);
    };
  }

  // Authentication
  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await this.supabase!.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName
        }
      }
    });

    if (error) throw error;

    // Create user record in our users table
    if (data.user) {
      await this.createUser({
        uid: data.user.id,
        email: data.user.email!,
        displayName,
        role: 'member',
        isActive: true,
        createdAt: new Date()
      });
    }

    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase!.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase!.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser() {
    const { data: { user } } = await this.supabase!.auth.getUser();
    
    if (!user) return null;
    
    return this.getUserById(user.id);
  }

  // Mapping functions
  private mapUserFromDB(dbUser: Database['public']['Tables']['users']['Row']): User {
    return {
      uid: dbUser.uid,
      email: dbUser.email,
      displayName: dbUser.display_name,
      avatar: dbUser.avatar,
      role: dbUser.role as any,
      department: dbUser.department,
      timeZone: dbUser.time_zone,
      workload: dbUser.workload,
      isActive: dbUser.is_active,
      lastLogin: dbUser.last_login ? new Date(dbUser.last_login) : undefined,
      createdAt: new Date(dbUser.created_at),
      managerId: dbUser.manager_id,
      approvalLimit: dbUser.approval_limit
    };
  }

  private mapUserToDB(user: User): Database['public']['Tables']['users']['Insert'] {
    return {
      uid: user.uid,
      email: user.email,
      display_name: user.displayName,
      avatar: user.avatar,
      role: user.role,
      department: user.department,
      time_zone: user.timeZone,
      workload: user.workload,
      is_active: user.isActive,
      last_login: user.lastLogin?.toISOString(),
      manager_id: user.managerId,
      approval_limit: user.approvalLimit
    };
  }

  private mapUserUpdatesToDB(updates: Partial<User>): Partial<Database['public']['Tables']['users']['Update']> {
    const dbUpdates: any = {};
    
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.department !== undefined) dbUpdates.department = updates.department;
    if (updates.timeZone !== undefined) dbUpdates.time_zone = updates.timeZone;
    if (updates.workload !== undefined) dbUpdates.workload = updates.workload;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.lastLogin !== undefined) dbUpdates.last_login = updates.lastLogin?.toISOString();
    if (updates.managerId !== undefined) dbUpdates.manager_id = updates.managerId;
    if (updates.approvalLimit !== undefined) dbUpdates.approval_limit = updates.approvalLimit;
    
    return dbUpdates;
  }

  private mapProjectFromDB(dbProject: Database['public']['Tables']['projects']['Row']): Project {
    return {
      id: dbProject.id,
      name: dbProject.name,
      description: dbProject.description,
      ownerId: dbProject.owner_id,
      members: dbProject.members,
      createdAt: new Date(dbProject.created_at),
      updatedAt: new Date(dbProject.updated_at),
      color: dbProject.color,
      isTemplate: dbProject.is_template,
      templateId: dbProject.template_id,
      status: dbProject.status as any,
      startDate: dbProject.start_date ? new Date(dbProject.start_date) : undefined,
      dueDate: dbProject.due_date ? new Date(dbProject.due_date) : undefined,
      visibility: dbProject.visibility as any,
      customFields: dbProject.custom_fields || [],
      tags: dbProject.tags,
      portfolioId: dbProject.portfolio_id
    };
  }

  private mapTaskFromDB(dbTask: Database['public']['Tables']['tasks']['Row']): Task {
    return {
      id: dbTask.id,
      title: dbTask.title,
      description: dbTask.description,
      status: dbTask.status as any,
      taskStatus: dbTask.task_status as any,
      projectId: dbTask.project_id,
      assigneeId: dbTask.assignee_id,
      createdBy: dbTask.created_by,
      dueDate: dbTask.due_date ? new Date(dbTask.due_date) : null,
      startDate: dbTask.start_date ? new Date(dbTask.start_date) : null,
      completedDate: dbTask.completed_date ? new Date(dbTask.completed_date) : null,
      priority: dbTask.priority as any,
      order: dbTask.order,
      createdAt: new Date(dbTask.created_at),
      updatedAt: new Date(dbTask.updated_at),
      dependencies: dbTask.dependencies,
      subtasks: dbTask.subtasks,
      parentTaskId: dbTask.parent_task_id,
      timeTracked: dbTask.time_tracked,
      estimatedTime: dbTask.estimated_time,
      customFields: dbTask.custom_fields || {},
      tags: dbTask.tags,
      attachments: dbTask.attachments || []
    };
  }

  private mapTaskToDB(task: Task): Database['public']['Tables']['tasks']['Insert'] {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      task_status: task.taskStatus,
      project_id: task.projectId,
      assignee_id: task.assigneeId,
      created_by: task.createdBy,
      due_date: task.dueDate?.toISOString(),
      start_date: task.startDate?.toISOString(),
      completed_date: task.completedDate?.toISOString(),
      priority: task.priority,
      order: task.order,
      dependencies: task.dependencies,
      subtasks: task.subtasks,
      parent_task_id: task.parentTaskId,
      time_tracked: task.timeTracked,
      estimated_time: task.estimatedTime,
      custom_fields: task.customFields,
      tags: task.tags,
      attachments: task.attachments
    };
  }

  private mapTaskUpdatesToDB(updates: Partial<Task>): Partial<Database['public']['Tables']['tasks']['Update']> {
    const dbUpdates: any = {};
    
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.taskStatus !== undefined) dbUpdates.task_status = updates.taskStatus;
    if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate?.toISOString();
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate?.toISOString();
    if (updates.completedDate !== undefined) dbUpdates.completed_date = updates.completedDate?.toISOString();
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.order !== undefined) dbUpdates.order = updates.order;
    if (updates.dependencies !== undefined) dbUpdates.dependencies = updates.dependencies;
    if (updates.subtasks !== undefined) dbUpdates.subtasks = updates.subtasks;
    if (updates.parentTaskId !== undefined) dbUpdates.parent_task_id = updates.parentTaskId;
    if (updates.timeTracked !== undefined) dbUpdates.time_tracked = updates.timeTracked;
    if (updates.estimatedTime !== undefined) dbUpdates.estimated_time = updates.estimatedTime;
    if (updates.customFields !== undefined) dbUpdates.custom_fields = updates.customFields;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.attachments !== undefined) dbUpdates.attachments = updates.attachments;
    
    return dbUpdates;
  }
}

export const supabaseService = new SupabaseService();