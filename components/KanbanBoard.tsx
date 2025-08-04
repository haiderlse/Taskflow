import React, { useState, useEffect, useCallback } from 'react';
import { Project, Task, User, ColumnId } from '../types';
import { mockApi } from '../services/mockApi';
import TaskModal from './TaskModal';
import {
  ListIcon,
  BoardIcon,
  TimelineIcon,
  DashboardIcon,
  GanttIcon,
  CalendarIcon,
  NoteIcon,
  WorkloadIcon,
  PlusIcon,
  StarIcon,
  ChevronDownIcon,
  ShareIcon,
  CustomizeIcon,
  FilterIcon,
  SortIcon,
  GroupIcon,
  OptionsIcon,
  SearchIcon,
  UserIcon as AssigneeIcon,
  CheckCircleIcon
} from './icons';

// --- Placeholder View ---
const PlaceholderView = ({ viewName }: { viewName: string }) => (
    <div className="flex items-center justify-center h-full bg-gray-50/50">
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border">
            <h2 className="text-2xl font-semibold text-gray-700">{viewName}</h2>
            <p className="text-gray-500 mt-2 max-w-md">
                This is a placeholder for the {viewName}.
                The full functionality for this view has not been implemented yet.
            </p>
        </div>
    </div>
);

// --- List View Component ---
interface ProjectListViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskCreate: (title: string, projectId: string, status: ColumnId) => Promise<void>;
}

const ProjectListView: React.FC<ProjectListViewProps> = ({ tasks, users, project, onTaskClick, onTaskUpdate, onTaskCreate }) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const handleTaskCreate = useCallback(async () => {
    if (newTaskTitle.trim() === '') return;
    try {
        await onTaskCreate(newTaskTitle.trim(), project.id, 'To Do');
        setNewTaskTitle('');
        setIsAddingTask(false);
    } catch (error) {
        console.error("Failed to create task from list view:", error);
    }
  }, [project.id, newTaskTitle, onTaskCreate]);

  const sortedTasks = tasks.filter(t => t.status !== 'Done');
  const completedTasks = tasks.filter(t => t.status === 'Done');

  const getAssignee = useCallback((assigneeId: string | null) => {
      return users.find(u => u.uid === assigneeId);
  }, [users]);

  const ToolButton = ({icon, label}: {icon: React.ReactNode, label?: string}) => (
    <button className="flex items-center space-x-1.5 px-2.5 py-1 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700">
        {icon}
        {label && <span>{label}</span>}
    </button>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2.5 border-b border-border-color flex-shrink-0 bg-gray-50/50">
          <button onClick={() => setIsAddingTask(true)} className="flex items-center space-x-1 px-2.5 py-1 text-sm font-medium border border-transparent rounded-md hover:bg-gray-200 text-gray-700">
              <PlusIcon className="w-4 h-4"/>
              <span>Add task</span>
          </button>
          <div className="flex items-center space-x-2">
              <ToolButton icon={<FilterIcon className="w-4 h-4"/>} label="Filter" />
              <ToolButton icon={<SortIcon className="w-4 h-4"/>} label="Sort" />
              <ToolButton icon={<GroupIcon className="w-4 h-4"/>} label="Group" />
              <ToolButton icon={<OptionsIcon className="w-4 h-4"/>} label="Options" />
              <ToolButton icon={<SearchIcon className="w-4 h-4"/>} />
          </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
          <div className="p-1">
              <div className="grid grid-cols-[minmax(0,_1fr)_150px_150px_40px] gap-4 text-xs text-subtle-text font-medium border-b pb-2 px-3 sticky top-0 bg-white z-10">
                  <span className="pl-8">Name</span>
                  <span>Assignee</span>
                  <span>Due date</span>
                  <button className="text-gray-400 hover:text-dark-text"><PlusIcon className="w-4 h-4"/></button>
              </div>
              
              <div className="divide-y divide-border-color">
                {sortedTasks.map(task => {
                    const assignee = getAssignee(task.assigneeId);
                    return (
                      <div key={task.id} onClick={() => onTaskClick(task)} className="grid grid-cols-[minmax(0,_1fr)_150px_150px_40px] gap-4 items-center group cursor-pointer hover:bg-gray-50 px-3 py-1.5">
                          <div className="flex items-center space-x-3">
                              <button onClick={(e) => {
                                e.stopPropagation();
                                onTaskUpdate(task.id, { status: 'Done' });
                              }} className="flex-shrink-0 p-1 -m-1 group/btn">
                                <CheckCircleIcon className="w-5 h-5 text-gray-300 group-hover/btn:text-green-500 transition-colors"/>
                              </button>
                              <span className="truncate text-sm py-1">{task.title}</span>
                          </div>
                          <div className="flex items-center justify-start">
                              {assignee ? (
                                  <div title={assignee.displayName} className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-primary font-bold text-xs border-2 border-white">
                                      {assignee.displayName.charAt(0)}
                                  </div>
                              ) : <AssigneeIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full"/>}
                          </div>
                          <div>
                              {task.dueDate ? (
                                    <span className="text-sm text-gray-600">{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric' })}</span>
                              ) : <CalendarIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full" />}
                          </div>
                          <div></div>
                      </div>
                    )
                })}

                {isAddingTask && (
                  <div className="grid grid-cols-[minmax(0,_1fr)_150px_150px_40px] gap-4 items-center px-3 py-1.5">
                      <div className="flex items-center space-x-3">
                        <CheckCircleIcon className="w-5 h-5 text-gray-300 flex-shrink-0"/>
                        <input 
                          type="text"
                          autoFocus
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleTaskCreate()}
                          onBlur={() => { if(newTaskTitle) { handleTaskCreate() } else { setIsAddingTask(false) } }}
                          placeholder="Write a task name"
                          className="w-full text-sm focus:outline-none focus:ring-0 border-0 p-1 bg-transparent"
                        />
                      </div>
                  </div>
                )}
              </div>
              {completedTasks.length > 0 && (
                <div className="pt-4">
                    <h4 className="px-3 mb-1 text-sm font-medium text-gray-500">Completed</h4>
                    {completedTasks.map(task => {
                        const assignee = getAssignee(task.assigneeId);
                        return (
                          <div key={task.id} onClick={() => onTaskClick(task)} className="grid grid-cols-[minmax(0,_1fr)_150px_150px_40px] gap-4 items-center group cursor-pointer hover:bg-gray-50 px-3 py-1.5 text-gray-500">
                              <div className="flex items-center space-x-3">
                                  <button onClick={(e) => {
                                      e.stopPropagation();
                                      onTaskUpdate(task.id, { status: 'To Do' });
                                  }} className="flex-shrink-0 p-1 -m-1">
                                      <CheckCircleIcon className="w-5 h-5 text-green-500"/>
                                  </button>
                                  <span className="truncate text-sm py-1 line-through">{task.title}</span>
                              </div>
                              <div className="flex items-center justify-start">
                                  {assignee ? (
                                      <div title={assignee.displayName} className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-primary font-bold text-xs border-2 border-white opacity-70">
                                          {assignee.displayName.charAt(0)}
                                      </div>
                                  ) : <AssigneeIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full"/>}
                              </div>
                              <div>
                                  {task.dueDate ? (
                                        <span className="text-sm line-through">{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric' })}</span>
                                  ) : <CalendarIcon className="w-7 h-7 p-1 text-gray-300 border-2 border-dashed rounded-full" />}
                              </div>
                              <div></div>
                          </div>
                        )
                    })}
                </div>
              )}
               <button className="flex items-center space-x-2 text-sm text-gray-500 hover:text-primary p-2 rounded-md hover:bg-primary/10 transition-colors m-2">
                <PlusIcon className="w-4 h-4"/>
                <span>Add section</span>
              </button>
          </div>
      </div>
    </>
  );
};


// This component has been repurposed to show the Project "List View" inspired by the Asana design.
// The original Kanban board UI has been replaced.

interface ProjectViewProps {
  project: Project;
  currentUser: User;
  users: User[];
}

const ProjectView: React.FC<ProjectViewProps> = ({ project, currentUser, users }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('List');

  useEffect(() => {
    setLoading(true);
    mockApi.getTasksForProject(project.id)
      .then(tasks => {
        setTasks(tasks.sort((a, b) => a.order - b.order));
      })
      .finally(() => setLoading(false));

    const unsubscribe = mockApi.subscribeToTasks(project.id, (updatedTasks) => {
      setTasks(updatedTasks.sort((a, b) => a.order - b.order));
    });

    return () => unsubscribe();
  }, [project.id]);

  const handleTaskUpdate = useCallback(async (taskId: string, updates: Partial<Task>) => {
    try {
      await mockApi.updateTask(taskId, updates);
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  }, [selectedTask]);

  const handleTaskCreate = useCallback(async (title: string, projectId: string, status: ColumnId) => {
    try {
        await mockApi.createTask(title, projectId, status);
    } catch (error) {
        console.error("Failed to create task:", error);
        throw error; // Re-throw to be caught by caller
    }
  }, []);

  const NavTab = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center space-x-2 px-2 py-3 text-sm font-medium border-b-2 transition-colors ${active ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-dark-text hover:border-gray-300'}`}>
        {icon}
        <span>{label}</span>
    </button>
  );

  const renderActiveView = () => {
    if (loading) {
        return <div className="text-center p-10">Loading tasks...</div>
    }
    
    switch (activeTab) {
        case 'List':
            return <ProjectListView 
                project={project}
                tasks={tasks}
                users={users}
                onTaskClick={setSelectedTask}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreate}
            />;
        case 'Board': return <PlaceholderView viewName="Board View" />;
        case 'Timeline': return <PlaceholderView viewName="Timeline View" />;
        case 'Dashboard': return <PlaceholderView viewName="Dashboard View" />;
        case 'Gantt': return <PlaceholderView viewName="Gantt Chart View" />;
        case 'Calendar': return <PlaceholderView viewName="Calendar View" />;
        case 'Note': return <PlaceholderView viewName="Note View" />;
        case 'Workload': return <PlaceholderView viewName="Workload View" />;
        default:
            return <ProjectListView
                project={project}
                tasks={tasks}
                users={users}
                onTaskClick={setSelectedTask}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreate}
            />;
    }
  };


  return (
    <div className="flex flex-col h-full bg-white text-dark-text">
        {/* Project Header */}
        <header className="flex items-center justify-between p-4 border-b border-border-color flex-shrink-0">
            <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${project.color}`}>
                    <ListIcon className="w-6 h-6 text-white"/>
                </div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <button className="text-gray-400 hover:text-yellow-500"><StarIcon className="w-5 h-5"/></button>
                <button className="text-gray-400 hover:text-dark-text"><ChevronDownIcon className="w-5 h-5"/></button>
            </div>
            <div className="flex items-center space-x-2">
                <div className="flex -space-x-2">
                     <div title={currentUser.displayName} className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white border-2 border-white">
                        {currentUser.displayName.slice(0, 2).toUpperCase()}
                    </div>
                     <div title="Another User" className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold text-white border-2 border-white">
                        RD
                    </div>
                </div>
                <button className="flex items-center space-x-1.5 px-4 py-1.5 text-sm font-semibold border rounded-md bg-primary text-white hover:bg-primary-hover">
                  <ShareIcon className="w-4 h-4" />
                  <span>Share</span>
                </button>
                 <button className="flex items-center space-x-1.5 px-3 py-1.5 text-sm border rounded-md bg-white hover:bg-gray-50 text-gray-700">
                    <CustomizeIcon className="w-4 h-4"/>
                    <span>Customize</span>
                </button>
            </div>
        </header>

        {/* Tabs */}
        <div className="flex items-center justify-between px-4 border-b border-border-color flex-shrink-0">
            <nav className="flex items-center -mb-px">
                <NavTab icon={<ListIcon className="w-4 h-4"/>} label="List" active={activeTab === 'List'} onClick={() => setActiveTab('List')} />
                <NavTab icon={<BoardIcon className="w-4 h-4"/>} label="Board" active={activeTab === 'Board'} onClick={() => setActiveTab('Board')} />
                <NavTab icon={<TimelineIcon className="w-4 h-4"/>} label="Timeline" active={activeTab === 'Timeline'} onClick={() => setActiveTab('Timeline')} />
                <NavTab icon={<DashboardIcon className="w-4 h-4"/>} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => setActiveTab('Dashboard')} />
                <NavTab icon={<GanttIcon className="w-4 h-4"/>} label="Gantt" active={activeTab === 'Gantt'} onClick={() => setActiveTab('Gantt')} />
                <NavTab icon={<CalendarIcon className="w-4 h-4"/>} label="Calendar" active={activeTab === 'Calendar'} onClick={() => setActiveTab('Calendar')} />
                <NavTab icon={<NoteIcon className="w-4 h-4"/>} label="Note" active={activeTab === 'Note'} onClick={() => setActiveTab('Note')} />
                <NavTab icon={<WorkloadIcon className="w-4 h-4"/>} label="Workload" active={activeTab === 'Workload'} onClick={() => setActiveTab('Workload')} />
                 <button className="text-gray-400 hover:text-dark-text p-3"><PlusIcon className="w-4 h-4"/></button>
            </nav>
        </div>
        
        <main className="flex-1 flex flex-col overflow-y-auto">
            {renderActiveView()}
        </main>

        {selectedTask && (
            <TaskModal
            task={selectedTask}
            users={users}
            currentUser={currentUser}
            onClose={() => setSelectedTask(null)}
            onUpdateTask={handleTaskUpdate}
            />
        )}
    </div>
  );
};

export default ProjectView;