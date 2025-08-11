import React, { useState, useEffect, useRef } from 'react';
import { Task, Project, User } from '../types';
import { 
  EditIcon, 
  TrashIcon, 
  CopyIcon, 
  UserIcon, 
  ClockIcon, 
  CheckCircleIcon,
  PlayIcon,
  PauseIcon,
  FlagIcon 
} from './icons';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  items: ContextMenuItem[];
}

interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  divider?: boolean;
}

export interface TaskContextMenuProps {
  task: Task;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onDuplicate: (task: Task) => void;
  onAssign: (taskId: string) => void;
  onChangeStatus: (taskId: string, status: string) => void;
  onChangePriority: (taskId: string, priority: string) => void;
}

export interface ProjectContextMenuProps {
  project: Project;
  x: number;
  y: number;
  onClose: () => void;
  onEdit: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onDuplicate: (project: Project) => void;
  onArchive: (projectId: string) => void;
  onShare: (projectId: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, items }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const adjustedStyle = {
    position: 'fixed' as const,
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - items.length * 40),
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-48"
      style={adjustedStyle}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {item.divider && <div className="border-t border-gray-100 my-1" />}
          <button
            className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-50 transition-colors text-left ${
              item.disabled ? 'text-gray-400 cursor-not-allowed' : 
              item.destructive ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'
            }`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
          >
            <span className="mr-3 w-4 h-4 flex-shrink-0">{item.icon}</span>
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};

export const TaskContextMenu: React.FC<TaskContextMenuProps> = ({
  task,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onAssign,
  onChangeStatus,
  onChangePriority,
}) => {
  const items: ContextMenuItem[] = [
    {
      label: 'Edit task',
      icon: <EditIcon className="w-4 h-4" />,
      onClick: () => onEdit(task),
    },
    {
      label: 'Duplicate task',
      icon: <CopyIcon className="w-4 h-4" />,
      onClick: () => onDuplicate(task),
    },
    {
      label: 'Assign to...',
      icon: <UserIcon className="w-4 h-4" />,
      onClick: () => onAssign(task.id),
    },
    { divider: true } as ContextMenuItem,
    {
      label: task.status === 'In Progress' ? 'Mark as To Do' : 'Start task',
      icon: task.status === 'In Progress' ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />,
      onClick: () => onChangeStatus(task.id, task.status === 'In Progress' ? 'To Do' : 'In Progress'),
    },
    {
      label: 'Mark complete',
      icon: <CheckCircleIcon className="w-4 h-4" />,
      onClick: () => onChangeStatus(task.id, 'Done'),
      disabled: task.status === 'Done',
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Set priority',
      icon: <FlagIcon className="w-4 h-4" />,
      onClick: () => onChangePriority(task.id, task.priority === 'high' ? 'medium' : 'high'),
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Delete task',
      icon: <TrashIcon className="w-4 h-4" />,
      onClick: () => onDelete(task.id),
      destructive: true,
    },
  ];

  return <ContextMenu x={x} y={y} onClose={onClose} items={items} />;
};

export const ProjectContextMenu: React.FC<ProjectContextMenuProps> = ({
  project,
  x,
  y,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  onShare,
}) => {
  const items: ContextMenuItem[] = [
    {
      label: 'Edit project',
      icon: <EditIcon className="w-4 h-4" />,
      onClick: () => onEdit(project),
    },
    {
      label: 'Duplicate project',
      icon: <CopyIcon className="w-4 h-4" />,
      onClick: () => onDuplicate(project),
    },
    {
      label: 'Share project',
      icon: <UserIcon className="w-4 h-4" />,
      onClick: () => onShare(project.id),
    },
    { divider: true } as ContextMenuItem,
    {
      label: project.status === 'archived' ? 'Unarchive project' : 'Archive project',
      icon: <ClockIcon className="w-4 h-4" />,
      onClick: () => onArchive(project.id),
    },
    { divider: true } as ContextMenuItem,
    {
      label: 'Delete project',
      icon: <TrashIcon className="w-4 h-4" />,
      onClick: () => onDelete(project.id),
      destructive: true,
    },
  ];

  return <ContextMenu x={x} y={y} onClose={onClose} items={items} />;
};

export default ContextMenu;