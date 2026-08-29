import React, { useState, useEffect, useCallback } from 'react';
import { Task, Comment, User, ColumnId, SubtaskItem, Priority, TaskRecurrence, Project } from '../types';
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
  TrashIcon,
  BoltIcon
} from './icons';
import { TaskDependencyIndicators } from './VisualIndicators';
import { createGoogleCalendarUrl, downloadIcsFile } from '../utils/asanaUtils';

interface TaskModalProps {
  task: Task;
  users: User[];
  currentUser: User;
  allTasks?: Task[];
  project?: Project;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onNavigateToTask?: (targetTask: Task) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ 
  task, 
  users, 
  currentUser, 
  allTasks = [], 
  project,
  onClose, 
  onUpdateTask,
  onNavigateToTask,
  onDeleteTask
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<Priority>(task.priority || 'medium');
  const [dueDate, setDueDate] = useState(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [dueTime, setDueTime] = useState(task.dueTime || '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId);
  const [estimatedHours, setEstimatedHours] = useState(task.estimatedTime ? (task.estimatedTime / 60).toString() : '');
  const [isMilestone, setIsMilestone] = useState(!!task.isMilestone);
  const [collaboratorIds, setCollaboratorIds] = useState<string[]>(task.collaboratorIds || []);
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, any>>(task.customFields || {});

  // Recurrence
  const [hasRecurrence, setHasRecurrence] = useState(!!task.recurrence);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<TaskRecurrence['frequency']>(task.recurrence?.frequency || 'weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(task.recurrence?.interval || 1);
  const [repeatFrom, setRepeatFrom] = useState<'due_date' | 'completion_date'>(task.recurrence?.repeatFrom || 'due_date');

  // Subtasks
  const [subtasks, setSubtasks] = useState<SubtaskItem[]>(task.subtaskItems || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // UI state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'custom_fields' | 'subtasks' | 'dependencies' | 'time' | 'comments' | 'approvals' | 'activity'>('details');
  const [isCommenting, setIsCommenting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Dependency selection state
  const [selectedBlockerId, setSelectedBlockerId] = useState('');
  const [selectedDependentId, setSelectedDependentId] = useState('');

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority || 'medium');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setAssigneeId(task.assigneeId);
    setEstimatedHours(task.estimatedTime ? (task.estimatedTime / 60).toString() : '');
    setIsMilestone(!!task.isMilestone);
    setCollaboratorIds(task.collaboratorIds || []);
    setTags(task.tags || []);
    setCustomFields(task.customFields || {});
    setHasRecurrence(!!task.recurrence);
    if (task.recurrence) {
      setRecurrenceFrequency(task.recurrence.frequency);
      setRecurrenceInterval(task.recurrence.interval || 1);
      setRepeatFrom(task.recurrence.repeatFrom || 'due_date');
    }
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

  const isCompleted = task.status === 'Done';

  const handleToggleComplete = () => {
    const nextStatus: ColumnId = isCompleted ? 'In Progress' : 'Done';
    handleUpdate({
      status: nextStatus,
      completedDate: nextStatus === 'Done' ? new Date() : undefined
    });
  };

  const handleDeleteTask = () => {
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      if (onDeleteTask) {
        onDeleteTask(task.id);
      } else {
        enhancedApi.deleteTask(task.id);
      }
      onClose();
    }
  };

  const handleToggleMilestone = () => {
    const newVal = !isMilestone;
    setIsMilestone(newVal);
    handleUpdate({ isMilestone: newVal });
  };

  const handleRecurrenceChange = (enable: boolean) => {
    setHasRecurrence(enable);
    if (enable) {
      const rec: TaskRecurrence = {
        frequency: recurrenceFrequency,
        interval: recurrenceInterval,
        repeatFrom: repeatFrom
      };
      handleUpdate({ recurrence: rec });
    } else {
      handleUpdate({ recurrence: undefined });
    }
  };

  const handleRecurrenceDetailChange = (freq: TaskRecurrence['frequency'], interval: number, from: 'due_date' | 'completion_date') => {
    setRecurrenceFrequency(freq);
    setRecurrenceInterval(interval);
    setRepeatFrom(from);
    if (hasRecurrence) {
      handleUpdate({
        recurrence: {
          frequency: freq,
          interval,
          repeatFrom: from
        }
      });
    }
  };

  const handleToggleCollaborator = (userId: string) => {
    const next = collaboratorIds.includes(userId)
      ? collaboratorIds.filter(id => id !== userId)
      : [...collaboratorIds, userId];
    setCollaboratorIds(next);
    handleUpdate({ collaboratorIds: next });
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    const nextFields = { ...customFields, [fieldId]: value };
    setCustomFields(nextFields);
    handleUpdate({ customFields: nextFields });
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
  const projectCustomFields = project?.customFields || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col relative border border-gray-200 dark:border-slate-800 overflow-hidden text-gray-900 dark:text-slate-100" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-center justify-between pr-8 mb-3 gap-2">
            <div className="flex flex-wrap items-center space-x-2">
              {/* Asana Mark Complete Toggle Button */}
              <button
                onClick={handleToggleComplete}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border shadow-2xs ${
                  isCompleted
                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 border-gray-300 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
                title={isCompleted ? "Mark as Incomplete" : "Mark as Complete"}
              >
                <CheckIcon className={`w-3.5 h-3.5 ${isCompleted ? 'stroke-[3]' : 'text-gray-400'}`} />
                <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
              </button>

              <button
                onClick={handleToggleMilestone}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  isMilestone
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700 hover:bg-gray-100'
                }`}
                title="Convert this task to an Asana Milestone"
              >
                <DiamondIcon className={`w-3.5 h-3.5 ${isMilestone ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`} />
                <span>{isMilestone ? 'Milestone' : 'Convert to Milestone'}</span>
              </button>

              <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                task.status === 'Done' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300' :
                task.status === 'In Progress' ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
              }`}>
                {task.status}
              </span>

              {hasRecurrence && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  <span>🔄</span>
                  <span>Repeats {recurrenceFrequency}</span>
                </span>
              )}
            </div>

            {/* Actions: Calendar export and Delete */}
            <div className="flex items-center space-x-1.5">
              <a
                href={createGoogleCalendarUrl(task)}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 flex items-center space-x-1"
                title="Add to Google Calendar"
              >
                <span>📅</span>
                <span>Google Cal</span>
              </a>
              <button
                onClick={() => downloadIcsFile(task)}
                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-50 flex items-center space-x-1"
                title="Download iCal file for Outlook / Apple Calendar"
              >
                <span>📥</span>
                <span>.ICS</span>
              </button>
              <button
                onClick={handleDeleteTask}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-900"
                title="Delete this task"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
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
          <div className="flex space-x-4 mt-4 border-b border-gray-200 dark:border-slate-800 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'details' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('custom_fields')}
              className={`pb-2.5 border-b-2 whitespace-nowrap flex items-center space-x-1 transition-colors ${activeTab === 'custom_fields' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              <span>Custom Fields</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 font-mono">
                {projectCustomFields.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('subtasks')}
              className={`pb-2.5 border-b-2 whitespace-nowrap flex items-center space-x-1.5 transition-colors ${activeTab === 'subtasks' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
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
              className={`pb-2.5 border-b-2 whitespace-nowrap flex items-center space-x-1.5 transition-colors ${activeTab === 'dependencies' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
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
              className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'time' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Time Tracking
            </button>
            <button
              onClick={() => setActiveTab('comments')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'comments' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'approvals' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Approvals
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`pb-2.5 border-b-2 whitespace-nowrap transition-colors ${activeTab === 'activity' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              Activity Log
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow overflow-y-auto">
          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Task Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Stage / Status */}
                <div className="flex items-center space-x-2.5 p-3 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${
                    task.status === 'Done' ? 'bg-emerald-500' :
                    task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-400'
                  }`} />
                  <div className="flex-grow min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Stage</label>
                    <select
                      value={task.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as ColumnId;
                        handleUpdate({ 
                          status: newStatus,
                          completedDate: newStatus === 'Done' ? new Date() : undefined
                        });
                      }}
                      className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="To Do" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">To Do</option>
                      <option value="In Progress" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">In Progress</option>
                      <option value="Done" className="text-gray-900 dark:text-white bg-white dark:bg-slate-800">Done</option>
                    </select>
                  </div>
                </div>

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

                {/* Due Time - drives the reminder ladder and places the task on the planner grid */}
                <div className="flex items-center space-x-2.5 p-3 bg-gray-50 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 rounded-xl">
                  <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="flex-grow min-w-0">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Due Time (optional)</label>
                    <input
                      type="time"
                      value={dueTime}
                      disabled={!dueDate}
                      onChange={(e) => {
                        setDueTime(e.target.value);
                        handleUpdate({ dueTime: e.target.value || null });
                      }}
                      className="w-full bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none p-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Recurrence Configuration Section */}
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200/70 dark:border-purple-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasRecurrence}
                      onChange={(e) => handleRecurrenceChange(e.target.checked)}
                      className="rounded border-purple-400 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="font-bold text-xs text-purple-900 dark:text-purple-300">
                      🔄 Set Recurring Task (Auto-creates next instance on completion)
                    </span>
                  </label>
                </div>

                {hasRecurrence && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Frequency</label>
                      <select
                        value={recurrenceFrequency}
                        onChange={(e) => handleRecurrenceDetailChange(e.target.value as any, recurrenceInterval, repeatFrom)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-semibold"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Repeat Every</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={recurrenceInterval}
                        onChange={(e) => handleRecurrenceDetailChange(recurrenceFrequency, parseInt(e.target.value) || 1, repeatFrom)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Compute Next Due Date From</label>
                      <select
                        value={repeatFrom}
                        onChange={(e) => handleRecurrenceDetailChange(recurrenceFrequency, recurrenceInterval, e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 font-semibold"
                      >
                        <option value="due_date">Scheduled Due Date</option>
                        <option value="completion_date">Actual Completion Date</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Collaborators Section */}
              <div className="p-4 bg-gray-50/60 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                  👥 Collaborators & Followers ({collaboratorIds.length})
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {users.map(u => {
                    const isFollower = collaboratorIds.includes(u.uid);
                    return (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() => handleToggleCollaborator(u.uid)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                          isFollower
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700 hover:bg-gray-100'
                        }`}
                      >
                        {isFollower ? `✓ ${u.displayName}` : `+ ${u.displayName}`}
                      </button>
                    );
                  })}
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

          {/* Custom Fields Tab */}
          {activeTab === 'custom_fields' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-800">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Project Custom Fields</h4>
                <span className="text-gray-400">{projectCustomFields.length} configured fields</span>
              </div>

              {projectCustomFields.length === 0 ? (
                <div className="text-center py-8 text-gray-400 space-y-2">
                  <p>No custom fields configured for this project yet.</p>
                  <p className="text-[11px]">Use the Custom Fields button on the project top bar to add dropdowns, currencies, numbers, and tags.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projectCustomFields.map(field => {
                    const val = customFields[field.id];

                    return (
                      <div key={field.id} className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-gray-800 dark:text-slate-200">
                            {field.name} {field.isRequired && <span className="text-red-500">*</span>}
                          </label>
                          <span className="text-[10px] text-gray-400 font-mono">({field.type})</span>
                        </div>

                        {field.type === 'dropdown' && (
                          <select
                            value={val || ''}
                            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-semibold"
                          >
                            <option value="">-- None --</option>
                            {(field.options || []).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {field.type === 'currency' && (
                          <div className="flex items-center space-x-1">
                            <span className="px-2 py-1.5 bg-gray-200 dark:bg-slate-700 rounded-l-lg font-bold text-gray-600 dark:text-slate-300">
                              {field.currencyCode || '$'}
                            </span>
                            <input
                              type="number"
                              value={val ?? ''}
                              onChange={e => handleCustomFieldChange(field.id, parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="flex-1 px-2.5 py-1.5 rounded-r-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-semibold"
                            />
                          </div>
                        )}

                        {field.type === 'number' && (
                          <input
                            type="number"
                            value={val ?? ''}
                            onChange={e => handleCustomFieldChange(field.id, parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-semibold"
                          />
                        )}

                        {field.type === 'percentage' && (
                          <div className="flex items-center space-x-2">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={val ?? 0}
                              onChange={e => handleCustomFieldChange(field.id, parseInt(e.target.value) || 0)}
                              className="flex-1"
                            />
                            <span className="w-10 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {val ?? 0}%
                            </span>
                          </div>
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={val || ''}
                            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                            placeholder="Text note..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          />
                        )}

                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={val || ''}
                            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                          />
                        )}

                        {field.type === 'checkbox' && (
                          <label className="flex items-center space-x-2 pt-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!!val}
                              onChange={e => handleCustomFieldChange(field.id, e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold text-gray-700 dark:text-slate-300">Confirmed / Checked</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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

          {/* Activity Log Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-slate-800">
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Task History & Audit Log</h4>
                <span className="text-gray-400">{(task.activities || []).length} events</span>
              </div>

              {(task.activities || []).length > 0 ? (
                <div className="space-y-2">
                  {(task.activities || []).map(act => (
                    <div key={act.id} className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700 flex items-start space-x-3">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        ⚡
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white">{act.details}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {act.userDisplayName || 'System'} • {new Date(act.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 text-center text-gray-400 space-y-1">
                  <p className="font-bold">Created on {new Date(task.createdAt).toLocaleDateString()}</p>
                  <p className="text-[11px]">Subsequent updates and state transitions are recorded here.</p>
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
