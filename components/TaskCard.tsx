
import React, { useState, useEffect } from 'react';
import { Task, User } from '../types';
import { mockApi } from '../services/mockApi';
import { CalendarIcon, MessageCircleIcon, UserIcon } from './icons';

interface TaskCardProps {
  task: Task;
  users: User[];
  onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onClick: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, users, onDragStart, onClick }) => {
  const [commentCount, setCommentCount] = useState(0);

  useEffect(() => {
    mockApi.getCommentsForTask(task.id).then(comments => setCommentCount(comments.length));
    const unsubscribe = mockApi.subscribeToComments(task.id, (comments) => setCommentCount(comments.length));
    return () => unsubscribe();
  }, [task.id]);

  const assignee = users.find(u => u.uid === task.assigneeId);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart(e, task.id);
  };

  const getDueDateStyles = () => {
    if (!task.dueDate) return '';
    const today = new Date();
    today.setHours(0,0,0,0);
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0,0,0,0);

    if (dueDate < today) {
        return 'bg-red-100 text-red-800';
    } else if (dueDate.getTime() === today.getTime()) {
        return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-slate-100 text-slate-600';
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick(task)}
      className="bg-white p-4 rounded-md shadow-sm border border-slate-200 hover:shadow-md hover:border-primary cursor-pointer transition-all mb-3"
    >
      <p className="font-medium text-slate-800 mb-3">{task.title}</p>
      <div className="flex justify-between items-center text-sm text-slate-500">
        <div className="flex items-center space-x-3">
          {task.dueDate && (
            <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${getDueDateStyles()}`}>
                <CalendarIcon className="w-3 h-3" />
                <span>{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {commentCount > 0 && (
            <div className="flex items-center space-x-1">
              <MessageCircleIcon className="w-4 h-4" />
              <span>{commentCount}</span>
            </div>
          )}
        </div>
        {assignee && (
            <div title={assignee.displayName} className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-primary font-bold text-xs border-2 border-white">
                {assignee.displayName.charAt(0)}
            </div>
        )}
      </div>
    </div>
  );
};

export default TaskCard;
