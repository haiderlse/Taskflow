import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Project, Task, User } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  PlusIcon,
  DotsHorizontalIcon,
  CheckCircleIcon,
  ListIcon,
  ArchiveIcon,
  UserIcon as PeopleIcon,
  CustomizeIcon,
  FolderIcon,
  ClockIcon,
  DiamondIcon
} from './icons';

// --- WIDGETS --- //

interface MyTasksWidgetProps {
  tasks: Task[];
  users: User[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onTaskClick?: (task: Task) => void;
  onTaskCreate?: (title: string) => void;
}

const MyTasksWidget: React.FC<MyTasksWidgetProps> = ({ 
  tasks, 
  users, 
  onUpdateTask,
  onTaskClick,
  onTaskCreate
}) => {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Overdue' | 'Completed'>('Upcoming');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { overdue, upcoming, completed } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const overdueTasks: Task[] = [];
    const upcomingTasks: Task[] = [];
    const completedTasks: Task[] = [];

    tasks.forEach(task => {
      if (task.status === 'Done') {
        completedTasks.push(task);
      } else if (task.dueDate && new Date(task.dueDate) < today) {
        overdueTasks.push(task);
      } else {
        upcomingTasks.push(task);
      }
    });

    return { overdue: overdueTasks, upcoming: upcomingTasks, completed: completedTasks };
  }, [tasks]);

  const getVisibleTasks = () => {
    switch (activeTab) {
      case 'Overdue': return overdue;
      case 'Completed': return completed;
      case 'Upcoming':
      default:
        return upcoming;
    }
  };

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onTaskCreate?.(newTitle.trim());
    setNewTitle('');
    setIsCreating(false);
  };

  const TabButton = ({ name, count }: { name: 'Upcoming' | 'Overdue' | 'Completed', count: number }) => (
    <button
      onClick={() => setActiveTab(name)}
      className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
        activeTab === name 
          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60' 
          : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800'
      }`}
    >
      {name} {count > 0 && <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-gray-200 dark:bg-slate-700">{count}</span>}
    </button>
  );

  const visibleTasks = getVisibleTasks();

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xs col-span-2 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <CheckCircleIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-white">My Tasks</h2>
            <span className="text-[11px] text-gray-400">{tasks.length} total assigned</span>
          </div>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>

      <div className="flex items-center space-x-2 border-b border-gray-100 dark:border-slate-800 pb-3 mb-3">
        <TabButton name="Upcoming" count={upcoming.length} />
        <TabButton name="Overdue" count={overdue.length} />
        <TabButton name="Completed" count={completed.length} />
      </div>

      {isCreating && (
        <form onSubmit={handleQuickCreate} className="mb-3 flex items-center space-x-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700">
          <input
            type="text"
            autoFocus
            required
            placeholder="What needs to be done? Press Enter to save..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 text-xs bg-transparent text-gray-900 dark:text-white outline-hidden placeholder-gray-400"
          />
          <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
            Save
          </button>
          <button type="button" onClick={() => setIsCreating(false)} className="text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        </form>
      )}

      <div className="flex-grow space-y-1.5 overflow-y-auto pr-1">
        {visibleTasks.length > 0 ? (
          visibleTasks.map(task => {
            const isCompleted = task.status === 'Done';
            const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();

            return (
              <div 
                key={task.id} 
                className="flex items-center space-x-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-transparent hover:border-gray-100 dark:hover:border-slate-800 transition-all group"
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTask(task.id, { status: isCompleted ? 'To Do' : 'Done' });
                  }}
                  className="shrink-0 p-0.5"
                  aria-label={isCompleted ? 'Mark task as not completed' : 'Mark task as completed'}
                >
                  <CheckCircleIcon className={`w-4 h-4 transition-colors cursor-pointer ${
                    isCompleted ? 'text-emerald-500' : 'text-gray-300 dark:text-slate-600 hover:text-emerald-500'
                  }`}/>
                </button>
                
                <div 
                  onClick={() => onTaskClick?.(task)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <div className="flex items-center space-x-1.5">
                    {task.isMilestone && <DiamondIcon className="w-3 h-3 text-emerald-500 shrink-0" />}
                    <span className={`text-xs font-semibold truncate ${
                      isCompleted ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-200'
                    }`}>
                      {task.title}
                    </span>
                  </div>
                </div>

                {task.dueDate && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                    isOverdue 
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                      : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400'
                  } ${isCompleted ? 'line-through opacity-60' : ''}`}>
                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center text-xs text-gray-400 dark:text-slate-500 py-8 italic">
            No tasks in this list. Great job keeping your backlog clean!
          </div>
        )}
      </div>
    </div>
  );
};

interface ProjectsWidgetProps {
  projects: Project[];
  onCreateProject: (name: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

const ProjectsWidget: React.FC<ProjectsWidgetProps> = ({ 
  projects, 
  onCreateProject,
  onNavigateToProject 
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xs">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-black text-gray-900 dark:text-white">Workspace Projects</h2>
        <span className="text-xs font-bold text-gray-400">{projects.length} Total</span>
      </div>
      <div className="space-y-2">
        <button 
          onClick={() => onCreateProject('New Project ' + Math.floor(Math.random() * 100))} 
          className="w-full flex items-center justify-center space-x-2 text-xs font-bold text-blue-600 dark:text-blue-400 p-2.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-dashed border-blue-200 dark:border-blue-800 transition-colors"
        >
          <PlusIcon className="w-3.5 h-3.5"/>
          <span>Create Project</span>
        </button>

        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
          {projects.map(project => (
            <div 
              key={project.id} 
              onClick={() => onNavigateToProject?.(project.id)}
              className="flex items-center space-x-3 group cursor-pointer p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 border border-transparent hover:border-gray-100 dark:hover:border-slate-800 transition-all"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${project.color || 'bg-blue-500'} text-white shadow-2xs shrink-0`}>
                <ListIcon className="w-4 h-4"/>
              </div>
              <div className="flex-grow min-w-0">
                <p className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {project.name}
                </p>
                <div className="flex items-center space-x-2 text-[10px] text-gray-400">
                  <span className="capitalize font-medium">{(project.healthStatus || 'on_track').replace('_', ' ')}</span>
                  <span>•</span>
                  <span>{project.members?.length || 1} members</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PeopleWidget: React.FC<{ users: User[] }> = ({ users }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xs">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-black text-gray-900 dark:text-white">Teammates</h2>
        <span className="text-xs font-bold text-gray-400">{users.length} People</span>
      </div>
      <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
        {users.map(user => (
          <div key={user.uid} className="flex items-center space-x-3 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs text-gray-900 dark:text-slate-100 truncate">{user.displayName}</p>
              <p className="text-[10px] text-gray-400 capitalize">{user.department || user.role || 'Member'}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- HOME PAGE --- //

interface HomePageProps {
  user: User;
  projects: Project[];
  users: User[];
  onCreateProject: (name: string) => void;
  onNavigateToProject?: (projectId: string) => void;
  onTaskClick?: (task: Task) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ 
  user, 
  projects, 
  users, 
  onCreateProject,
  onNavigateToProject,
  onTaskClick
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    enhancedApi.getTasksForUser(user.uid)
      .then(setTasks)
      .finally(() => setLoading(false));
  }, [user.uid]);

  const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const originalTasks = tasks;
    setTasks(prevTasks => prevTasks.map(t => 
      t.id === taskId ? { ...t, ...updates } as Task : t
    ));

    try {
      await enhancedApi.updateTask(taskId, updates);
    } catch (error) {
      console.error("Failed to update task from home page:", error);
      setTasks(originalTasks);
    }
  }, [tasks]);

  const handleQuickCreateTask = async (title: string) => {
    try {
      const defaultProjId = projects[0]?.id || 'proj-1';
      const newTask = await enhancedApi.createTask({
        title,
        projectId: defaultProjId,
        assigneeId: user.uid,
        status: 'To Do'
      });
      setTasks(prev => [newTask, ...prev]);
    } catch (err) {
      console.error("Failed to create task", err);
    }
  };

  const completedCount = useMemo(() => tasks.filter(t => t.status === 'Done').length, [tasks]);
  const activeCount = useMemo(() => tasks.filter(t => t.status !== 'Done').length, [tasks]);

  const today = new Date();
  const dateString = today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-8 h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Greeting */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{dateString}</p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
              Welcome back, {user.displayName}
            </h1>
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-slate-400 font-semibold">
              <span className="flex items-center space-x-1">
                <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>{completedCount} tasks completed</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <ClockIcon className="w-3.5 h-3.5 text-blue-500" />
                <span>{activeCount} active tasks</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <PeopleIcon className="w-3.5 h-3.5 text-purple-500" />
                <span>{users.length} teammates</span>
              </span>
            </div>
          </div>
        </div>
        
        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <MyTasksWidget 
            tasks={tasks} 
            users={users} 
            onUpdateTask={handleTaskUpdate}
            onTaskClick={onTaskClick}
            onTaskCreate={handleQuickCreateTask}
          />
          <div className="col-span-1 space-y-6">
            <ProjectsWidget 
              projects={projects} 
              onCreateProject={onCreateProject}
              onNavigateToProject={onNavigateToProject}
            />
            <PeopleWidget users={users} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
