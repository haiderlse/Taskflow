import React, { useState, useEffect, useMemo } from 'react';
import { Portfolio, Project, User, Task } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  PortfolioIcon, 
  PlusIcon, 
  FolderIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  UsersIcon, 
  FilterIcon, 
  SearchIcon, 
  XIcon, 
  ChevronRightIcon, 
  StarIcon,
  TrashIcon
} from './icons';

interface PortfoliosPageProps {
  currentUser?: User | null;
  users?: User[];
  projects?: Project[];
  onNavigateToProject?: (projectId: string) => void;
}

export const PortfoliosPage: React.FC<PortfoliosPageProps> = ({
  currentUser,
  users = [],
  projects = [],
  onNavigateToProject,
}) => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New portfolio form state
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [newPortfolioDesc, setNewPortfolioDesc] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [portList, taskList] = await Promise.all([
          enhancedApi.getPortfolios(),
          enhancedApi.getTasks(),
        ]);
        // If empty mock data, initialize with realistic portfolios
        if (portList.length === 0) {
          const defaultPortfolios: Portfolio[] = [
            {
              id: 'port-1',
              name: 'Enterprise Strategic Initiatives 2025',
              description: 'Key corporate transformation, ERP expansion, and franchise rollout programs.',
              ownerId: currentUser?.uid || 'user-1',
              projects: ['proj-1', 'proj-3', 'proj-4'],
              goals: ['goal-1'],
              status: 'active',
              createdAt: new Date(),
            },
            {
              id: 'port-2',
              name: 'Retail Expansion & Omni-Channel',
              description: 'Modernizing physical and digital retail operations, supply chain, and logistics.',
              ownerId: 'user-2',
              projects: ['proj-2', 'proj-5'],
              goals: ['goal-2'],
              status: 'active',
              createdAt: new Date(),
            }
          ];
          setPortfolios(defaultPortfolios);
        } else {
          setPortfolios(portList);
        }
        setAllTasks(taskList);
      } catch (err) {
        console.error('Error loading portfolios', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser]);

  const projectsMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach(u => map.set(u.uid, u));
    return map;
  }, [users]);

  // Compute stats for each portfolio
  const portfolioStats = useMemo(() => {
    return portfolios.map(port => {
      const portProjects = port.projects.map(pid => projectsMap.get(pid)).filter(Boolean) as Project[];
      const portTasks = allTasks.filter(t => port.projects.includes(t.projectId));

      const totalTasks = portTasks.length;
      const doneTasks = portTasks.filter(t => t.status === 'Done').length;
      const inProgressTasks = portTasks.filter(t => t.status === 'In Progress').length;
      const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 45;

      // Health status calculation
      const health: 'On Track' | 'At Risk' | 'Off Track' = 
        progress >= 60 ? 'On Track' :
        progress >= 30 ? 'At Risk' : 'Off Track';

      return {
        portfolio: port,
        projects: portProjects,
        totalTasks,
        doneTasks,
        inProgressTasks,
        progress,
        health,
      };
    });
  }, [portfolios, projectsMap, allTasks]);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;

    try {
      const created = await enhancedApi.createPortfolio({
        name: newPortfolioName,
        description: newPortfolioDesc,
        ownerId: currentUser?.uid || 'user-1',
        projects: selectedProjectIds,
        goals: [],
      });
      setPortfolios([created, ...portfolios]);
      setIsCreateModalOpen(false);
      setNewPortfolioName('');
      setNewPortfolioDesc('');
      setSelectedProjectIds([]);
    } catch (err) {
      console.error('Failed to create portfolio', err);
    }
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    if (confirm('Are you sure you want to delete this portfolio?')) {
      try {
        await enhancedApi.deletePortfolio(portfolioId);
        setPortfolios(prev => prev.filter(p => p.id !== portfolioId));
        if (selectedPortfolio?.id === portfolioId) {
          setSelectedPortfolio(null);
        }
      } catch (err) {
        console.error('Failed to delete portfolio', err);
      }
    }
  };

  const handleAddProjectToPortfolio = async (portfolioId: string, projectId: string) => {
    const target = portfolios.find(p => p.id === portfolioId);
    if (!target || target.projects.includes(projectId)) return;
    const updatedProjects = [...target.projects, projectId];
    try {
      await enhancedApi.updatePortfolio(portfolioId, { projects: updatedProjects });
      setPortfolios(prev => prev.map(p => p.id === portfolioId ? { ...p, projects: updatedProjects } : p));
      if (selectedPortfolio?.id === portfolioId) {
        setSelectedPortfolio({ ...selectedPortfolio, projects: updatedProjects });
      }
    } catch (err) {
      console.error('Failed to add project to portfolio', err);
    }
  };

  const handleRemoveProjectFromPortfolio = async (portfolioId: string, projectId: string) => {
    const target = portfolios.find(p => p.id === portfolioId);
    if (!target) return;
    const updatedProjects = target.projects.filter(id => id !== projectId);
    try {
      await enhancedApi.updatePortfolio(portfolioId, { projects: updatedProjects });
      setPortfolios(prev => prev.map(p => p.id === portfolioId ? { ...p, projects: updatedProjects } : p));
      if (selectedPortfolio?.id === portfolioId) {
        setSelectedPortfolio({ ...selectedPortfolio, projects: updatedProjects });
      }
    } catch (err) {
      console.error('Failed to remove project from portfolio', err);
    }
  };

  const filteredPortfolioStats = portfolioStats.filter(item => {
    const matchesQ = item.portfolio.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                     (item.portfolio.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesHealth = filterStatus === 'all' || item.health === filterStatus;
    return matchesQ && matchesHealth;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between flex-wrap gap-4 sticky top-0 z-20 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
              <PortfolioIcon className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-gray-900">Executive Portfolios</h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Group related projects, track high-level strategic health, and monitor progress across departments.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Portfolio</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Search and Filters Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <SearchIcon className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search portfolios by title or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs text-gray-800 bg-transparent border-none outline-none focus:ring-0 w-full"
            />
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-gray-700 font-medium"
            >
              <option value="all">All Health Statuses</option>
              <option value="On Track">On Track</option>
              <option value="At Risk">At Risk</option>
              <option value="Off Track">Off Track</option>
            </select>
          </div>
        </div>

        {/* Portfolios Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPortfolioStats.map(item => {
            const owner = usersMap.get(item.portfolio.ownerId);
            const healthColors = {
              'On Track': 'bg-emerald-100 text-emerald-800 border-emerald-200',
              'At Risk': 'bg-amber-100 text-amber-800 border-amber-200',
              'Off Track': 'bg-red-100 text-red-800 border-red-200',
            };

            return (
              <div
                key={item.portfolio.id}
                onClick={() => setSelectedPortfolio(item.portfolio)}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5 hover:shadow-md transition-all cursor-pointer group"
              >
                {/* Portfolio Top Meta */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                      {item.portfolio.name}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {item.portfolio.description || 'No description provided.'}
                    </p>
                  </div>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border shrink-0 uppercase tracking-wider ${healthColors[item.health]}`}>
                    {item.health}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                    <span>Overall Portfolio Progress</span>
                    <span className="font-bold text-gray-900">{item.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.progress}%` }}
                      className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    />
                  </div>
                </div>

                {/* Child Projects Badges */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
                    <span>Linked Projects ({item.projects.length})</span>
                    <span>{item.doneTasks}/{item.totalTasks} tasks done</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.projects.map(proj => (
                      <span
                        key={proj.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigateToProject) onNavigateToProject(proj.id);
                        }}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-slate-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full ${proj.color}`} />
                        <span>{proj.name}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Owner & Date Footer */}
                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-gray-100">
                  <span>Lead: <strong>{owner?.displayName || 'Executive Team'}</strong></span>
                  <span className="flex items-center space-x-1 text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">
                    <span>View Portfolio Detail</span>
                    <ChevronRightIcon className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE PORTFOLIO MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base">Create Strategic Portfolio</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePortfolio} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Portfolio Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Global Product Expansion 2025"
                  value={newPortfolioName}
                  onChange={e => setNewPortfolioName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Strategic Description</label>
                <textarea
                  rows={3}
                  placeholder="Outline strategic goals, executive sponsor, and expected outcomes..."
                  value={newPortfolioDesc}
                  onChange={e => setNewPortfolioDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Include Projects</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2.5">
                  {projects.map(proj => {
                    const isChecked = selectedProjectIds.includes(proj.id);
                    return (
                      <label key={proj.id} className="flex items-center space-x-2 text-xs text-gray-700 cursor-pointer p-1 hover:bg-slate-50 rounded">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedProjectIds(selectedProjectIds.filter(id => id !== proj.id));
                            } else {
                              setSelectedProjectIds([...selectedProjectIds, proj.id]);
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`w-2 h-2 rounded-full ${proj.color}`} />
                        <span className="font-medium">{proj.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Portfolio Detail Modal */}
      {selectedPortfolio && (() => {
        const stats = portfolioStats.find(s => s.portfolio.id === selectedPortfolio.id);
        const attachedProjects = (selectedPortfolio.projects || []).map(id => projectsMap.get(id)).filter(Boolean) as Project[];
        const availableToAdd = projects.filter(p => !selectedPortfolio.projects.includes(p.id));
        const owner = usersMap.get(selectedPortfolio.ownerId);

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between bg-slate-50">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                      <PortfolioIcon className="w-4 h-4" />
                    </span>
                    <h2 className="text-base font-bold text-gray-900">{selectedPortfolio.name}</h2>
                    {stats && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        stats.health === 'On Track' ? 'bg-emerald-100 text-emerald-800' :
                        stats.health === 'At Risk' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {stats.health}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 max-w-lg">
                    {selectedPortfolio.description || 'No description provided for this portfolio.'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDeletePortfolio(selectedPortfolio.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete Portfolio"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedPortfolio(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Stats Summary Bar */}
                {stats && (
                  <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-gray-100 text-center">
                    <div>
                      <div className="text-xl font-black text-gray-900">{stats.projectCount}</div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Projects</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-blue-600">{stats.completedTasks}/{stats.totalTasks}</div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Tasks Done</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-emerald-600">{stats.progressPct}%</div>
                      <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Completion</div>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {stats && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-600 font-medium">
                      <span>Portfolio Milestone Velocity</span>
                      <span className="font-bold">{stats.progressPct}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${stats.progressPct}%` }}
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                )}

                {/* Attached Projects */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Attached Projects ({attachedProjects.length})
                    </h3>

                    {availableToAdd.length > 0 && (
                      <div className="flex items-center space-x-1.5">
                        <select
                          id="add-project-to-portfolio-select"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddProjectToPortfolio(selectedPortfolio.id, e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="text-xs px-2.5 py-1 bg-white border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="" disabled>+ Add project to portfolio...</option>
                          {availableToAdd.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {attachedProjects.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-400">
                      No projects currently linked to this portfolio.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {attachedProjects.map(proj => {
                        const projTasks = allTasks.filter(t => t.projectId === proj.id);
                        const done = projTasks.filter(t => t.status === 'Done').length;
                        const pct = projTasks.length > 0 ? Math.round((done / projTasks.length) * 100) : 0;

                        return (
                          <div
                            key={proj.id}
                            className="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/20 transition-all bg-white"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <span className={`w-3 h-3 rounded-full shrink-0 ${proj.color || 'bg-blue-500'}`} />
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-gray-900 truncate">{proj.name}</h4>
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {done}/{projTasks.length} tasks completed ({pct}%)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              {onNavigateToProject && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPortfolio(null);
                                    onNavigateToProject(proj.id);
                                  }}
                                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
                                >
                                  <span>Open</span>
                                  <ChevronRightIcon className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveProjectFromPortfolio(selectedPortfolio.id, proj.id)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                title="Remove from portfolio"
                              >
                                <XIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>Managed by {owner?.displayName || 'Workspace Admin'}</span>
                <button
                  type="button"
                  onClick={() => setSelectedPortfolio(null)}
                  className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default PortfoliosPage;
