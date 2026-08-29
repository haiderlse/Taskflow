import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  User, Project, Task, Comment, TimeEntry, Milestone, 
  Portfolio, Goal, CustomField, Attachment, ApprovalRequest,
  CalendarEvent 
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
          due_time?: string | null;
          start_date?: string;
          completed_date?: string;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
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
      calendar_events: {
        Row: {
          id: string;
          title: string;
          description?: string;
          type: string;
          owner_id: string;
          start_time: string;
          end_time: string;
          is_all_day: boolean;
          location?: string | null;
          conference_link?: string | null;
          attendees: any[];
          project_id?: string | null;
          task_ids: string[];
          color?: string | null;
          reminders: any[];
          recurrence?: any | null;
          exceptions: string[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['calendar_events']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['calendar_events']['Insert']>;
      };
    };
  };
}

class SupabaseService {
  private supabase: any = null;
  private isAvailable = false;

  constructor() {
    try {
      const metaEnv = (import.meta as any).env || {};
      const supabaseUrl = metaEnv.VITE_SUPABASE_URL;
      const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY;
      
      // Only initialize if we have valid configuration
      if (supabaseUrl && supabaseKey && 
          supabaseUrl !== 'your_supabase_project_url' && 
          supabaseKey !== 'your_supabase_anon_key' &&
          supabaseUrl.startsWith('http')) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
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

  /** The current session, refreshed by the client if it had expired. */
  async getSession() {
    const { data, error } = await this.supabase!.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  /** Changes the signed-in user's password. Supabase verifies the active session. */
  async updatePassword(newPassword: string) {
    const { error } = await this.supabase!.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async sendPasswordReset(email: string) {
    const { error } = await this.supabase!.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
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

  // --- Calendar events --- //

  /** Whether a Supabase client was successfully configured at construction time. */
  get available(): boolean {
    return this.isAvailable;
  }

  /**
   * Events the signed-in user owns or is invited to. RLS does the filtering, so
   * a plain select returns exactly the rows this user may see.
   */
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    this.checkAvailability();
    const { data, error } = await this.supabase!
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true });

    if (error) throw error;

    return data.map(this.mapEventFromDB);
  }

  async createCalendarEvent(event: CalendarEvent): Promise<CalendarEvent> {
    this.checkAvailability();
    const { data, error } = await this.supabase!
      .from('calendar_events')
      .insert(this.mapEventToDB(event))
      .select()
      .single();

    if (error) throw error;

    return this.mapEventFromDB(data);
  }

  async updateCalendarEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    this.checkAvailability();
    const { data, error } = await this.supabase!
      .from('calendar_events')
      .update(this.mapEventUpdatesToDB(updates))
      .eq('id', eventId)
      .select()
      .single();

    if (error) throw error;

    return this.mapEventFromDB(data);
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    this.checkAvailability();
    const { error } = await this.supabase!
      .from('calendar_events')
      .delete()
      .eq('id', eventId);

    if (error) throw error;
  }

  /** Pushes the full event list to `callback` whenever any visible row changes. */
  subscribeToCalendarEvents(callback: (events: CalendarEvent[]) => void): () => void {
    this.checkAvailability();
    const channel = this.supabase!
      .channel('calendar_events:all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_events' },
        async () => {
          try {
            callback(await this.getCalendarEvents());
          } catch (error) {
            console.warn('Failed to refresh calendar events after a change:', error);
          }
        }
      )
      .subscribe();

    return () => {
      this.supabase!.removeChannel(channel);
    };
  }

  private mapEventFromDB(row: Database['public']['Tables']['calendar_events']['Row']): CalendarEvent {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      type: row.type as any,
      ownerId: row.owner_id,
      start: new Date(row.start_time),
      end: new Date(row.end_time),
      isAllDay: row.is_all_day,
      location: row.location || undefined,
      conferenceLink: row.conference_link || undefined,
      attendees: row.attendees || [],
      projectId: row.project_id || undefined,
      taskIds: row.task_ids || [],
      color: row.color || undefined,
      reminders: row.reminders || [],
      recurrence: row.recurrence
        ? { ...row.recurrence, until: row.recurrence.until ? new Date(row.recurrence.until) : null }
        : null,
      exceptions: row.exceptions || [],
      status: row.status as any,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapEventToDB(event: CalendarEvent): Database['public']['Tables']['calendar_events']['Insert'] {
    return {
      id: event.id,
      title: event.title,
      description: event.description || '',
      type: event.type,
      owner_id: event.ownerId,
      start_time: event.start.toISOString(),
      end_time: event.end.toISOString(),
      is_all_day: event.isAllDay,
      location: event.location ?? null,
      conference_link: event.conferenceLink ?? null,
      attendees: event.attendees || [],
      project_id: event.projectId ?? null,
      task_ids: event.taskIds || [],
      color: event.color ?? null,
      reminders: event.reminders || [],
      recurrence: event.recurrence
        ? { ...event.recurrence, until: event.recurrence.until ? new Date(event.recurrence.until).toISOString() : null }
        : null,
      exceptions: event.exceptions || [],
      status: event.status,
    };
  }

  private mapEventUpdatesToDB(updates: Partial<CalendarEvent>): Partial<Database['public']['Tables']['calendar_events']['Update']> {
    const out: any = {};

    if (updates.title !== undefined) out.title = updates.title;
    if (updates.description !== undefined) out.description = updates.description;
    if (updates.type !== undefined) out.type = updates.type;
    if (updates.start !== undefined) out.start_time = updates.start.toISOString();
    if (updates.end !== undefined) out.end_time = updates.end.toISOString();
    if (updates.isAllDay !== undefined) out.is_all_day = updates.isAllDay;
    if (updates.location !== undefined) out.location = updates.location ?? null;
    if (updates.conferenceLink !== undefined) out.conference_link = updates.conferenceLink ?? null;
    if (updates.attendees !== undefined) out.attendees = updates.attendees;
    if (updates.projectId !== undefined) out.project_id = updates.projectId ?? null;
    if (updates.taskIds !== undefined) out.task_ids = updates.taskIds;
    if (updates.color !== undefined) out.color = updates.color ?? null;
    if (updates.reminders !== undefined) out.reminders = updates.reminders;
    if (updates.recurrence !== undefined) {
      out.recurrence = updates.recurrence
        ? { ...updates.recurrence, until: updates.recurrence.until ? new Date(updates.recurrence.until).toISOString() : null }
        : null;
    }
    if (updates.exceptions !== undefined) out.exceptions = updates.exceptions;
    if (updates.status !== undefined) out.status = updates.status;

    return out;
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
      dueTime: dbTask.due_time || null,
      startDate: dbTask.start_date ? new Date(dbTask.start_date) : null,
      completedDate: dbTask.completed_date ? new Date(dbTask.completed_date) : null,
      scheduledStart: dbTask.scheduled_start ? new Date(dbTask.scheduled_start) : null,
      scheduledEnd: dbTask.scheduled_end ? new Date(dbTask.scheduled_end) : null,
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
      due_time: task.dueTime ?? null,
      start_date: task.startDate?.toISOString(),
      completed_date: task.completedDate?.toISOString(),
      scheduled_start: task.scheduledStart?.toISOString() ?? null,
      scheduled_end: task.scheduledEnd?.toISOString() ?? null,
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
    if (updates.dueTime !== undefined) dbUpdates.due_time = updates.dueTime;
    if (updates.scheduledStart !== undefined) dbUpdates.scheduled_start = updates.scheduledStart?.toISOString() ?? null;
    if (updates.scheduledEnd !== undefined) dbUpdates.scheduled_end = updates.scheduledEnd?.toISOString() ?? null;
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