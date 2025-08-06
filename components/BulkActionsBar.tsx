import React, { useState, useEffect } from 'react';
import { Task, Project, User } from '../types';
import { 
  CheckIcon, 
  TrashIcon, 
  UserIcon, 
  FlagIcon, 
  PlayIcon, 
  CheckCircleIcon,
  XIcon,
  ArrowRightIcon
} from './icons';

interface BulkActionsBarProps {
  selectedTasks: string[];
  selectedProjects: string[];
  onClearSelection: () => void;
  onBulkDeleteTasks: (taskIds: string[]) => void;
  onBulkDeleteProjects: (projectIds: string[]) => void;
  onBulkAssignTasks: (taskIds: string[], assigneeId: string) => void;
  onBulkUpdateTaskStatus: (taskIds: string[], status: string) => void;
  onBulkUpdateTaskPriority: (taskIds: string[], priority: string) => void;
  onBulkMoveTasksToProject: (taskIds: string[], projectId: string) => void;
  users: User[];
  projects: Project[];
}

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

const Dropdown: React.FC<DropdownProps> = ({ trigger, children, isOpen, onToggle }) => {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center space-x-1 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {trigger}
      </button>
      {isOpen && (
        <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-48">
          {children}
        </div>
      )}
    </div>
  );
};

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedTasks,
  selectedProjects,
  onClearSelection,
  onBulkDeleteTasks,
  onBulkDeleteProjects,
  onBulkAssignTasks,
  onBulkUpdateTaskStatus,
  onBulkUpdateTaskPriority,
  onBulkMoveTasksToProject,
  users,
  projects,
}) => {
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const totalSelected = selectedTasks.length + selectedProjects.length;

  if (totalSelected === 0) return null;

  const closeAllDropdowns = () => {
    setAssignDropdownOpen(false);
    setStatusDropdownOpen(false);
    setPriorityDropdownOpen(false);
    setProjectDropdownOpen(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 z-50">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <CheckIcon className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            {totalSelected} item{totalSelected > 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="h-4 border-l border-gray-300" />

        {selectedTasks.length > 0 && (
          <>
            <Dropdown
              trigger={
                <>
                  <UserIcon className="w-4 h-4" />
                  <span>Assign</span>
                </>
              }
              isOpen={assignDropdownOpen}
              onToggle={() => {
                closeAllDropdowns();
                setAssignDropdownOpen(!assignDropdownOpen);
              }}
            >
              <div className="py-1">
                {users.map(user => (
                  <button
                    key={user.uid}
                    onClick={() => {
                      onBulkAssignTasks(selectedTasks, user.uid);
                      closeAllDropdowns();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                    <span>{user.displayName}</span>
                  </button>
                ))}
              </div>
            </Dropdown>

            <Dropdown
              trigger={
                <>
                  <PlayIcon className="w-4 h-4" />
                  <span>Status</span>
                </>
              }
              isOpen={statusDropdownOpen}
              onToggle={() => {
                closeAllDropdowns();
                setStatusDropdownOpen(!statusDropdownOpen);
              }}
            >
              <div className="py-1">
                {['To Do', 'In Progress', 'Done'].map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      onBulkUpdateTaskStatus(selectedTasks, status);
                      closeAllDropdowns();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </Dropdown>

            <Dropdown
              trigger={
                <>
                  <FlagIcon className="w-4 h-4" />
                  <span>Priority</span>
                </>
              }
              isOpen={priorityDropdownOpen}
              onToggle={() => {
                closeAllDropdowns();
                setPriorityDropdownOpen(!priorityDropdownOpen);
              }}
            >
              <div className="py-1">
                {[
                  { value: 'low', label: 'Low', color: 'text-gray-600' },
                  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
                  { value: 'high', label: 'High', color: 'text-orange-600' },
                  { value: 'critical', label: 'Critical', color: 'text-red-600' },
                ].map(priority => (
                  <button
                    key={priority.value}
                    onClick={() => {
                      onBulkUpdateTaskPriority(selectedTasks, priority.value);
                      closeAllDropdowns();
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${priority.color}`}
                  >
                    {priority.label}
                  </button>
                ))}
              </div>
            </Dropdown>

            <Dropdown
              trigger={
                <>
                  <ArrowRightIcon className="w-4 h-4" />
                  <span>Move to</span>
                </>
              }
              isOpen={projectDropdownOpen}
              onToggle={() => {
                closeAllDropdowns();
                setProjectDropdownOpen(!projectDropdownOpen);
              }}
            >
              <div className="py-1 max-h-48 overflow-y-auto">
                {projects.filter(p => p.status === 'active').map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onBulkMoveTasksToProject(selectedTasks, project.id);
                      closeAllDropdowns();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center space-x-2"
                  >
                    <div className={`w-3 h-3 rounded-full ${project.color}`}></div>
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            </Dropdown>
          </>
        )}

        <div className="h-4 border-l border-gray-300" />

        <button
          onClick={() => {
            if (selectedTasks.length > 0) {
              onBulkDeleteTasks(selectedTasks);
            }
            if (selectedProjects.length > 0) {
              onBulkDeleteProjects(selectedProjects);
            }
          }}
          className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <TrashIcon className="w-4 h-4" />
          <span>Delete</span>
        </button>

        <button
          onClick={onClearSelection}
          className="flex items-center space-x-1 px-2 py-2 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default BulkActionsBar;