
import React, { useState, useEffect } from 'react';
import { Project, User } from './types';
import { enhancedApi as mockApi } from './services/enhancedApi';
import { AuthService } from './services/authService';
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
import CreateModal from './components/CreateModal';
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
  CheckCircleIcon as ApprovalIcon
} from './components/icons';

// --- Types --- //
type ViewType = 'home' | 'my-tasks' | 'inbox' | 'reporting' | 'portfolios' | 'goals' | 'team' | 'project' | 'approvals';
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
  onUpgrade: () => void;
  onInvite: () => void;
  onCreateProject: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ projects, onNavigate, currentView, onShowCreateModal, onUpgrade, onInvite, onCreateProject }) => {
  const NavItem = ({ icon, label, selected = false, onClick }: { icon: React.ReactNode, label: string, selected?: boolean, onClick?: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${selected ? 'bg-gray-700 text-white' : 'text-light-text hover:bg-gray-700/50 hover:text-white'}`}>
      {icon}
      <span>{label}</span>
    </button>
  );

  const SectionHeader = ({ label, onAdd }: {label: string, onAdd: () => void }) => (
      <div className="flex justify-between items-center px-3 pt-4 pb-1">
          <h3 className="text-xs font-semibold text-subtle-text uppercase tracking-wider">{label}</h3>
          <button onClick={onAdd} className="text-subtle-text hover:text-white">
              <PlusIcon className="w-4 h-4" />
          </button>
      </div>
  );

  return (
    <aside className="w-64 bg-sidebar text-light-text flex flex-col p-2 space-y-1">
      <div className="flex items-center justify-between p-3 mb-2">
        <button className="text-light-text hover:text-white"><MenuIcon className="w-5 h-5" /></button>
        <button onClick={onShowCreateModal} className="flex items-center space-x-2 bg-accent hover:bg-accent-hover text-white px-3 py-1.5 rounded-md text-sm font-semibold">
          <PlusIcon className="w-4 h-4" />
          <span>Create</span>
        </button>
      </div>
      
      <div className="flex-grow overflow-y-auto pr-1">
          <NavItem icon={<HomeIcon className="w-5 h-5" />} label="Home" selected={currentView.type === 'home'} onClick={() => onNavigate({ type: 'home'})} />
          <NavItem icon={<CheckCircleIcon className="w-5 h-5" />} label="My tasks" selected={currentView.type === 'my-tasks'} onClick={() => onNavigate({ type: 'my-tasks'})} />
          <NavItem icon={<InboxIcon className="w-5 h-5" />} label="Inbox" selected={currentView.type === 'inbox'} onClick={() => onNavigate({ type: 'inbox'})} />
          <NavItem icon={<ApprovalIcon className="w-5 h-5" />} label="Approvals" selected={currentView.type === 'approvals'} onClick={() => onNavigate({ type: 'approvals'})} />
          
          <SectionHeader label="Insights" onAdd={onShowCreateModal} />
          <NavItem icon={<ReportingIcon className="w-5 h-5" />} label="Reporting" selected={currentView.type === 'reporting'} onClick={() => onNavigate({type: 'reporting'})} />
          <NavItem icon={<PortfolioIcon className="w-5 h-5" />} label="Portfolios" selected={currentView.type === 'portfolios'} onClick={() => onNavigate({type: 'portfolios'})} />
          <NavItem icon={<GoalsIcon className="w-5 h-5" />} label="Goals" selected={currentView.type === 'goals'} onClick={() => onNavigate({type: 'goals'})} />

          <SectionHeader label="Projects" onAdd={onCreateProject} />
          {projects.map(project => (
             <button key={project.id} onClick={() => onNavigate({ type: 'project', id: project.id })} className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView.type === 'project' && currentView.id === project.id ? 'bg-gray-700/80 text-white' : 'text-light-text hover:bg-gray-700/50 hover:text-white'}`}>
                 <span className={`w-2.5 h-2.5 rounded-full ${project.color}`}></span>
                 <span className="flex-grow text-left truncate">{project.name}</span>
             </button>
          ))}
          
          <SectionHeader label="Team" onAdd={onShowCreateModal} />
           <button onClick={() => onNavigate({type: 'team'})} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView.type === 'team' ? 'bg-gray-700 text-white' : 'text-light-text hover:bg-gray-700/50 hover:text-white'}`}>
            <div className="flex items-center space-x-3">
              <UsersIcon className="w-5 h-5" />
              <span>My Company</span>
            </div>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
      </div>
      
      <div className="flex-shrink-0 p-2 space-y-2">
        <div className="bg-gray-700/50 p-3 rounded-lg text-center">
            <p className="text-sm font-medium text-white">Your trial has ended</p>
            <button onClick={onUpgrade} className="mt-2 w-full bg-yellow-400 text-yellow-900 font-bold px-4 py-2 rounded-md text-sm hover:bg-yellow-300">Upgrade</button>
        </div>
        <button onClick={onInvite} className="w-full text-center py-2 text-sm text-subtle-text hover:text-white">Invite teammates</button>
      </div>
    </aside>
  );
};


// --- Main App Component --- //

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentView, setCurrentView] = useState<ViewState>({ type: 'home' });
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        // First check if user has a valid session
        const sessionUser = await AuthService.checkSession();
        if (sessionUser) {
          setCurrentUser(sessionUser);
        }

        // Load initial data
        const [allUsers, allProjects] = await Promise.all([mockApi.getUsers(), mockApi.getProjects()]);
        setUsers(allUsers);
        setProjects(allProjects);
      } catch (error) {
        console.error("Failed to load initial data", error);
      } finally {
        setLoading(false);
      }
    };
    initializeApp();
  }, []);

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
      const newProjectName = `New Project ${projects.length + 1}`;
      try {
        const newProject = await mockApi.createProject(newProjectName, currentUser.uid);
        const updatedProjects = await mockApi.getProjects();
        setProjects(updatedProjects);
        setCurrentView({ type: 'project', id: newProject.id });
      } catch (error) {
        console.error("Failed to create project:", error);
      }
  };

  const handleUpgrade = () => alert("The 'Upgrade' feature is a premium service and is not implemented in this demo.");
  const handleInvite = () => alert("The 'Invite teammates' feature is not yet implemented.");

  const renderContent = () => {
    if (loading && !currentUser) {
        return <div className="flex justify-center items-center h-screen bg-sidebar text-white">Loading...</div>;
    }

    if (!currentUser) {
      return <AuthPage users={users} onLogin={handleLogin} loading={authLoading} />;
    }
    
    const renderAppContent = () => {
        switch (currentView.type) {
            case 'home':
                return <HomePage user={currentUser} projects={projects} users={users} onCreateProject={handleCreateProject} />;
            case 'project':
                const project = projects.find(p => p.id === currentView.id);
                return project ? <ProjectView project={project} currentUser={currentUser} users={users} /> : <HomePage user={currentUser} projects={projects} users={users} onCreateProject={handleCreateProject} />;
            case 'my-tasks': return <MyTasksPage />;
            case 'inbox': return <InboxPage />;
            case 'approvals': return <ApprovalsPage currentUser={currentUser} users={users} />;
            case 'reporting': return <ReportingPage currentUser={currentUser} users={users} />;
            case 'portfolios': return <PortfoliosPage />;
            case 'goals': return <GoalsPage />;
            case 'team': return <TeamPage currentUser={currentUser} users={users} onUserUpdate={async (userId, updates) => {
              await mockApi.updateUser(userId, updates);
              // Refresh users list
              const updatedUsers = await mockApi.getUsers();
              setUsers(updatedUsers);
            }} />;
            default:
                return <HomePage user={currentUser} projects={projects} users={users} onCreateProject={handleCreateProject} />;
        }
    }

    return (
        <div className="flex h-screen font-sans">
            <Sidebar 
                projects={projects} 
                onNavigate={setCurrentView} 
                currentView={currentView}
                onShowCreateModal={() => setIsCreateModalOpen(true)}
                onUpgrade={handleUpgrade}
                onInvite={handleInvite}
                onCreateProject={handleCreateProject}
            />
            <div className="flex-1 flex flex-col bg-main-bg overflow-hidden">
                <TopBar user={currentUser} onLogout={handleLogout} />
                <main className="flex-1 overflow-y-auto">
                    {renderAppContent()}
                </main>
            </div>
            {isCreateModalOpen && <CreateModal onClose={() => setIsCreateModalOpen(false)} />}
        </div>
    );
  };

  return <>{renderContent()}</>;
};

export default App;
