import { User, Project, Task, Comment, ColumnId } from '../types';
import { enhancedApi } from './enhancedApi';

export const mockApi = {
  getCurrentUser: enhancedApi.getCurrentUser,
  getUsers: enhancedApi.getUsers,
  createUser: enhancedApi.createUser,
  updateUser: enhancedApi.updateUser,
  getProjects: enhancedApi.getProjects,
  createProject: enhancedApi.createProject,
  updateProject: enhancedApi.updateProject,
  deleteProject: enhancedApi.deleteProject,
  getTasks: enhancedApi.getTasks,
  getTasksForUser: enhancedApi.getTasksForUser,
  getTasksForProject: enhancedApi.getTasksForProject,
  createTask: enhancedApi.createTask,
  updateTask: enhancedApi.updateTask,
  deleteTask: enhancedApi.deleteTask,
  updateTaskOrder: enhancedApi.updateTaskOrder,
  subscribeToTasks: enhancedApi.subscribeToTasks,
  getCommentsForTask: enhancedApi.getCommentsForTask,
  addComment: enhancedApi.addComment,
  subscribeToComments: enhancedApi.subscribeToComments,
};

export default mockApi;
