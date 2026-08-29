import React, { useState } from 'react';
import { Project, Task, User, ProjectBrief, ProjectStatusUpdate, ProjectHealthStatus } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  CheckCircleIcon, 
  PlusIcon, 
  CalendarIcon, 
  UserIcon, 
  LinkIcon, 
  DiamondIcon,
  TagIcon,
  FileTextIcon,
  FolderIcon
} from './icons';
import { StatusUpdateModal } from './StatusUpdateModal';

interface ProjectOverviewViewProps {
  project: Project;
  tasks: Task[];
  users: User[];
  currentUser: User;
  onProjectUpdate?: (updated: Project) => void;
  onOpenRules?: () => void;
  onOpenForms?: () => void;
}

export const ProjectOverviewView: React.FC<ProjectOverviewViewProps> = ({
  project,
  tasks,
  users,
  currentUser,
  onProjectUpdate,
  onOpenRules,
  onOpenForms
}) => {
  const [brief, setBrief] = useState<ProjectBrief>(project.brief || {
    overview: project.description || 'Welcome to this project! Define your team charter, key goals, and shared documents here.',
    goals: ['Complete primary deliverable milestone', 'Coordinate with cross-functional partners'],
    roles: [
      { role: 'Project Owner', userId: project.ownerId || 'user-1' },
      { role: 'Tech Lead', userId: 'user-2' },
    ],
    links: [
      { id: 'l-1', title: 'Shared Google Drive Folder', url: 'https://drive.google.com', category: 'docs' },
      { id: 'l-2', title: 'Figma UI Designs & Specs', url: 'https://figma.com', category: 'design' },
    ]
  });

  const [isEditingOverview, setIsEditingOverview] = useState(false);
  const [overviewText, setOverviewText] = useState(brief.overview || '');
  const [newGoalText, setNewGoalText] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusUpdates, setStatusUpdates] = useState<ProjectStatusUpdate[]>(project.statusUpdates || []);
  const [healthStatus, setHealthStatus] = useState<ProjectHealthStatus>(project.healthStatus || 'on_track');

  const milestones = tasks.filter(t => t.isMilestone);
  const completedMilestones = milestones.filter(t => t.status === 'Done');

  const handleSaveOverview = async () => {
    const updatedBrief = { ...brief, overview: overviewText };
    setBrief(updatedBrief);
    setIsEditingOverview(false);
    await enhancedApi.updateProjectBrief(project.id, updatedBrief);
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    const updatedGoals = [...(brief.goals || []), newGoalText.trim()];
    const updatedBrief = { ...brief, goals: updatedGoals };
    setBrief(updatedBrief);
    setNewGoalText('');
    await enhancedApi.updateProjectBrief(project.id, updatedBrief);
  };

  const handleRemoveGoal = async (index: number) => {
    const updatedGoals = (brief.goals || []).filter((_, i) => i !== index);
    const updatedBrief = { ...brief, goals: updatedGoals };
    setBrief(updatedBrief);
    await enhancedApi.updateProjectBrief(project.id, updatedBrief);
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    const newLink = {
      id: `link-${Date.now()}`,
      title: newLinkTitle.trim(),
      url: newLinkUrl.trim().startsWith('http') ? newLinkUrl.trim() : `https://${newLinkUrl.trim()}`,
      category: 'docs' as const
    };
    const updatedLinks = [...(brief.links || []), newLink];
    const updatedBrief = { ...brief, links: updatedLinks };
    setBrief(updatedBrief);
    setNewLinkTitle('');
    setNewLinkUrl('');
    await enhancedApi.updateProjectBrief(project.id, updatedBrief);
  };

  const handleRemoveLink = async (linkId: string) => {
    const updatedLinks = (brief.links || []).filter(l => l.id !== linkId);
    const updatedBrief = { ...brief, links: updatedLinks };
    setBrief(updatedBrief);
    await enhancedApi.updateProjectBrief(project.id, updatedBrief);
  };

  const handleRoleChange = async (roleName: string, newUserId: string) => {
    const existingRoles = brief.roles || [];
    const roleIdx = existingRoles.findIndex(r => r.role === roleName);
    let updatedRoles = [...existingRoles];
    if (roleIdx >= 0) {
      updatedRoles[roleIdx] = { role: roleName, userId: newUserId };
    } else {
      updatedRoles.push({ role: roleName, userId: newUserId });
    }
    const updatedBrief = { ...brief, roles: updatedRoles };
    setBrief(updatedBrief);
    await enhancedApi.updateProjectBrief(project.id, updatedBrief);
  };

  const handleStatusUpdateAdded = (newUpdate: ProjectStatusUpdate) => {
    const nextList = [newUpdate, ...statusUpdates];
    setStatusUpdates(nextList);
    setHealthStatus(newUpdate.status);
    if (onProjectUpdate) {
      onProjectUpdate({
        ...project,
        healthStatus: newUpdate.status,
        statusUpdates: nextList
      });
    }
  };

  const getHealthBadge = (status: ProjectHealthStatus) => {
    switch (status) {
      case 'on_track':
        return { label: 'On Track', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
      case 'at_risk':
        return { label: 'At Risk', bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' };
      case 'off_track':
        return { label: 'Off Track', bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' };
      case 'on_hold':
        return { label: 'On Hold', bg: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' };
      case 'completed':
        return { label: 'Completed', bg: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' };
      default:
        return { label: 'On Track', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' };
    }
  };

  const healthBadge = getHealthBadge(healthStatus);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Executive Project Health Banner */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Current Health Status
              </span>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl border font-black text-xs ${healthBadge.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${healthBadge.dot}`} />
                  <span>{healthBadge.label}</span>
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  • Last updated {statusUpdates.length > 0 ? new Date(statusUpdates[0].createdAt).toLocaleDateString() : 'recently'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowStatusModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Post Status Update</span>
            </button>
          </div>
        </div>

        {/* Two-Column Asana Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Column (8 cols): Project Brief & Status Updates */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Project Brief / Charter */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                <div className="flex items-center space-x-2">
                  <FileTextIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="font-black text-sm text-gray-900 dark:text-white">Project Brief & Description</h3>
                </div>
                {!isEditingOverview ? (
                  <button
                    onClick={() => setIsEditingOverview(true)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Edit Brief
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setIsEditingOverview(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveOverview}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>

              {isEditingOverview ? (
                <textarea
                  rows={4}
                  value={overviewText}
                  onChange={e => setOverviewText(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {brief.overview || 'No project brief provided. Click "Edit Brief" to define project mission, scope, and key deliverables.'}
                </p>
              )}

              {/* Key Deliverable Goals */}
              <div className="pt-3 border-t border-gray-100 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Key Deliverable Goals ({(brief.goals || []).length})
                </h4>
                <div className="space-y-1.5">
                  {(brief.goals || []).map((goal, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center space-x-2">
                        <CheckCircleIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-semibold text-gray-800 dark:text-slate-200">{goal}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveGoal(idx)}
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                        title="Remove goal"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddGoal} className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add a new deliverable goal..."
                    value={newGoalText}
                    onChange={e => setNewGoalText(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-xs text-gray-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!newGoalText.trim()}
                    className="px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-slate-700 text-white font-bold text-xs hover:bg-gray-800 disabled:opacity-40"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>

            {/* Status Update Digest Feed */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                <div className="flex items-center space-x-2">
                  <TagIcon className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-black text-sm text-gray-900 dark:text-white">Recent Status Updates</h3>
                </div>
                <span className="text-xs text-gray-400 font-semibold">{statusUpdates.length} updates</span>
              </div>

              {statusUpdates.length === 0 ? (
                <div className="text-center py-8 text-gray-400 space-y-2">
                  <p className="text-xs">No status updates published yet.</p>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                  >
                    + Publish the first status update
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {statusUpdates.map(update => {
                    const author = users.find(u => u.uid === update.authorId);
                    const updateBadge = getHealthBadge(update.status);

                    return (
                      <div key={update.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/60 space-y-2.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${updateBadge.bg}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${updateBadge.dot}`} />
                                <span>{updateBadge.label}</span>
                              </span>
                              <h4 className="font-bold text-xs text-gray-900 dark:text-white">{update.title}</h4>
                            </div>
                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                              Posted by {author?.displayName || 'Team Member'} on {new Date(update.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                          {update.summary}
                        </p>

                        {update.blockers && (
                          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/60 text-xs">
                            <span className="font-bold text-rose-700 dark:text-rose-400 block mb-0.5">⚠️ Blockers & Risks</span>
                            <span className="text-rose-900 dark:text-rose-200">{update.blockers}</span>
                          </div>
                        )}

                        {update.nextSteps && (
                          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs">
                            <span className="font-bold text-blue-700 dark:text-blue-400 block mb-0.5">🚀 Next Steps</span>
                            <span className="text-blue-900 dark:text-blue-200">{update.nextSteps}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (4 cols): Project Roles, Connected Resources & Milestones */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Project Roles & Leadership */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-xs space-y-3">
              <h3 className="font-black text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">
                Project Leadership & Roles
              </h3>

              <div className="space-y-2.5 text-xs">
                {['Project Owner', 'Tech Lead', 'Reviewer'].map(roleName => {
                  const assignedRole = (brief.roles || []).find(r => r.role === roleName);
                  const assignedUser = users.find(u => u.uid === assignedRole?.userId);

                  return (
                    <div key={roleName} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400 block">{roleName}</span>
                        <span className="font-semibold text-gray-800 dark:text-slate-200">
                          {assignedUser?.displayName || 'Unassigned'}
                        </span>
                      </div>
                      <select
                        value={assignedRole?.userId || ''}
                        onChange={e => handleRoleChange(roleName, e.target.value)}
                        className="text-[11px] font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1 text-gray-700 dark:text-slate-300"
                      >
                        <option value="">Select User</option>
                        {users.map(u => (
                          <option key={u.uid} value={u.uid}>{u.displayName}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Milestones Summary */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <DiamondIcon className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Key Milestones
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {completedMilestones.length}/{milestones.length} Done
                </span>
              </div>

              {milestones.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No milestone tasks defined yet. Mark tasks as milestone in the task modal.</p>
              ) : (
                <div className="space-y-2">
                  {milestones.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center space-x-2 min-w-0">
                        <DiamondIcon className={`w-3.5 h-3.5 shrink-0 ${m.status === 'Done' ? 'text-emerald-500' : 'text-gray-400'}`} />
                        <span className={`font-semibold truncate ${m.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-slate-200'}`}>
                          {m.title}
                        </span>
                      </div>
                      {m.dueDate && (
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {new Date(m.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Connected Links & Resources */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700/80 shadow-xs space-y-3">
              <div className="flex items-center space-x-1.5">
                <LinkIcon className="w-4 h-4 text-blue-600" />
                <h3 className="font-black text-xs uppercase tracking-wider text-gray-500 dark:text-slate-400">
                  Connected Resources & Links
                </h3>
              </div>

              <div className="space-y-1.5">
                {(brief.links || []).map(link => (
                  <div key={link.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 text-xs">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {link.title}
                    </a>
                    <button
                      onClick={() => handleRemoveLink(link.id)}
                      className="text-gray-400 hover:text-red-500 p-1 text-xs"
                      title="Remove link"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Link Form */}
              <form onSubmit={handleAddLink} className="space-y-2 pt-1 text-xs">
                <input
                  type="text"
                  placeholder="Link Title (e.g. Figma Prototype)"
                  value={newLinkTitle}
                  onChange={e => setNewLinkTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                />
                <div className="flex items-center space-x-1.5">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Post Status Update Modal */}
      <StatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        project={project}
        currentUser={currentUser}
        onUpdateAdded={handleStatusUpdateAdded}
      />
    </div>
  );
};
export default ProjectOverviewView;
