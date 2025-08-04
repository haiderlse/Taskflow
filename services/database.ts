import mongoose from 'mongoose';
import { 
  User, Project, Task, Comment, TimeEntry, Milestone, 
  Form, Integration, AutomationRule, Portfolio, Goal, 
  CustomField, Attachment, ApprovalRequest 
} from '../types';

// MongoDB connection
const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskflow';
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

// User Schema
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  avatar: String,
  role: { type: String, enum: ['admin', 'manager', 'member', 'viewer'], default: 'member' },
  department: String,
  timeZone: String,
  workload: { type: Number, default: 40 },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  passwordHash: String,
  managerId: String,
  approvalLimit: Number
});

// Project Schema
const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: String, required: true },
  members: [String],
  color: String,
  isTemplate: { type: Boolean, default: false },
  templateId: String,
  status: { type: String, enum: ['active', 'on_hold', 'completed', 'archived'], default: 'active' },
  startDate: Date,
  dueDate: Date,
  visibility: { type: String, enum: ['public', 'private', 'team'], default: 'team' },
  customFields: [{
    id: String,
    name: String,
    type: String,
    options: [String],
    isRequired: Boolean,
    isLocked: Boolean,
    createdBy: String,
    createdAt: { type: Date, default: Date.now }
  }],
  tags: [String],
  portfolioId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Task Schema
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, enum: ['To Do', 'In Progress', 'Done'], default: 'To Do' },
  taskStatus: { type: String, enum: ['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'], default: 'not_started' },
  projectId: { type: String, required: true },
  assigneeId: String,
  createdBy: { type: String, required: true },
  dueDate: Date,
  startDate: Date,
  completedDate: Date,
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  order: Number,
  dependencies: [String],
  subtasks: [String],
  parentTaskId: String,
  timeTracked: { type: Number, default: 0 },
  estimatedTime: Number,
  customFields: { type: Map, of: mongoose.Schema.Types.Mixed },
  tags: [String],
  attachments: [{
    id: String,
    filename: String,
    url: String,
    size: Number,
    mimeType: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  approval: {
    id: String,
    requestedBy: String,
    approvers: [String],
    status: { type: String, enum: ['pending', 'approved', 'rejected'] },
    description: String,
    approvals: [{
      userId: String,
      status: { type: String, enum: ['approved', 'rejected'] },
      comment: String,
      timestamp: { type: Date, default: Date.now },
      signatureHash: String
    }],
    createdAt: { type: Date, default: Date.now },
    dueDate: Date,
    approvalType: { type: String, enum: ['sequential', 'parallel', 'any_one'], default: 'parallel' },
    requiredApprovals: { type: Number, default: 1 },
    escalationPath: [String],
    estimatedValue: Number,
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    currentApproverIndex: Number
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Time Entry Schema
const timeEntrySchema = new mongoose.Schema({
  taskId: { type: String, required: true },
  userId: { type: String, required: true },
  duration: { type: Number, required: true },
  description: String,
  startTime: { type: Date, required: true },
  endTime: Date,
  isRunning: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Milestone Schema
const milestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  projectId: { type: String, required: true },
  dueDate: { type: Date, required: true },
  isCompleted: { type: Boolean, default: false },
  completedDate: Date,
  tasks: [String],
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Portfolio Schema
const portfolioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: String, required: true },
  projects: [String],
  goals: [String],
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

// Goal Schema
const goalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  ownerId: { type: String, required: true },
  portfolioId: String,
  targetDate: { type: Date, required: true },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed', 'at_risk'], default: 'not_started' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  keyResults: [{
    id: String,
    name: String,
    targetValue: Number,
    currentValue: Number,
    unit: String,
    isCompleted: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Comment Schema
const commentSchema = new mongoose.Schema({
  text: { type: String, required: true },
  taskId: { type: String, required: true },
  userId: { type: String, required: true },
  isEdited: { type: Boolean, default: false },
  attachments: [{
    id: String,
    filename: String,
    url: String,
    size: Number,
    mimeType: String,
    uploadedBy: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create models
export const UserModel = mongoose.model('User', userSchema);
export const ProjectModel = mongoose.model('Project', projectSchema);
export const TaskModel = mongoose.model('Task', taskSchema);
export const TimeEntryModel = mongoose.model('TimeEntry', timeEntrySchema);
export const MilestoneModel = mongoose.model('Milestone', milestoneSchema);
export const PortfolioModel = mongoose.model('Portfolio', portfolioSchema);
export const GoalModel = mongoose.model('Goal', goalSchema);
export const CommentModel = mongoose.model('Comment', commentSchema);

// Database service class
export class DatabaseService {
  static async init(): Promise<void> {
    await connectDB();
  }

  // User operations
  static async getUsers(): Promise<User[]> {
    return await UserModel.find({ isActive: true }).lean();
  }

  static async getUserById(uid: string): Promise<User | null> {
    return await UserModel.findOne({ uid }).lean();
  }

  static async createUser(userData: Partial<User>): Promise<User> {
    const user = new UserModel(userData);
    return await user.save();
  }

  static async updateUser(uid: string, updates: Partial<User>): Promise<User | null> {
    return await UserModel.findOneAndUpdate({ uid }, { ...updates, updatedAt: new Date() }, { new: true }).lean();
  }

  // Project operations
  static async getProjects(): Promise<Project[]> {
    return await ProjectModel.find().lean();
  }

  static async getProjectById(id: string): Promise<Project | null> {
    return await ProjectModel.findById(id).lean();
  }

  static async createProject(projectData: Partial<Project>): Promise<Project> {
    const project = new ProjectModel(projectData);
    return await project.save();
  }

  static async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    return await ProjectModel.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
  }

  // Task operations
  static async getTasksForProject(projectId: string): Promise<Task[]> {
    return await TaskModel.find({ projectId }).lean();
  }

  static async getTasksForUser(userId: string): Promise<Task[]> {
    return await TaskModel.find({ assigneeId: userId }).lean();
  }

  static async createTask(taskData: Partial<Task>): Promise<Task> {
    const task = new TaskModel(taskData);
    return await task.save();
  }

  static async updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
    return await TaskModel.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
  }

  static async deleteTask(id: string): Promise<boolean> {
    const result = await TaskModel.findByIdAndDelete(id);
    return !!result;
  }

  // Time tracking operations
  static async createTimeEntry(entryData: Partial<TimeEntry>): Promise<TimeEntry> {
    const entry = new TimeEntryModel(entryData);
    return await entry.save();
  }

  static async getTimeEntriesForTask(taskId: string): Promise<TimeEntry[]> {
    return await TimeEntryModel.find({ taskId }).lean();
  }

  static async getTimeEntriesForUser(userId: string, startDate?: Date, endDate?: Date): Promise<TimeEntry[]> {
    const query: any = { userId };
    if (startDate && endDate) {
      query.startTime = { $gte: startDate, $lte: endDate };
    }
    return await TimeEntryModel.find(query).lean();
  }

  // Milestone operations
  static async getMilestonesForProject(projectId: string): Promise<Milestone[]> {
    return await MilestoneModel.find({ projectId }).lean();
  }

  static async createMilestone(milestoneData: Partial<Milestone>): Promise<Milestone> {
    const milestone = new MilestoneModel(milestoneData);
    return await milestone.save();
  }

  // Portfolio operations
  static async getPortfolios(): Promise<Portfolio[]> {
    return await PortfolioModel.find({ status: 'active' }).lean();
  }

  static async createPortfolio(portfolioData: Partial<Portfolio>): Promise<Portfolio> {
    const portfolio = new PortfolioModel(portfolioData);
    return await portfolio.save();
  }

  // Goal operations
  static async getGoals(): Promise<Goal[]> {
    return await GoalModel.find().lean();
  }

  static async createGoal(goalData: Partial<Goal>): Promise<Goal> {
    const goal = new GoalModel(goalData);
    return await goal.save();
  }

  // Comment operations
  static async getCommentsForTask(taskId: string): Promise<Comment[]> {
    return await CommentModel.find({ taskId }).sort({ createdAt: 1 }).lean();
  }

  static async addComment(commentData: Partial<Comment>): Promise<Comment> {
    const comment = new CommentModel(commentData);
    return await comment.save();
  }
}