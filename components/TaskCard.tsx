
import React, { useState, useEffect } from 'react';
import { Task, User } from '../types';
import { mockApi } from '../services/mockApi';
import { CalendarIcon, MessageCircleIcon, UserIcon, ClockIcon, CheckCircleIcon, XIcon } from './icons';
import { TaskContextMenu } from './ContextMenu';
import { TaskIndicators } from './VisualIndicators';

interface TaskCardProps {
  task: Task;
  users: User[];
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onClick: (task: Task) => void;
  onEdit?: (task: Task) => void;
  onDelete?: (taskId: string) => void;
  onDuplicate?: (task: Task) => void;
  onAssign?: (taskId: string) => void;
  onChangeStatus?: (taskId: string, status: string) => void;
  onChangePriority?: (taskId: string, priority: string) => void;
  isSelected?: boolean;
  onSelect?: (taskId: string, selected: boolean) => void;
  showCheckbox?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  users, 
  onDragStart, 
  onClick, 
  onEdit,
  onDelete,
  onDuplicate,
  onAssign,
  onChangeStatus,
  onChangePriority,
  isSelected = false,
  onSelect,
  showCheckbox = false
}) => {
  const [commentCount, setCommentCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    mockApi.getCommentsForTask(task.id).then(comments => setCommentCount(comments.length));
    const unsubscribe = mockApi.subscribeToComments(task.id, (comments) => setCommentCount(comments.length));
    return () => unsubscribe();
  }, [task.id]);

  const assignee = users.find(u => u.uid === task.assigneeId);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, task.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(task.id, e.target.checked);
  };

  const getDueDateStyles = () => {
    if (!task.dueDate) return '';
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0,0,0,0);

    if (dueDate < today) {
        return 'bg-red-100 text-red-800 border-red-200';
    } else if (dueDate.getTime() === today.getTime()) {
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    return 'bg-slate-100 text-slate-600';
  };

  const getApprovalStatusIcon = () => {
    if (!task.approval) return null;
    
    switch (task.approval.status) {
      case 'approved':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" title="Approved" />;
      case 'rejected':
        return <XIcon className="w-4 h-4 text-red-500" title="Rejected" />;
      default:
        return <ClockIcon className="w-4 h-4 text-yellow-500" title="Pending approval" />;
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onClick={() => onClick(task)}
        onContextMenu={handleContextMenu}
        className={`bg-white rounded-lg border shadow-sm p-4 mb-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:border-gray-300'
        }`}
      >
        {showCheckbox && (
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={handleCheckboxChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
            />
          </div>
        )}
        
        <div className="flex justify-between items-start mb-2">
          <h4 className="text-sm font-medium text-gray-900 flex-1 line-clamp-2">{task.title}</h4>
          {task.priority && (
            <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
              task.priority === 'critical' ? 'bg-red-100 text-red-800' :
              task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
              task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {task.priority}
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">{task.description}</p>
        )}

        <div className="mb-3">
          <TaskIndicators task={task} compact={true} />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-3">
            {task.dueDate && (
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-md border ${getDueDateStyles()}`}>
                <CalendarIcon className="w-3 h-3" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
            
            {task.timeTracked > 0 && (
              <div className="flex items-center space-x-1">
                <ClockIcon className="w-3 h-3" />
                <span>{Math.floor(task.timeTracked / 60)}h {task.timeTracked % 60}m</span>
              </div>
            )}

            {commentCount > 0 && (
              <div className="flex items-center space-x-1">
                <MessageCircleIcon className="w-3 h-3" />
                <span>{commentCount}</span>
              </div>
            )}

            {getApprovalStatusIcon()}
          </div>

          <div className="flex items-center space-x-2">
            {task.tags && task.tags.length > 0 && (
              <div className="flex space-x-1">
                {task.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {tag}
                  </span>
                ))}
                {task.tags.length > 2 && (
                  <span className="text-gray-400">+{task.tags.length - 2}</span>
                )}
              </div>
            )}
            
            {assignee && (
              <div 
                className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                title={assignee.displayName}
              >
                {assignee.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <TaskContextMenu
          task={task}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onEdit={onEdit || (() => {})}
          onDelete={onDelete || (() => {})}
          onDuplicate={onDuplicate || (() => {})}
          onAssign={onAssign || (() => {})}
          onChangeStatus={onChangeStatus || (() => {})}
          onChangePriority={onChangePriority || (() => {})}
        />
      )}
    </>
  );
};

export default TaskCard;
