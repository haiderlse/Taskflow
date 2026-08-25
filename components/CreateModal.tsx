import React, { useState } from 'react';
import { Project, User, Priority } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import { 
  XIcon, 
  PlusIcon, 
  CheckCircleIcon, 
  FolderIcon, 
  GoalsIcon, 
  PortfolioIcon, 
  UsersIcon 
} from './icons';

interface CreateModalProps {
  onClose: () => void;
  currentUser?: User | null;
  projects?: Project[];
  users?: User[];
  onTaskCreated?: () => void;
  onProjectCreated?: (newProject: Project) => void;
}

type CreateType = 'task' | 'project' | 'goal' | 'portfolio';

export const CreateModal: React.FC<CreateModalProps> = ({
  onClose,
  currentUser,
  projects = [],
  users = [],
  onTaskCreated,
  onProjectCreated,
}) => {
  const [activeType, setActiveType] = useState<CreateType>('task');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskProjectId, setTaskProjectId] = useState<string>(projects[0]?.id || 'proj-1');
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>(currentUser?.uid || 'user-1');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskDueDate, setTaskDueDate] = useState<string>(new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);

  // Project form state
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectColor, setProjectColor] = useState('bg-blue-500');

  // Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalDate, setGoalDate] = useState('2025-06-30');

  // Portfolio form state
  const [portfolioName, setPortfolioName] = useState('');
  const [portfolioDesc, setPortfolioDesc] = useState('');

  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 
    'bg-amber-500', 'bg-indigo-500', 'bg-teal-500', 'bg-rose-500'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeType === 'task') {
        if (!taskTitle.trim()) return;
        await enhancedApi.createTask({
          title: taskTitle,
          description: taskDesc,
          projectId: taskProjectId,
          assigneeId: taskAssigneeId || null,
          createdBy: currentUser?.uid || 'user-1',
          priority: taskPriority,
          dueDate: new Date(taskDueDate),
          status: 'To Do',
          taskStatus: 'not_started',
          dependencies: [],
          blockedBy: [],
          blocking: [],
          subtasks: [],
          tags: [],
          timeTracked: 0,
        });
        if (onTaskCreated) onTaskCreated();
      } else if (activeType === 'project') {
        if (!projectName.trim()) return;
        const newProj = await enhancedApi.createProject(projectName, currentUser?.uid || 'user-1');
        if (onProjectCreated) onProjectCreated(newProj);
      } else if (activeType === 'goal') {
        if (!goalName.trim()) return;
        await enhancedApi.createGoal({
          name: goalName,
          description: goalDesc,
          ownerId: currentUser?.uid || 'user-1',
          targetDate: new Date(goalDate),
          keyResults: [{ id: `kr-${Date.now()}`, name: 'Milestone 1', targetValue: 100, currentValue: 0, unit: '%', isCompleted: false }],
        });
      } else if (activeType === 'portfolio') {
        if (!portfolioName.trim()) return;
        await enhancedApi.createPortfolio({
          name: portfolioName,
          description: portfolioDesc,
          ownerId: currentUser?.uid || 'user-1',
          projects: projects.slice(0, 2).map(p => p.id),
        });
      }

      setSuccessToast(true);
      setTimeout(() => {
        setSuccessToast(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to create item', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <span className="p-1 bg-blue-100 text-blue-700 rounded-lg">
              <PlusIcon className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-gray-900">Create New Item</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="grid grid-cols-4 p-2 bg-gray-100/70 border-b border-gray-200 gap-1 text-xs font-semibold text-center">
          <button
            onClick={() => setActiveType('task')}
            className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeType === 'task' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>Task</span>
          </button>

          <button
            onClick={() => setActiveType('project')}
            className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeType === 'project' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FolderIcon className="w-3.5 h-3.5" />
            <span>Project</span>
          </button>

          <button
            onClick={() => setActiveType('goal')}
            className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeType === 'goal' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GoalsIcon className="w-3.5 h-3.5" />
            <span>Goal</span>
          </button>

          <button
            onClick={() => setActiveType('portfolio')}
            className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeType === 'portfolio' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PortfolioIcon className="w-3.5 h-3.5" />
            <span>Portfolio</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TASK FORM */}
          {activeType === 'task' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement real-time WebSocket connection"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Project</label>
                  <select
                    value={taskProjectId}
                    onChange={e => setTaskProjectId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Assignee</label>
                  <select
                    value={taskAssigneeId}
                    onChange={e => setTaskAssigneeId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none"
                  >
                    {users.map(u => (
                      <option key={u.uid} value={u.uid}>{u.displayName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={e => setTaskPriority(e.target.value as Priority)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={e => setTaskDueDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Add details, acceptance criteria, or dependencies..."
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* PROJECT FORM */}
          {activeType === 'project' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Project Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q2 Customer Portal Redesign"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Color Theme</label>
                <div className="flex items-center space-x-2 pt-1">
                  {colors.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setProjectColor(c)}
                      className={`w-7 h-7 rounded-full ${c} transition-transform ${
                        projectColor === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="What is the objective of this project?"
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* GOAL FORM */}
          {activeType === 'goal' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Goal / Objective *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Accelerate engineering delivery cycle by 25%"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Target Date</label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={e => setGoalDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Objective Summary</label>
                <textarea
                  rows={3}
                  placeholder="Why is this objective key for our organization?"
                  value={goalDesc}
                  onChange={e => setGoalDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* PORTFOLIO FORM */}
          {activeType === 'portfolio' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Portfolio Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infrastructure & Cloud Modernization"
                  value={portfolioName}
                  onChange={e => setPortfolioName(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe the overarching strategic programs in this portfolio..."
                  value={portfolioDesc}
                  onChange={e => setPortfolioDesc(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            {successToast ? (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                ✓ Created successfully!
              </span>
            ) : <span />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
              >
                {loading ? 'Creating...' : `Create ${activeType}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateModal;
