
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Project, Task, User } from '../types';
import { mockApi } from '../services/mockApi';
import { 
  PlusIcon,
  DotsHorizontalIcon,
  CheckCircleIcon,
  ListIcon,
  ArchiveIcon,
  UserIcon as PeopleIcon,
  CustomizeIcon
} from './icons';

// --- WIDGETS --- //

interface MyTasksWidgetProps {
  tasks: Task[];
  users: User[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
}

const MyTasksWidget = ({ tasks, users, onUpdateTask }: MyTasksWidgetProps) => {
  const [activeTab, setActiveTab] = useState('Upcoming');

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

  const TabButton = ({ name, count }: { name: string, count: number }) => (
    <button
      onClick={() => setActiveTab(name)}
      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${activeTab === name ? 'text-gray-800 bg-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}
    >
      {name} {count > 0 && <span className="text-xs">{count}</span>}
    </button>
  );

  const visibleTasks = getVisibleTasks();

  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm col-span-2 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <PeopleIcon className="w-5 h-5 text-gray-600"/>
            </div>
            <h2 className="text-lg font-semibold text-dark-text">My tasks</h2>
        </div>
        <button className="text-gray-400 hover:text-gray-700">
          <DotsHorizontalIcon />
        </button>
      </div>
      <div className="flex items-center space-x-2 border-b pb-3 mb-3">
        <TabButton name="Upcoming" count={upcoming.length} />
        <TabButton name="Overdue" count={overdue.length} />
        <TabButton name="Completed" count={completed.length} />
      </div>
      <div className="flex-grow space-y-2 overflow-y-auto">
        <button className="w-full flex items-center space-x-2 text-sm text-gray-500 hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors">
          <PlusIcon className="w-4 h-4"/>
          <span>Create task</span>
        </button>
        {visibleTasks.length > 0 ? (
          visibleTasks.map(task => {
            const isCompleted = task.status === 'Done';
            const isOverdue = !isCompleted && task.dueDate && new Date(task.dueDate) < new Date();

            return (
              <div key={task.id} className="flex items-center space-x-3 p-2 group">
                <button 
                    onClick={() => onUpdateTask(task.id, { status: isCompleted ? 'To Do' : 'Done' })}
                    className="flex-shrink-0 p-1 -m-1 group/btn"
                    aria-label={isCompleted ? 'Mark task as not completed' : 'Mark task as completed'}
                >
                    <CheckCircleIcon className={`w-5 h-5 transition-colors cursor-pointer ${isCompleted ? 'text-green-500' : 'text-gray-300 group-hover/btn:text-green-500'}`}/>
                </button>
                <span className={`flex-grow text-sm truncate ${isCompleted ? 'line-through text-gray-500' : 'text-gray-700'}`}>{task.title}</span>
                {task.dueDate && <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-500'} ${isCompleted ? 'line-through' : ''}`}>{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric' })}</span>}
              </div>
            )
          })
        ) : (
            <div className="text-center text-sm text-gray-400 py-4">No tasks in this list.</div>
        )}
      </div>
    </div>
  );
};


const ProjectsWidget = ({ projects, onCreateProject }: { projects: Project[], onCreateProject: (name: string) => void }) => {
  return (
    <div className="bg-card p-6 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-dark-text">Projects</h2>
        <button className="text-gray-400 hover:text-gray-700">
          <DotsHorizontalIcon />
        </button>
      </div>
      <div className="space-y-3">
        <button onClick={() => onCreateProject('New Project ' + Math.floor(Math.random() * 100))} className="w-full flex items-center space-x-2 text-sm text-gray-500 hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors border border-dashed">
          <PlusIcon className="w-4 h-4"/>
          <span>Create project</span>
        </button>
        {projects.slice(3, 7).map(project => (
          <div key={project.id} className="flex items-center space-x-3 group cursor-pointer p-1 rounded-md hover:bg-gray-50">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${project.color === 'bg-gray-400' ? 'bg-gray-200' : 'bg-pink-100'}`}>
                <ListIcon className={`w-5 h-5 ${project.color === 'bg-gray-400' ? 'text-gray-500' : 'text-pink-500'}`}/>
            </div>
            <div className="flex-grow">
                <p className="font-medium text-sm text-gray-800">{project.name}</p>
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <ArchiveIcon className="w-3 h-3"/>
                    <span>Archived</span>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


const PeopleWidget = ({ users }: { users: User[] }) => {
    return (
        <div className="bg-card p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-dark-text">People</h2>
                <button className="text-gray-400 hover:text-gray-700">
                    <DotsHorizontalIcon />
                </button>
            </div>
            <div className="space-y-3">
                {users.slice(0, 3).map(user => (
                    <div key={user.uid} className="flex items-center space-x-3">
                        <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center font-bold text-white uppercase">
                            {user.displayName.slice(0, 2)}
                        </div>
                        <div>
                            <p className="font-medium text-sm text-gray-800">{user.displayName}</p>
                            <p className="text-xs text-gray-500">Collaborator</p>
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
}

const HomePage: React.FC<HomePageProps> = ({ user, projects, users, onCreateProject }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        mockApi.getTasksForUser(user.uid)
            .then(setTasks)
            .finally(() => setLoading(false));
    }, [user.uid]);

    const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
        const originalTasks = tasks;
        // Optimistic update
        setTasks(prevTasks => prevTasks.map(t => 
            t.id === taskId ? { ...t, ...updates } as Task : t
        ));

        try {
            await mockApi.updateTask(taskId, updates);
        } catch (error) {
            console.error("Failed to update task from home page:", error);
            // Revert on error
            setTasks(originalTasks);
        }
    }, [tasks]);

    const today = new Date();
    const dateString = today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    return (
        <div className="relative p-8 h-full overflow-y-auto bg-main-bg-darker">
            {/* Background decorative circles */}
            <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full border-2 border-white/50 z-0"></div>
            <div className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border-2 border-white/50 z-0"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-sm text-gray-600">{dateString}</p>
                        <h1 className="text-4xl font-bold text-dark-text mt-1">Good evening, {user.displayName}</h1>
                        <div className="flex items-center space-x-6 mt-4 text-sm text-gray-700">
                            <span>My week</span>
                            <span>✓ 0 tasks completed</span>
                            <span>0 collaborators</span>
                        </div>
                    </div>
                    <button className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
                        <CustomizeIcon />
                        <span>Customize</span>
                    </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{height: 'calc(100vh - 250px)'}}>
                    <MyTasksWidget tasks={tasks} users={users} onUpdateTask={handleTaskUpdate} />
                    <div className="col-span-1 space-y-6">
                        <ProjectsWidget projects={projects} onCreateProject={onCreateProject} />
                        <PeopleWidget users={users} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
