import React, { useState, useEffect, useCallback } from 'react';
import { Project, User, Task } from './types';
import { enhancedApi as mockApi } from './services/enhancedApi';
import { AuthService } from './services/authService';
import { ToastProvider, useToast } from './utils/ux';
import TopBar from './components/Header';
import HomePage from './components/ProjectDashboard';
import ProjectView from './components/KanbanBoard';
import AuthPage from './components/AuthPage';
import MyTasksPage from './components/MyTasksPage';
import InboxPage from './components/InboxPage';
import ReportingPage from './components/CorporateReportingPage';
import PortfoliosPage from './components/PortfoliosPage';
import GoalsPage from './components/GoalsPage';
import TeamPage from './components/OrganizationManagement';
import ApprovalsPage from './components/ApprovalsPage';
import PlannerPage from './components/PlannerPage';
import CreateModal from './components/CreateModal';
import TaskSearchModal from './components/TaskSearchModal';
import InviteModal from './components/InviteModal';
import UpgradeModal from './components/UpgradeModal';
import TaskModal from './components/TaskModal';
import TimesheetsModal from './components/TimesheetsModal';
import { notificationService } from './services/notificationService';
import { reminderService } from './services/reminderService';
import { 
  MenuIcon, 
  PlusIcon, 
  HomeIcon, 
  CheckCircleIcon, 
  InboxIcon, 
  ReportingIcon, 
  PortfolioIcon, 
  GoalsIcon, 
  UsersIcon, 
  ChevronRightIcon, 
  CheckCircleIcon as ApprovalIcon,
  SearchIcon,
  StarIcon,
  ClockIcon,
  CalendarIcon,
  AsanaLogo
} from './components/icons';

// --- Types --- //
type ViewType = 'home' | 'my-tasks' | 'planner' | 'inbox' | 'reporting' | 'portfolios' | 'goals' | 'team' | 'project' | 'approvals';
interface ViewState {
  type: ViewType;
  id?: string; // for project id
}

// --- Sidebar Component Definition --- //
interface SidebarProps {
  projects: Project[];
  onNavigate: (view: ViewState) => void;
  currentView: ViewState;
  onShowCreateModal: () => void;
  onOpenSearch: () => void;
  onOpenTimesheet: () => void;
  onUpgrade: () => void;
  onInvite: () => void;
  onCreateProject: () => void;
  unreadInboxCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  projects, 
  onNavigate, 
  currentView, 
  onShowCreateModal, 
  onOpenSearch,
  onOpenTimesheet,
  onUpgrade, 
  onInvite, 
  onCreateProject,
  unreadInboxCount = 0
}) => {
  const NavItem = ({ 
    icon, 
    label, 
    selected = false, 
    onClick,
    badge
  }: { 
    icon: React.ReactNode, 
    label: string, 
    selected?: boolean, 
    onClick?: () => void,
    badge?: React.ReactNode
  }) => (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
        selected ? 'bg-blue-600 text-white shadow-sm font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <div className="flex items-center space-x-3 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      {badge}
    </button>
  );

  const SectionHeader = ({ label, onAdd }: {label: string, onAdd: () => void }) => (
    <div className="flex justify-between items-center px-3 pt-4 pb-1.5">
      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</h3>
      <button onClick={onAdd} className="text-slate-400 hover:text-white p-0.5 rounded transition-colors" title={`Add ${label}`}>
        <PlusIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col p-3 space-y-1 shrink-0 select-none border-r border-slate-800">
      {/* Brand & Create Row */}
      <div className="flex items-center justify-between p-2 mb-1">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 dark:bg-slate-800 flex items-center justify-center shadow-xs">
            <AsanaLogo className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-tight block leading-tight">asana</span>
            <span className="text-[10px] text-rose-400 font-medium">Enterprise Workspace</span>
          </div>
        </div>
        <button 
          onClick={onShowCreateModal} 
          className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>Create</span>
        </button>
      </div>

      {/* Quick Search trigger */}
      <div className="px-1 pb-2">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className="flex items-center space-x-2">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>Search tasks, projects...</span>
          </span>
          <kbd className="text-[10px] font-mono bg-slate-700/80 text-slate-300 px-1.5 py-0.5 rounded border border-slate-600">
            ⌘K
          </kbd>
        </button>
      </div>
      
      {/* Navigation Links */}
      <div className="flex-grow overflow-y-auto pr-1 space-y-0.5">
        <NavItem icon={<HomeIcon className="w-4 h-4" />} label="Home Dashboard" selected={currentView.type === 'home'} onClick={() => onNavigate({ type: 'home'})} />
        <NavItem icon={<CheckCircleIcon className="w-4 h-4" />} label="My Tasks" selected={currentView.type === 'my-tasks'} onClick={() => onNavigate({ type: 'my-tasks'})} />
        <NavItem icon={<CalendarIcon className="w-4 h-4" />} label="Planner & Calendar" selected={currentView.type === 'planner'} onClick={() => onNavigate({ type: 'planner'})} />
        <NavItem 
          icon={<InboxIcon className="w-4 h-4" />} 
          label="Activity Inbox" 
          selected={currentView.type === 'inbox'} 
          onClick={() => onNavigate({ type: 'inbox'})} 
          badge={unreadInboxCount > 0 ? (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white shadow-xs">
              {unreadInboxCount}
            </span>
          ) : undefined}
        />
        <NavItem icon={<ApprovalIcon className="w-4 h-4" />} label="Approvals" selected={currentView.type === 'approvals'} onClick={() => onNavigate({ type: 'approvals'})} />
        
        {/* Workspace Timesheets Nav Link */}
        <button
          onClick={onOpenTimesheet}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ClockIcon className="w-4 h-4 text-amber-400" />
          <span>Workspace Timesheets</span>
        </button>

        <SectionHeader label="Strategic Insights" onAdd={onShowCreateModal} />
        <NavItem icon={<ReportingIcon className="w-4 h-4" />} label="Flow & Reporting" selected={currentView.type === 'reporting'} onClick={() => onNavigate({type: 'reporting'})} />
        <NavItem icon={<PortfolioIcon className="w-4 h-4" />} label="Portfolios" selected={currentView.type === 'portfolios'} onClick={() => onNavigate({type: 'portfolios'})} />
        <NavItem icon={<GoalsIcon className="w-4 h-4" />} label="Goals & OKRs" selected={currentView.type === 'goals'} onClick={() => onNavigate({type: 'goals'})} />

        <SectionHeader label="Projects" onAdd={onCreateProject} />
        {projects.map(project => (
          <button 
            key={project.id} 
            onClick={() => onNavigate({ type: 'project', id: project.id })} 
            className={`w-full flex items-center space-x-2.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              currentView.type === 'project' && currentView.id === project.id 
                ? 'bg-blue-600/90 text-white font-bold' 
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${project.color || 'bg-blue-500'}`} />
            <span className="flex-grow text-left truncate">{project.name}</span>
            {project.isFavorite && <span className="text-amber-400 text-xs shrink-0" title="Starred">★</span>}
          </button>
        ))}
        
        <SectionHeader label="Organization" onAdd={onShowCreateModal} />
        <button 
          onClick={() => onNavigate({type: 'team'})} 
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            currentView.type === 'team' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <UsersIcon className="w-4 h-4" />
            <span>Team Directory</span>
          </div>
          <ChevronRightIcon className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
      
      {/* Bottom Footer Actions */}
      <div className="flex-shrink-0 pt-2 border-t border-slate-800 space-y-1">
        <button 
          onClick={onInvite} 
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors font-medium"
        >
          <UsersIcon className="w-3.5 h-3.5" />
          <span>Invite Teammates</span>
        </button>
        <button 
          onClick={onUpgrade} 
          className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-xs bg-slate-800/80 hover:bg-blue-600 text-slate-200 hover:text-white rounded-lg transition-all font-semibold"
        >
          <StarIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>Upgrade Plan</span>
        </button>
      </div>
    </aside>
  );
};


// --- Main App Component --- //
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'home' });
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isTimesheetModalOpen, setIsTimesheetModalOpen] = useState(false);
  const [modalTask, setModalTask] = useState<Task | null>(null);
  const [unreadInboxCount, setUnreadInboxCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [allUsers, allProjects, tasks] = await Promise.all([
        mockApi.getUsers(), 
        mockApi.getProjects(),
        mockApi.getTasks()
      ]);
      setUsers(allUsers);
      setProjects(allProjects);
      setAllTasks(tasks);
    } catch (error) {
      console.error("Failed to load data", error);
    }
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        const sessionUser = await AuthService.checkSession();
        if (sessionUser) {
          setCurrentUser(sessionUser);
        }
        await loadData();
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
  }, [loadData]);

  // Real-time unread notification badge listener
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = notificationService.subscribe(currentUser.uid, (notifs) => {
      const unread = notifs.filter(n => !n.isRead).length;
      setUnreadInboxCount(unread);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Automatic deadline monitoring scanner
  useEffect(() => {
    if (allTasks.length > 0) {
      notificationService.scanDeadlines(allTasks, projects);
      const timer = setInterval(() => {
        notificationService.scanDeadlines(allTasks, projects);
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [allTasks, projects]);

  // Meeting + deadline reminders run app-wide, not just while the Planner is open,
  // and are re-synced periodically so a long-lived tab keeps scheduling ahead.
  useEffect(() => {
    if (!currentUser) return;
    const myTasks = allTasks.filter(t => t.assigneeId === currentUser.uid);
    reminderService.sync(currentUser.uid, myTasks);
    const timer = setInterval(() => reminderService.sync(currentUser.uid, myTasks), 5 * 60 * 1000);
    return () => {
      clearInterval(timer);
      reminderService.stop();
    };
  }, [currentUser, allTasks]);

  const handleLogin = (user: User) => {
    setAuthLoading(true);
    setTimeout(() => {
      setCurrentUser(user);
      setAuthLoading(false);
    }, 500);
  };

  const handleLogout = async () => {
    try {
      await AuthService.logout();
      setCurrentUser(null);
      setCurrentView({ type: 'home' });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };
  
  const handleCreateProject = async () => {
    if (!currentUser) return;
    const newProjectName = `Project ${projects.length + 1}`;
    try {
      const newProject = await mockApi.createProject(newProjectName, currentUser.uid);
      await loadData();
      setCurrentView({ type: 'project', id: newProject.id });
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const handleTaskSelectFromSearch = (task: Task, projectId?: string) => {
    setModalTask(task);
    if (projectId) {
      setCurrentView({ type: 'project', id: projectId });
    }
  };

  const handleTaskUpdate = async (updatedTask: Task) => {
    try {
      await mockApi.updateTask(updatedTask.id, updatedTask);
      await loadData();
      if (modalTask && modalTask.id === updatedTask.id) {
        setModalTask(updatedTask);
      }
    } catch (err) {
      console.error('Failed to update task', err);
    }
  };

  const renderContent = () => {
    if (loading && !currentUser) {
      return (
        <div className="flex justify-center items-center h-screen bg-slate-900 text-white space-x-3">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Loading workspace...</span>
        </div>
      );
    }

    if (!currentUser) {
      return <AuthPage users={users} onLogin={handleLogin} loading={authLoading} />;
    }
    
    const renderAppContent = () => {
      switch (currentView.type) {
        case 'home':
          return (
            <HomePage 
              user={currentUser} 
              projects={projects} 
              users={users} 
              onCreateProject={handleCreateProject}
              onNavigateToProject={(pId) => setCurrentView({ type: 'project', id: pId })}
              onTaskClick={(t) => setModalTask(t)} 
            />
          );
        case 'project':
          const project = projects.find(p => p.id === currentView.id);
          return project ? (
            <ProjectView 
              project={project} 
              currentUser={currentUser} 
              users={users} 
            />
          ) : (
            <HomePage 
              user={currentUser} 
              projects={projects} 
              users={users} 
              onCreateProject={handleCreateProject}
              onNavigateToProject={(pId) => setCurrentView({ type: 'project', id: pId })}
              onTaskClick={(t) => setModalTask(t)} 
            />
          );
        case 'my-tasks': 
          return (
            <MyTasksPage 
              currentUser={currentUser} 
              users={users} 
              projects={projects}
              onNavigateToProject={(id) => setCurrentView({ type: 'project', id })}
            />
          );
        case 'planner':
          return (
            <PlannerPage
              currentUser={currentUser}
              users={users}
              projects={projects}
              tasks={allTasks}
              onTaskUpdate={async (taskId, updates) => {
                await mockApi.updateTask(taskId, updates);
                await loadData();
              }}
              onOpenTask={(t) => setModalTask(t)}
            />
          );
        case 'inbox': 
          return (
            <InboxPage 
              currentUser={currentUser}
              allTasks={allTasks}
              projects={projects}
              users={users}
              onSelectTask={async (taskId, projectId) => {
                let t = allTasks.find(x => x.id === taskId);
                if (!t && projectId) {
                  const tasks = await mockApi.getTasksForProject(projectId);
                  t = tasks.find(x => x.id === taskId);
                }
                if (t) {
                  setModalTask(t);
                  setCurrentView({ type: 'project', id: t.projectId });
                }
              }}
            />
          );
        case 'approvals': 
          return <ApprovalsPage currentUser={currentUser} users={users} />;
        case 'reporting': 
          return <ReportingPage currentUser={currentUser} users={users} projects={projects} />;
        case 'portfolios': 
          return (
            <PortfoliosPage 
              currentUser={currentUser}
              users={users}
              projects={projects}
              onNavigateToProject={(pId) => setCurrentView({ type: 'project', id: pId })}
            />
          );
        case 'goals': 
          return (
            <GoalsPage 
              currentUser={currentUser}
              users={users}
              projects={projects}
            />
          );
        case 'team': 
          return (
            <TeamPage 
              currentUser={currentUser} 
              users={users} 
              onUserUpdate={async (userId, updates) => {
                await mockApi.updateUser(userId, updates);
                await loadData();
              }} 
            />
          );
        default:
          return (
            <HomePage 
              user={currentUser} 
              projects={projects} 
              users={users} 
              onCreateProject={handleCreateProject} 
              onNavigateToProject={(pId) => setCurrentView({ type: 'project', id: pId })}
              onTaskClick={(t) => setModalTask(t)}
            />
          );
      }
    };

    return (
      <div className="flex h-screen font-sans bg-slate-100 dark:bg-slate-950 overflow-hidden">
        <Sidebar 
          projects={projects} 
          onNavigate={setCurrentView} 
          currentView={currentView}
          onShowCreateModal={() => setIsCreateModalOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenTimesheet={() => setIsTimesheetModalOpen(true)}
          onUpgrade={() => setIsUpgradeModalOpen(true)}
          onInvite={() => setIsInviteModalOpen(true)}
          onCreateProject={handleCreateProject}
          unreadInboxCount={unreadInboxCount}
        />
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
          <TopBar 
            user={currentUser} 
            onLogout={handleLogout} 
            onOpenSearch={() => setIsSearchOpen(true)}
            tasks={allTasks}
            onOpenTask={(t) => setModalTask(t)}
            onOpenTimesheet={() => setIsTimesheetModalOpen(true)}
          />
          <main className="flex-1 overflow-y-auto">
            {renderAppContent()}
          </main>
        </div>

        {/* Global Task Search Modal (Ctrl+K / Cmd+K) */}
        <TaskSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          tasks={allTasks}
          projects={projects}
          users={users}
          currentUser={currentUser}
          onSelectTask={handleTaskSelectFromSearch}
          onNavigateToProject={(pId) => setCurrentView({ type: 'project', id: pId })}
        />

        {/* Create Modal */}
        {isCreateModalOpen && (
          <CreateModal 
            onClose={() => setIsCreateModalOpen(false)} 
            currentUser={currentUser}
            projects={projects}
            users={users}
            onTaskCreated={loadData}
            onProjectCreated={(newProj) => {
              loadData();
              setCurrentView({ type: 'project', id: newProj.id });
            }}
          />
        )}

        {/* Invite Modal */}
        <InviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          projects={projects}
          onInviteSent={(email, role) => {
            console.log(`Invite sent to ${email} as ${role}`);
          }}
        />

        {/* Upgrade Modal */}
        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
        />

        {/* Timesheet Modal */}
        <TimesheetsModal
          isOpen={isTimesheetModalOpen}
          onClose={() => setIsTimesheetModalOpen(false)}
          tasks={allTasks}
          users={users}
          currentUser={currentUser}
        />

        {/* Task Modal when opened from Global Search / Inbox */}
        {modalTask && (
          <TaskModal
            task={modalTask}
            users={users}
            currentUser={currentUser || users[0]}
            allTasks={allTasks}
            onClose={() => setModalTask(null)}
            onUpdateTask={async (tId, updates) => {
              const updated = { ...modalTask, ...updates };
              await handleTaskUpdate(updated);
              setModalTask(updated);
            }}
            onNavigateToTask={(t) => setModalTask(t)}
          />
        )}
      </div>
    );
  };

  return (
    <ToastProvider>
      {renderContent()}
    </ToastProvider>
  );
};

export default App;
