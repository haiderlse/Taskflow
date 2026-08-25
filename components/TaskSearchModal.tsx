import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, Project, User, Priority, ColumnId } from '../types';
import { 
  SearchIcon, 
  XIcon, 
  CheckCircleIcon, 
  LockClosedIcon, 
  LockOpenIcon, 
  LinkIcon, 
  CalendarIcon, 
  FilterIcon, 
  ArrowRightIcon, 
  ClockIcon, 
  FolderIcon, 
  TagIcon 
} from './icons';

interface TaskSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  users: User[];
  currentUser?: User | null;
  onSelectTask: (task: Task, projectId?: string) => void;
  onNavigateToProject?: (projectId: string) => void;
}

export const TaskSearchModal: React.FC<TaskSearchModalProps> = ({
  isOpen,
  onClose,
  tasks,
  projects,
  users,
  currentUser,
  onSelectTask,
  onNavigateToProject,
}) => {
  const [query, setQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [filterBlockedOnly, setFilterBlockedOnly] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  // Filter tasks
  const filteredTasks = useMemo(() => {
    const q = query.toLowerCase().trim();

    return tasks.filter(task => {
      // Text match (title, description, tags, assignee name)
      const titleMatch = task.title.toLowerCase().includes(q);
      const descMatch = (task.description || '').toLowerCase().includes(q);
      const tagsMatch = (task.tags || []).some(t => t.toLowerCase().includes(q));
      const assignee = task.assigneeId ? usersMap.get(task.assigneeId) : null;
      const assigneeMatch = assignee ? assignee.displayName.toLowerCase().includes(q) : false;
      const project = projectsMap.get(task.projectId);
      const projectMatch = project ? project.name.toLowerCase().includes(q) : false;

      const matchesQuery = !q || titleMatch || descMatch || tagsMatch || assigneeMatch || projectMatch;
      if (!matchesQuery) return false;

      // Status filter
      if (selectedStatus !== 'all' && task.status !== selectedStatus) return false;

      // Priority filter
      if (selectedPriority !== 'all' && task.priority !== selectedPriority) return false;

      // Project filter
      if (selectedProject !== 'all' && task.projectId !== selectedProject) return false;

      // Assignee filter
      if (selectedAssignee !== 'all') {
        if (selectedAssignee === 'unassigned' && task.assigneeId) return false;
        if (selectedAssignee === 'me' && currentUser && task.assigneeId !== currentUser.uid) return false;
        if (selectedAssignee !== 'unassigned' && selectedAssignee !== 'me' && task.assigneeId !== selectedAssignee) return false;
      }

      // Blocked only filter
      if (filterBlockedOnly) {
        const blockers = task.blockedBy || task.dependencies || [];
        const hasUnresolvedBlockers = blockers.some(bId => {
          const b = tasks.find(t => t.id === bId);
          return b && b.status !== 'Done';
        });
        if (!hasUnresolvedBlockers || task.status === 'Done') return false;
      }

      return true;
    });
  }, [tasks, query, selectedStatus, selectedPriority, selectedProject, selectedAssignee, filterBlockedOnly, usersMap, projectsMap, currentUser]);

  if (!isOpen) return null;

  const priorityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-blue-100 text-blue-700 border-blue-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Header Bar */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
          <SearchIcon className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks by title, description, tags, assignee, project..."
            className="flex-1 text-sm bg-transparent border-none outline-none focus:ring-0 text-gray-900 placeholder-gray-400 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1.5 border-l pl-3 text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded font-mono text-[11px]">ESC</kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-200 flex items-center gap-2 overflow-x-auto text-xs scrollbar-thin">
          <span className="font-semibold text-gray-500 flex items-center gap-1 shrink-0">
            <FilterIcon className="w-3.5 h-3.5" />
            Filters:
          </span>

          {/* Status filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md text-gray-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="To Do">To Do</option>
            <option value="In Progress">In Progress</option>
            <option value="Done">Done</option>
          </select>

          {/* Priority filter */}
          <select
            value={selectedPriority}
            onChange={e => setSelectedPriority(e.target.value)}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md text-gray-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Project filter */}
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md text-gray-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none max-w-[140px] truncate"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Assignee filter */}
          <select
            value={selectedAssignee}
            onChange={e => setSelectedAssignee(e.target.value)}
            className="px-2 py-1 bg-white border border-gray-300 rounded-md text-gray-700 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none max-w-[130px] truncate"
          >
            <option value="all">All Assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {users.map(u => (
              <option key={u.uid} value={u.uid}>{u.displayName}</option>
            ))}
          </select>

          {/* Blocked only toggle button */}
          <button
            onClick={() => setFilterBlockedOnly(prev => !prev)}
            className={`px-2.5 py-1 rounded-md border text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
              filterBlockedOnly 
                ? 'bg-red-100 text-red-700 border-red-300' 
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            <LockClosedIcon className="w-3 h-3" />
            <span>Blocked Only</span>
          </button>

          {(selectedStatus !== 'all' || selectedPriority !== 'all' || selectedProject !== 'all' || selectedAssignee !== 'all' || filterBlockedOnly || query) && (
            <button
              onClick={() => {
                setQuery('');
                setSelectedStatus('all');
                setSelectedPriority('all');
                setSelectedProject('all');
                setSelectedAssignee('all');
                setFilterBlockedOnly(false);
              }}
              className="text-blue-600 hover:text-blue-800 font-medium text-xs underline shrink-0 ml-auto"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Results Count Bar */}
        <div className="px-4 py-2 bg-white text-xs text-gray-500 flex items-center justify-between border-b border-gray-100">
          <span>Found <strong>{filteredTasks.length}</strong> task{filteredTasks.length === 1 ? '' : 's'}</span>
          <span className="text-[11px] text-gray-400">Click task to view full details</span>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-gray-50">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => {
              const project = projectsMap.get(task.projectId);
              const assignee = task.assigneeId ? usersMap.get(task.assigneeId) : null;
              const blockers = task.blockedBy || task.dependencies || [];
              const hasUnresolvedBlockers = blockers.some(bId => {
                const b = tasks.find(t => t.id === bId);
                return b && b.status !== 'Done';
              });
              const isBlocked = hasUnresolvedBlockers && task.status !== 'Done';

              return (
                <div
                  key={task.id}
                  onClick={() => {
                    onSelectTask(task, task.projectId);
                    onClose();
                  }}
                  className="pt-2 first:pt-0 group p-3 rounded-xl hover:bg-blue-50/60 border border-transparent hover:border-blue-200 cursor-pointer transition-all flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        task.status === 'Done' ? 'bg-emerald-500' :
                        task.status === 'In Progress' ? 'bg-blue-500' : 'bg-slate-300'
                      }`} />
                      <h4 className={`text-sm font-semibold truncate group-hover:text-blue-600 transition-colors ${
                        task.status === 'Done' ? 'line-through text-gray-400' : 'text-gray-900'
                      }`}>
                        {task.title}
                      </h4>
                    </div>

                    {/* Status & Priority badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold border ${
                        priorityColors[task.priority] || priorityColors.medium
                      }`}>
                        {task.priority}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                        task.status === 'Done' ? 'bg-emerald-100 text-emerald-800' :
                        task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {/* Task Description Snippet */}
                  {task.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 pl-4.5">
                      {task.description}
                    </p>
                  )}

                  {/* Footer Meta: Project, Assignee, Due Date, Blockers */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      {project && (
                        <span 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigateToProject) {
                              onNavigateToProject(project.id);
                              onClose();
                            }
                          }}
                          className="flex items-center gap-1 text-gray-600 hover:text-blue-600 font-medium"
                        >
                          <span className={`w-2 h-2 rounded-full ${project.color}`} />
                          <span>{project.name}</span>
                        </span>
                      )}

                      {assignee ? (
                        <span className="flex items-center gap-1 text-gray-600">
                          <span className="w-4 h-4 bg-yellow-400 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                            {assignee.displayName.slice(0, 1).toUpperCase()}
                          </span>
                          <span>{assignee.displayName}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">Unassigned</span>
                      )}

                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-gray-500">
                          <CalendarIcon className="w-3 h-3" />
                          <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isBlocked && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
                          <LockClosedIcon className="w-3 h-3" />
                          <span>Blocked</span>
                        </span>
                      )}

                      {(task.blocking && task.blocking.length > 0) && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1">
                          <LinkIcon className="w-3 h-3" />
                          <span>Blocks {task.blocking.length}</span>
                        </span>
                      )}

                      {task.tags && task.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {task.tags.map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <SearchIcon className="w-10 h-10 mx-auto text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No tasks match your search criteria</p>
              <p className="text-xs text-gray-400">Try adjusting your search terms or clearing some filters.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-3">
            <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-gray-300 rounded font-mono text-[10px]">↵</kbd> or click to open</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskSearchModal;
