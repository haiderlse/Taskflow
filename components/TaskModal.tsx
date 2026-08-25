import React, { useState, useEffect, useCallback } from 'react';
import { Task, Comment, User, ColumnId, SubtaskItem, Priority } from '../types';
import { enhancedApi } from '../services/enhancedApi';
import TimeTracking from './TimeTracking';
import ApprovalModal from './ApprovalModal';
import { 
  XIcon, 
  CalendarIcon, 
  UserIcon, 
  ClockIcon, 
  CheckCircleIcon,
  LinkIcon,
  UnlinkIcon,
  LockClosedIcon,
  LockOpenIcon,
  BanIcon,
  PlusIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  DiamondIcon,
  CheckIcon,
  TagIcon,
  TrashIcon
} from './icons';
import { TaskDependencyIndicators } from './VisualIndicators';

interface TaskModalProps {
  task: Task;
  users: User[];
  currentUser: User;
  allTasks?: Task[];
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onNavigateToTask?: (targetTask: Task) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ 
  task, 
  users, 
  currentUser, 
  allTasks = [], 
  onClose, 
  onUpdateTask,
  onNavigateToTask 
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [startDate, setStartDate] = useState(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
  const [priority, setPriority] = useState<Priority>(task.priority || 'medium');
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedTime ? (task.estimatedTime / 60).toString() : '');
  const [isMilestone, setIsMilestone] = useState(!!task.isMilestone);
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  
  // Subtasks State
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(
    task.subtaskItems || (task.subtasks || []).map((stId, i) => ({
      id: stId || `subtask-${i}`,
      title: typeof stId === 'string' && stId.length > 5 ? stId : `Subtask ${i + 1}`,
      isCompleted: false
    }))
  );
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'subtasks' | 'dependencies' | 'time' | 'comments' | 'approvals'>('details');
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // State for adding dependencies
  const [selectedBlockerId, setSelectedBlockerId] = useState('');
  const [selectedDependentId, setSelectedDependentId] = useState('');

  // Keep local state in sync when task prop changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description);
    setAssigneeId(task.assigneeId);
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setStartDate(task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
    setPriority(task.priority || 'medium');
    setEstimatedHours(task.estimatedTime ? (task.estimatedTime / 60).toString() : '');
    setIsMilestone(!!task.isMilestone);
    setTags(task.tags || []);
    if (task.subtaskItems) {
      setSubtasks(task.subtaskItems);
    }
  }, [task]);

  useEffect(() => {
    enhancedApi.getCommentsForTask(task.id).then(setComments);
    const unsubscribe = enhancedApi.subscribeToComments(task.id, setComments);
    return () => unsubscribe();
  }, [task.id]);

  const handleUpdate = (updates: Partial<Task>) => {
    onUpdateTask(task.id, updates);
  };

  const handleToggleMilestone = () => {
    const newVal = !isMilestone;
    setIsMilestone(newVal);
    handleUpdate({ isMilestone: newVal });
  };

  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!newTagInput.trim()) return;
    const tagClean = newTagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tags.includes(tagClean)) {
      const updated = [...tags, tagClean];
      setTags(updated);
      handleUpdate({ tags: updated });
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter(t => t !== tagToRemove);
    setTags(updated);
    handleUpdate({ tags: updated });
  };

  // Subtasks Handlers
  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newItem: SubtaskItem = {
      id: `subtask-${Date.now()}`,
      title: newSubtaskTitle.trim(),
      isCompleted: false
    };
    const updated = [...subtasks, newItem];
    setSubtasks(updated);
    handleUpdate({ subtaskItems: updated });
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (subtaskId: string) => {
    const updated = subtasks.map(st => 
      st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
    );
    setSubtasks(updated);
    handleUpdate({ subtaskItems: updated });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    const updated = subtasks.filter(st => st.id !== subtaskId);
    setSubtasks(updated);
    handleUpdate({ subtaskItems: updated });
  };

  const completedSubtasksCount = subtasks.filter(s => s.isCompleted).length;
  const subtasksPercent = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && !isCommenting) {
      setIsCommenting(true);
      await enhancedApi.addComment(task.id, currentUser.uid, newComment.trim());
      setNewComment('');
      setIsCommenting(false);
    }
  };
  
  const getUserDisplayName = useCallback((userId: string) => {
    return users.find(u => u.uid === userId)?.displayName || 'Unknown User';
  }, [users]);

  const handleApprovalSubmitted = () => {
    setShowApprovalModal(false);
  };

  // Dependency Calculations
  const currentBlockerIds = task.blockedBy || task.dependencies || [];
  const currentDependentIds = task.blocking || [];

  const blockerTasks = currentBlockerIds
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean) as Task[];

  const dependentTasks = currentDependentIds
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean) as Task[];

  const unresolvedBlockers = blockerTasks.filter(t => t.status !== 'Done');
  const isCurrentlyBlocked = unresolvedBlockers.length > 0 || (blockerTasks.length === 0 && currentBlockerIds.length > 0);

  const availableBlockerOptions = allTasks.filter(t => 
    t.id !== task.id &&
    t.projectId === task.projectId &&
    !currentBlockerIds.includes(t.id) &&
    !currentDependentIds.includes(t.id)
  );

  const availableDependentOptions = allTasks.filter(t => 
    t.id !== task.id &&
    t.projectId === task.projectId &&
    !currentDependentIds.includes(t.id) &&
    !currentBlockerIds.includes(t.id)
  );

  const handleAddBlocker = () => {
    if (!selectedBlockerId) return;
    const updatedBlockers = Array.from(new Set([...currentBlockerIds, selectedBlockerId]));
    handleUpdate({ blockedBy: updatedBlockers, dependencies: updatedBlockers });
    setSelectedBlockerId('');
  };

  const handleRemoveBlocker = (blockerId: string) => {
    const updatedBlockers = currentBlockerIds.filter(id => id !== blockerId);
    handleUpdate({ blockedBy: updatedBlockers, dependencies: updatedBlockers });
  };

  const handleAddDependent = () => {
    if (!selectedDependentId) return;
    const updatedDependents = Array.from(new Set([...currentDependentIds, selectedDependentId]));
    handleUpdate({ blocking: updatedDependents });
    setSelectedDependentId('');
  };

  const handleRemoveDependent = (dependentId: string) => {
    const updatedDependents = currentDependentIds.filter(id => id !== dependentId);
    handleUpdate({ blocking: updatedDependents });
  };

  const totalDependenciesCount = currentBlockerIds.length + currentDependentIds.length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative border border-gray-200 dark:border-slate-800 overflow-hidden text-gray-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60">
          <div className="flex items-center justify-between pr-8 mb-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={handleToggleMilestone}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all border ${
                  isMilestone
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700 hover:bg-gray-100'
                }`}
                title="Convert this task to an Asana Milestone"
              >
                <DiamondIcon className={`w-3.5 h-3.5 ${isMilestone ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                <span>{isMilestone ? 'Milestone' : 'Convert to Milestone'}</span>
              </button>

              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                task.status === 'Done' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                task.status === 'In Progress' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
              }`}>
                {task.status}
              </span>
            </div>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleUpdate({ title })}
            className="w-full text-xl font-black bg-transparent focus:outline-none focus:bg-white dark:focus:bg-slate-800 rounded-lg px-2 py-1 -m-2 text-gray-900 dark:text-white"
            placeholder="Task Title"
          />
          
          {/* Tabs */}
          <div className="flex space-x-4 mt-4 border-b border-gray-200 dark:border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 border-b-2 transition-colors ${activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('subtasks')}
              className={`pb-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${activeTab === 'subtasks' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <span>Subtasks</span>
              {subtasks.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono">
                  {completedSubtasksCount}/{subtasks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('dependencies')}
              className={`pb-2.5 border-b-2 flex items-center space-x-1.5 transition-colors ${activeTab === 'dependencies' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <span>Dependencies</span>
              {totalDependenciesCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isCurrentlyBlocked ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-bold' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                }`}>
                  {totalDependenciesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('time')}
              className={`pb-2.5 border-b-2 transition-colors ${activeTab === 'time' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Time Tracking
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-2.5 border-b-2 transition-colors ${activeTab === 'comments' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-2.5 border-b-2 transition-colors ${activeTab === 'approvals' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Approvals {task.approval && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  task.approval.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                  task.approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {task.approval.status}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow overflow-y-auto">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Task Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Assignee */}
                <div className="flex items-center space-x-2.5 p-3 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-grow min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Assignee</label>
                    <select
                      value={assigneeId || ''}
                      onChange={(e) => {
                        const newId = e.target.value || null;
                        setAssigneeId(newId);
                        handleUpdate({ assigneeId: newId });
                      }}
                      className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer truncate"
                    >
                      <option value="" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">Unassigned</option>
                      {users.map(user => (
                        <option key={user.uid} value={user.uid} className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">
                          {user.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority */}
                <div className="flex items-center space-x-2.5 p-3 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${
                    priority === 'critical' ? 'bg-red-500' :
                    priority === 'high' ? 'bg-orange-500' :
                    priority === 'medium' ? 'bg-blue-500' : 'bg-slate-400'
                  }`} />
                  <div className="flex-grow min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => {
                        setPriority(e.target.value as any);
                        handleUpdate({ priority: e.target.value as any });
                      }}
                      className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer capitalize"
                    >
                      <option value="low" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">Low</option>
                      <option value="medium" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">Medium</option>
                      <option value="high" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">High</option>
                      <option value="critical" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">Critical (P0)</option>
                    </select>
                  </div>
                </div>

                {/* Due Date */}
                <div className="flex items-center space-x-2.5 p-3 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-grow min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        handleUpdate({ dueDate: e.target.value ? new Date(e.target.value) : null });
                      }}
                      className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none p-0 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Estimated Effort */}
                <div className="flex items-center space-x-2.5 p-3 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-grow min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Estimate (Hrs)</label>
                    <input
                      type="number"
                      min="0"
                      value={estimatedHours}
                      onChange={(e) => {
                        setEstimatedHours(e.target.value);
                        const val = parseFloat(e.target.value);
                        handleUpdate({ estimatedTime: isNaN(val) ? undefined : Math.round(val * 60) });
                      }}
                      placeholder="e.g. 4"
                      className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none p-0"
                    />
                  </div>
                </div>
              </div>

              {/* Tags Section */}
              <div className="p-4 bg-gray-50/60 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2 flex items-center space-x-1.5">
                  <TagIcon className="w-3.5 h-3.5 text-blue-500" />
                  <span>Tags & Labels</span>
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                    >
                      <span>#{tag}</span>
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-500 hover:text-red-500 ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center space-x-1">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="+ Add tag..."
                      className="px-2 py-0.5 text-xs bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
                    />
                    {newTagInput.trim() && (
                      <button
                        onClick={handleAddTag}
                        className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded font-bold"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300 mb-1.5">
                  Description & Task Notes
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleUpdate({ description })}
                  rows={4}
                  className="w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
                  placeholder="Add a more detailed description, requirements, or links..."
                />
              </div>
            </div>
          )}

          {/* Subtasks Tab */}
          {activeTab === 'subtasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">Subtasks Checklist</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Break down this task into smaller actionable steps.
                  </p>
                </div>
                {subtasks.length > 0 && (
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    {completedSubtasksCount} of {subtasks.length} completed ({subtasksPercent}%)
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {subtasks.length > 0 && (
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${subtasksPercent}%` }}
                  />
                </div>
              )}

              {/* Subtask list */}
              <div className="space-y-2">
                {subtasks.map(st => (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      st.isCompleted 
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40' 
                        : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-2xs'
                    }`}
                  >
                    <label className="flex items-center space-x-3 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={st.isCompleted}
                        onChange={() => handleToggleSubtask(st.id)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-gray-300 dark:border-slate-700"
                      />
                      <span className={`text-xs font-medium truncate ${
                        st.isCompleted ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-900 dark:text-white'
                      }`}>
                        {st.title}
                      </span>
                    </label>

                    <button
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                      title="Delete subtask"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add subtask input */}
              <form onSubmit={handleAddSubtask} className="flex items-center space-x-2 pt-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Add a new subtask..."
                  className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim()}
                  className="flex items-center space-x-1 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors shrink-0 shadow-xs"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  <span>Add Subtask</span>
                </button>
              </form>
            </div>
          )}

          {/* Dependencies Tab */}
          {activeTab === 'dependencies' && (
            <div className="space-y-6">
              {/* Dependency Status Banner */}
              {currentBlockerIds.length > 0 && isCurrentlyBlocked && (
                <div className="p-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl flex items-start space-x-3">
                  <BanIcon className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-900 dark:text-red-300">Task is Blocked</h4>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                      This task has {unresolvedBlockers.length} incomplete prerequisite task{unresolvedBlockers.length === 1 ? '' : 's'}. Complete all blockers before closing this task.
                    </p>
                  </div>
                </div>
              )}

              {/* Section 1: Blocked By */}
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800/80 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <LockClosedIcon className="w-4 h-4 text-red-500" />
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white">Blocked By (Prerequisites)</h4>
                    <span className="bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {currentBlockerIds.length}
                    </span>
                  </div>
                </div>

                {blockerTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    {blockerTasks.map(blocker => (
                      <div key={blocker.id} className="p-2.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 flex items-center justify-between text-xs">
                        <span className={`font-semibold truncate ${blocker.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {blocker.title}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-slate-700 font-bold">{blocker.status}</span>
                          <button onClick={() => handleRemoveBlocker(blocker.id)} className="text-gray-400 hover:text-red-500">
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No blocker tasks linked.</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={selectedBlockerId}
                    onChange={(e) => setSelectedBlockerId(e.target.value)}
                    className="flex-1 text-xs border border-gray-300 dark:border-slate-700 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select prerequisite task...</option>
                    {availableBlockerOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddBlocker}
                    disabled={!selectedBlockerId}
                    className="px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Section 2: Blocking */}
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-800/80 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-2">
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="w-4 h-4 text-purple-500" />
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white">Blocking (Downstream Tasks)</h4>
                    <span className="bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {currentDependentIds.length}
                    </span>
                  </div>
                </div>

                {dependentTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    {dependentTasks.map(dep => (
                      <div key={dep.id} className="p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/40 bg-purple-50/50 dark:bg-purple-950/30 flex items-center justify-between text-xs">
                        <span className="font-semibold text-gray-900 dark:text-white truncate">{dep.title}</span>
                        <button onClick={() => handleRemoveDependent(dep.id)} className="text-gray-400 hover:text-red-500">
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No downstream dependent tasks.</p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={selectedDependentId}
                    onChange={(e) => setSelectedDependentId(e.target.value)}
                    className="flex-1 text-xs border border-gray-300 dark:border-slate-700 rounded-lg p-1.5 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Select downstream task...</option>
                    {availableDependentOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.title}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddDependent}
                    disabled={!selectedDependentId}
                    className="px-3 py-1.5 text-xs font-bold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Time Tracking Tab */}
          {activeTab === 'time' && (
            <TimeTracking
              task={task}
              currentUser={currentUser}
              onTimeUpdate={(newTime) => {
                handleUpdate({ timeTracked: newTime });
              }}
            />
          )}

          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <div className="space-y-4 text-xs">
              <form onSubmit={handleCommentSubmit} className="space-y-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment or mention team members..."
                  rows={3}
                  className="w-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-xl p-3 text-xs focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newComment.trim() || isCommenting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                  >
                    {isCommenting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>

              <div className="space-y-2.5 pt-3 border-t border-gray-100 dark:border-slate-800">
                {comments.length > 0 ? (
                  comments.map(comment => (
                    <div key={comment.id} className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200/80 dark:border-slate-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {getUserDisplayName(comment.userId)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-slate-300">{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-center py-4 italic">No comments yet.</p>
                )}
              </div>
            </div>
          )}

          {/* Approvals Tab */}
          {activeTab === 'approvals' && (
            <div>
              {task.approval ? (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-gray-50 dark:bg-slate-800/80 rounded-xl border border-gray-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 dark:text-white">Approval Status</h4>
                      <span className={`px-2.5 py-0.5 rounded-full font-bold ${
                        task.approval.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                        task.approval.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {task.approval.status.toUpperCase()}
                      </span>
                    </div>
                    <p><strong>Requested by:</strong> {getUserDisplayName(task.approval.requestedBy)}</p>
                    <p><strong>Type:</strong> {task.approval.approvalType.replace('_', ' ')}</p>
                  </div>

                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors"
                  >
                    Manage Approval
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <ClockIcon className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="font-bold text-gray-700 dark:text-slate-300">No approval request active</p>
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    Request Approval
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {showApprovalModal && (
        <ApprovalModal
          task={task}
          currentUser={currentUser}
          users={users}
          onClose={() => setShowApprovalModal(false)}
          onApprovalSubmitted={handleApprovalSubmitted}
        />
      )}
    </div>
  );
};

export default TaskModal;
